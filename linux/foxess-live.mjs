/*
 * Optional FoxESS Cloud live telemetry for the Raspberry Pi edition.
 *
 * The /dew/v0/wsmaitian WebSocket is an undocumented FoxESS web-portal
 * interface. It is used only for read-only telemetry. All inverter controls
 * continue to use the documented Open API, and REST telemetry remains the
 * automatic fallback.
 *
 * The protocol behaviour is adapted from nicois/foxess-control
 * (Copyright 2026 Nick Farrell), used under the MIT License.
 * See THIRD_PARTY_NOTICES.md.
 */

import { createHash } from 'node:crypto';
import WebSocket from 'ws';

import { generateFoxWebSignature } from './foxess-web-signature.mjs';

export const FOX_LIVE_MODE = 'live-ws';
export const FOX_REST_MODE = 'rest';
export const FOX_LIVE_POLICY_ON_DEMAND = 'on-demand';
export const FOX_LIVE_POLICY_ALWAYS = 'always';
export const FOX_LIVE_POLICY_REST = 'rest';

const WEB_LOGIN_PATH = '/basic/v0/user/login';
const WEB_SOCKET_PATH = '/dew/v0/wsmaitian';
const DEFAULT_WEB_BASE_URL = 'https://www.foxesscloud.com';
const LIVE_STALE_MS = 30_000;
const LIVE_HEARTBEAT_INTERVAL_MS = 20_000;
const CONNECT_TIMEOUT_MS = 25_000;
const WEB_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const REST_CACHE_MS = 60_000;
const RECONCILE_INTERVAL_MS = 30_000;
const TELEMETRY_VARIABLES = [
  'SoC',
  'pvPower',
  'loadsPower',
  'batChargePower',
  'batDischargePower',
  'gridConsumptionPower',
  'feedinPower',
  'batTemperature',
  'ambientTemperation'
];

function normalizeMode(credentials = {}) {
  return credentials.foxLiveMode === FOX_REST_MODE ? FOX_REST_MODE : FOX_LIVE_MODE;
}

export function normalizeLivePolicy(state = {}, credentials = state.credentials || {}) {
  if (normalizeMode(credentials) === FOX_REST_MODE) return FOX_LIVE_POLICY_REST;
  if (state.liveWsPolicy === FOX_LIVE_POLICY_ALWAYS) return FOX_LIVE_POLICY_ALWAYS;
  if (state.liveWsPolicy === FOX_LIVE_POLICY_ON_DEMAND) return FOX_LIVE_POLICY_ON_DEMAND;
  if (state.liveWsPolicy === FOX_LIVE_POLICY_REST || state.liveWsOnDemand === false) {
    return FOX_LIVE_POLICY_REST;
  }
  return FOX_LIVE_POLICY_ON_DEMAND;
}

function isLiveDemandActive(state = {}, now = Date.now()) {
  if (state.liveWsDemandActive !== true) return false;
  const startsAt = new Date(state.liveWsDemandStartsAt || 0).getTime();
  const endsAt = new Date(state.liveWsDemandEndsAt || 0).getTime();
  return Number.isFinite(startsAt)
    && Number.isFinite(endsAt)
    && startsAt <= now
    && now < endsAt;
}

function normalizeError(error) {
  const message = String(error?.message || error || 'Unknown connection error')
    .replaceAll(/token=[^&\s]+/gi, 'token=[redacted]')
    .replaceAll(/password[^,\s]*/gi, 'password=[redacted]');
  return message.slice(0, 240);
}

function ensurePasswordHash(passwordOrHash) {
  const value = String(passwordOrHash || '').trim();
  return /^[0-9a-f]{32}$/i.test(value)
    ? value.toLowerCase()
    : createHash('md5').update(value).digest('hex');
}

function powerToKilowatts(powerObject) {
  if (!powerObject || powerObject.value === undefined || powerObject.value === null) return null;
  const value = Number(powerObject.value);
  if (!Number.isFinite(value)) return null;
  return powerObject.unit === 'kW' ? value : value / 1000;
}

export function mapFoxWebSocketTelemetry(message) {
  const node = message?.result?.node;
  if (!node || typeof node !== 'object') return {};

  const values = {};
  const soc = Number(node.bat?.soc);
  if (Number.isFinite(soc)) values.SoC = soc;

  const batteryPower = powerToKilowatts(node.bat?.power);
  if (batteryPower !== null) {
    const charging = String(node.bat?.charge) === '1';
    values.batChargePower = charging ? batteryPower : 0;
    values.batDischargePower = charging ? 0 : batteryPower;
  }

  const pvPower = powerToKilowatts(node.solar?.power);
  if (pvPower !== null) values.pvPower = pvPower;
  const loadsPower = powerToKilowatts(node.load?.power);
  if (loadsPower !== null) values.loadsPower = loadsPower;

  const gridPower = powerToKilowatts(node.grid?.power);
  if (gridPower !== null) {
    const importing = String(node.grid?.gridStatus || '') === '3';
    values.gridConsumptionPower = importing ? gridPower : 0;
    values.feedinPower = importing ? 0 : gridPower;
  }
  return values;
}

function mapOfficialTelemetry(result) {
  const rows = Array.isArray(result) ? result[0]?.datas : null;
  if (!Array.isArray(rows)) return {};
  return Object.fromEntries(
    rows
      .filter(row => row && typeof row.variable === 'string')
      .map(row => [row.variable, row.value])
  );
}

function getCredentialFingerprint(credentials) {
  return createHash('sha256').update(JSON.stringify({
    mode: normalizeMode(credentials),
    serial: credentials.foxSN || '',
    token: credentials.foxToken || '',
    username: credentials.foxWebUsername || '',
    password: credentials.foxWebPassword || ''
  })).digest('hex');
}

function getWebCredentialFingerprint(credentials) {
  return createHash('sha256').update(JSON.stringify({
    username: credentials.foxWebUsername || '',
    password: credentials.foxWebPassword || ''
  })).digest('hex');
}

function formatPortalDate(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export class FoxessLiveTelemetry {
  constructor({
    loadState,
    foxOpenApiJson,
    fetchImpl = fetch,
    WebSocketImpl = WebSocket,
    webBaseUrl = process.env.FOXESS_WEB_BASE_URL || DEFAULT_WEB_BASE_URL,
    logger = console,
    now = () => Date.now(),
    liveHeartbeatIntervalMs = LIVE_HEARTBEAT_INTERVAL_MS
  }) {
    this.loadState = loadState;
    this.foxOpenApiJson = foxOpenApiJson;
    this.fetchImpl = fetchImpl;
    this.WebSocketImpl = WebSocketImpl;
    this.webBaseUrl = webBaseUrl.replace(/\/$/, '');
    this.logger = logger;
    this.now = now;
    this.liveHeartbeatIntervalMs = liveHeartbeatIntervalMs;
    this.socket = null;
    this.liveHeartbeatTimer = null;
    this.fingerprint = '';
    this.portalToken = '';
    this.portalTokenAt = 0;
    this.portalTokenFingerprint = '';
    this.connectPromise = null;
    this.connectionGeneration = 0;
    this.latestValues = {};
    this.latestAt = 0;
    this.restCache = null;
    this.status = {
      mode: FOX_LIVE_MODE,
      source: 'rest-fallback',
      state: 'starting',
      reason: 'startup',
      connected: false,
      configured: false,
      policy: FOX_LIVE_POLICY_ON_DEMAND,
      onDemandEnabled: true,
      demandActive: false,
      updatedAt: null,
      lastError: null
    };
    this.reconcileTimer = null;
    this.manualTestActive = false;
  }

  start() {
    if (this.reconcileTimer) return;
    this.reconcileTimer = setInterval(() => {
      void this.reconcile();
    }, RECONCILE_INTERVAL_MS);
    this.reconcileTimer.unref?.();
    void this.reconcile();
  }

  stop() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.reconcileTimer = null;
    this.connectionGeneration += 1;
    this.closeSocket();
  }

  closeSocket() {
    if (this.liveHeartbeatTimer) clearInterval(this.liveHeartbeatTimer);
    this.liveHeartbeatTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.removeAllListeners?.();
    if (socket.readyState === this.WebSocketImpl.OPEN) socket.close(1000, 'configuration changed');
    else if (socket.readyState !== this.WebSocketImpl.CLOSED) socket.terminate?.();
  }

  startLiveSession(socket, generation) {
    if (this.liveHeartbeatTimer) clearInterval(this.liveHeartbeatTimer);
    socket.send('getdata');
    const heartbeat = () => {
      if (
        generation === this.connectionGeneration
        && this.socket === socket
        && socket.readyState === this.WebSocketImpl.OPEN
      ) {
        socket.ping?.();
      }
    };
    this.liveHeartbeatTimer = setInterval(heartbeat, this.liveHeartbeatIntervalMs);
    this.liveHeartbeatTimer.unref?.();
  }

  setFallback(mode, reason, error = null, { officialRest = false, state = null } = {}) {
    this.status = {
      ...this.status,
      mode,
      source: officialRest || mode === FOX_REST_MODE ? 'rest' : 'rest-fallback',
      state: state || (mode === FOX_REST_MODE ? 'rest-only' : 'fallback'),
      reason,
      connected: false,
      updatedAt: this.latestAt ? new Date(this.latestAt).toISOString() : null,
      lastError: error ? normalizeError(error) : null
    };
  }

  getPublicStatus() {
    return { ...this.status };
  }

  async makePortalHeaders(path, token = '') {
    const timestamp = String(this.now());
    const language = 'en';
    const timezone = 'Europe/London';
    return {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      lang: language,
      timestamp,
      signature: await generateFoxWebSignature(path, token, language, timestamp),
      token,
      timezone,
      dt: `${timezone}@${timestamp}@${formatPortalDate(new Date(Number(timestamp)))}`,
      platform: 'web'
    };
  }

  async loginToPortal(credentials, { force = false } = {}) {
    const credentialFingerprint = getWebCredentialFingerprint(credentials);
    const cachedTokenIsFresh = this.portalToken
      && this.portalTokenFingerprint === credentialFingerprint
      && (this.now() - this.portalTokenAt) < WEB_TOKEN_TTL_MS;
    if (!force && cachedTokenIsFresh) return this.portalToken;

    const headers = await this.makePortalHeaders(WEB_LOGIN_PATH);
    let response;
    try {
      response = await this.fetchImpl(`${this.webBaseUrl}${WEB_LOGIN_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user: credentials.foxWebUsername,
          password: ensurePasswordHash(credentials.foxWebPassword),
          type: 1,
          verification: 1
        }),
        signal: AbortSignal.timeout(20_000)
      });
    } catch (error) {
      throw new Error(`FoxESS web login request failed: ${normalizeError(error)}`);
    }
    if (!response.ok) throw new Error(`FoxESS web login returned HTTP ${response.status}`);
    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`FoxESS web login returned an unreadable response: ${normalizeError(error)}`);
    }
    if (data.errno !== 0 || !data.result?.token) {
      const detail = data.msg ? `: ${String(data.msg).slice(0, 120)}` : '';
      throw new Error(`FoxESS web login rejected (errno ${data.errno ?? 'unknown'}${detail})`);
    }
    this.portalToken = data.result.token;
    this.portalTokenAt = this.now();
    this.portalTokenFingerprint = credentialFingerprint;
    return this.portalToken;
  }

  async discoverPlantId(state) {
    const data = await this.foxOpenApiJson(
      state,
      '/op/v0/plant/list',
      { currentPage: 1, pageSize: 10 }
    );
    const plantId = data.result?.data?.[0]?.stationID;
    if (!plantId) throw new Error('FoxESS Open API returned no plant ID');
    return String(plantId);
  }

  async connect(state, credentials, generation, { forceLogin = false } = {}) {
    let plantId;
    try {
      plantId = await this.discoverPlantId(state);
    } catch (error) {
      throw new Error(`FoxESS REST plant discovery failed: ${normalizeError(error)}`);
    }
    const token = await this.loginToPortal(credentials, { force: forceLogin });
    if (generation !== this.connectionGeneration) throw new Error('Live connection configuration changed');

    const socketUrl = new URL(
      this.webBaseUrl.replace(/^http/, 'ws') + WEB_SOCKET_PATH
    );
    socketUrl.searchParams.set('plantId', plantId);
    socketUrl.searchParams.set('token', token);
    socketUrl.searchParams.set('platform', 'web');
    socketUrl.searchParams.set('lang', 'en');

    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };
      const timeout = setTimeout(() => {
        finish(new Error('FoxESS live self-test timed out without a fresh telemetry frame'));
        this.socket?.terminate?.();
      }, CONNECT_TIMEOUT_MS);
      timeout.unref?.();

      const socket = new this.WebSocketImpl(socketUrl, { handshakeTimeout: 15_000 });
      this.socket = socket;

      socket.on('open', () => {
        if (generation !== this.connectionGeneration) {
          socket.close();
          return;
        }
        this.startLiveSession(socket, generation);
      });
      socket.on('unexpected-response', (_request, response) => {
        const status = response?.statusCode || 'unknown';
        const statusText = response?.statusMessage ? ` ${response.statusMessage}` : '';
        finish(new Error(`FoxESS live WebSocket handshake returned HTTP ${status}${statusText}`));
        socket.terminate?.();
      });
      socket.on('message', raw => {
        if (generation !== this.connectionGeneration) return;
        try {
          const message = JSON.parse(raw.toString());
          if (message.errno !== undefined && message.errno !== 0) {
            throw new Error(`FoxESS live stream returned error ${message.errno}`);
          }
          const timeDiff = Number(message.result?.timeDiff);
          if (Number.isFinite(timeDiff) && timeDiff > 30) return;
          const mapped = mapFoxWebSocketTelemetry(message);
          if (Object.keys(mapped).length === 0) return;
          this.latestAt = this.now();
          this.latestValues = {
            ...(this.restCache?.values || {}),
            ...this.latestValues,
            ...mapped
          };
          this.status = {
            ...this.status,
            mode: FOX_LIVE_MODE,
            source: 'live-ws',
            state: 'live',
            reason: 'fresh-telemetry',
            connected: true,
            configured: true,
            updatedAt: new Date(this.latestAt).toISOString(),
            lastError: null
          };
          finish();
        } catch (error) {
          this.logger.warn?.('FoxESS live telemetry frame rejected:', normalizeError(error));
        }
      });
      socket.on('error', error => {
        if (generation === this.connectionGeneration) {
          if (this.liveHeartbeatTimer) clearInterval(this.liveHeartbeatTimer);
          this.liveHeartbeatTimer = null;
          this.setFallback(FOX_LIVE_MODE, 'connection-error', error);
        }
        finish(new Error(`FoxESS live WebSocket connection failed: ${normalizeError(error)}`));
      });
      socket.on('close', () => {
        if (generation === this.connectionGeneration) {
          if (this.liveHeartbeatTimer) clearInterval(this.liveHeartbeatTimer);
          this.liveHeartbeatTimer = null;
          this.socket = null;
          this.setFallback(FOX_LIVE_MODE, 'connection-closed');
        }
        finish(new Error('FoxESS live connection closed before receiving telemetry'));
      });
    });
  }

  async reconcile({ force = false, waitForLive = false, bypassDemand = false, bypassPolicy = false } = {}) {
    const state = await this.loadState();
    const credentials = state.credentials || {};
    const mode = normalizeMode(credentials);
    const policy = normalizeLivePolicy(state, credentials);
    const onDemandEnabled = policy === FOX_LIVE_POLICY_ON_DEMAND;
    const demandActive = isLiveDemandActive(state, this.now());
    const configured = Boolean(
      credentials.foxSN &&
      credentials.foxToken &&
      credentials.foxWebUsername &&
      credentials.foxWebPassword
    );
    this.status.mode = mode;
    this.status.configured = configured;
    this.status.policy = policy;
    this.status.onDemandEnabled = onDemandEnabled;
    this.status.demandActive = demandActive;

    // A manual self-test owns the temporary connection. Normal dashboard REST
    // polling must not cancel it while on-demand mode is otherwise in standby.
    if (this.manualTestActive && !force) {
      return this.getPublicStatus();
    }

    if (policy === FOX_LIVE_POLICY_REST && !bypassPolicy) {
      this.connectionGeneration += 1;
      this.closeSocket();
      this.fingerprint = getCredentialFingerprint(credentials);
      this.setFallback(FOX_REST_MODE, 'rest-selected');
      return this.getPublicStatus();
    }
    if (!configured) {
      this.connectionGeneration += 1;
      this.closeSocket();
      this.fingerprint = getCredentialFingerprint(credentials);
      this.setFallback(mode, 'live-credentials-empty');
      return this.getPublicStatus();
    }
    if (policy === FOX_LIVE_POLICY_ON_DEMAND && !demandActive && !bypassDemand) {
      this.connectionGeneration += 1;
      this.closeSocket();
      this.fingerprint = getCredentialFingerprint(credentials);
      this.setFallback(mode, 'waiting-for-dynamic-schedule', null, { officialRest: true, state: 'standby' });
      return this.getPublicStatus();
    }

    const fingerprint = getCredentialFingerprint(credentials);
    const isFresh = this.status.state === 'live' && (this.now() - this.latestAt) <= LIVE_STALE_MS;
    if (!force && fingerprint === this.fingerprint && isFresh && this.socket) {
      return this.getPublicStatus();
    }
    if (!force && fingerprint === this.fingerprint && this.connectPromise) {
      if (waitForLive) await this.connectPromise;
      return this.getPublicStatus();
    }

    this.connectionGeneration += 1;
    const generation = this.connectionGeneration;
    this.closeSocket();
    this.fingerprint = fingerprint;
    this.status = {
      ...this.status,
      mode,
      source: 'rest-fallback',
      state: 'connecting',
      reason: force ? 'self-test' : 'connecting',
      connected: false,
      configured: true,
      updatedAt: this.latestAt ? new Date(this.latestAt).toISOString() : null,
      lastError: null
    };
    const attempt = this.connect(state, credentials, generation, { forceLogin: force })
      .catch(error => {
        if (generation === this.connectionGeneration) {
          this.setFallback(mode, 'self-test-failed', error);
        }
        throw error;
      })
      .finally(() => {
        if (this.connectPromise === attempt) this.connectPromise = null;
      });
    this.connectPromise = attempt;

    if (waitForLive) await attempt;
    else attempt.catch(() => {});
    return this.getPublicStatus();
  }

  async getTelemetry() {
    await this.reconcile();
    if (this.status.state === 'live' && (this.now() - this.latestAt) <= LIVE_STALE_MS) {
      return {
        ...this.getPublicStatus(),
        values: { ...this.latestValues },
        cached: false
      };
    }

    const state = await this.loadState();
    const credentials = state.credentials || {};
    const mode = normalizeMode(credentials);
    const policy = normalizeLivePolicy(state, credentials);
    const effectiveMode = policy === FOX_LIVE_POLICY_REST ? FOX_REST_MODE : mode;
    const officialRest = policy === FOX_LIVE_POLICY_REST
      || (policy === FOX_LIVE_POLICY_ON_DEMAND && !isLiveDemandActive(state, this.now()));
    const cacheFresh = this.restCache && (this.now() - this.restCache.updatedAt) < REST_CACHE_MS;
    if (cacheFresh) {
      return {
        ...this.getPublicStatus(),
        source: officialRest ? 'rest' : 'rest-fallback',
        values: { ...this.restCache.values },
        updatedAt: new Date(this.restCache.updatedAt).toISOString(),
        cached: true
      };
    }

    const data = await this.foxOpenApiJson(
      state,
      '/op/v0/device/real/query',
      { sn: credentials.foxSN, variables: TELEMETRY_VARIABLES }
    );
    const values = mapOfficialTelemetry(data.result);
    const updatedAt = this.now();
    this.restCache = { values, updatedAt };
    this.latestValues = { ...values, ...this.latestValues };
    this.setFallback(
      effectiveMode,
      policy === FOX_LIVE_POLICY_REST
        ? 'rest-selected'
        : (this.status.reason || 'live-unavailable'),
      this.status.lastError,
      {
        officialRest,
        state: officialRest
          ? (policy === FOX_LIVE_POLICY_REST ? 'rest-only' : 'standby')
          : 'fallback'
      }
    );
    return {
      ...this.getPublicStatus(),
      source: officialRest ? 'rest' : 'rest-fallback',
      values,
      updatedAt: new Date(updatedAt).toISOString(),
      cached: false
    };
  }

  async selfTest() {
    this.manualTestActive = true;
    let result;
    try {
      await this.reconcile({ force: true, waitForLive: true, bypassDemand: true, bypassPolicy: true });
      result = this.getPublicStatus();
    } catch {
      // The public status contains a redacted diagnostic and REST fallback state.
      result = this.getPublicStatus();
    } finally {
      this.manualTestActive = false;
      // A test in on-demand standby is deliberately temporary. Disconnect as
      // soon as the fresh frame has proved the credentials, avoiding a second
      // FoxESS web session that could log the mobile app out.
      if (result?.policy !== FOX_LIVE_POLICY_ALWAYS && result?.demandActive !== true) {
        this.connectionGeneration += 1;
        this.closeSocket();
        if (result?.policy === FOX_LIVE_POLICY_REST) {
          this.setFallback(FOX_REST_MODE, 'rest-selected');
        } else {
          this.setFallback(
            FOX_LIVE_MODE,
            'waiting-for-dynamic-schedule',
            null,
            { officialRest: true, state: 'standby' }
          );
        }
      }
    }
    return result;
  }
}
