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

const WEB_LOGIN_PATH = '/basic/v0/user/login';
const WEB_SOCKET_PATH = '/dew/v0/wsmaitian';
const DEFAULT_WEB_BASE_URL = 'https://www.foxesscloud.com';
const LIVE_STALE_MS = 30_000;
const LIVE_REQUEST_INTERVAL_MS = 5_000;
const CONNECT_TIMEOUT_MS = 25_000;
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
    liveRequestIntervalMs = LIVE_REQUEST_INTERVAL_MS
  }) {
    this.loadState = loadState;
    this.foxOpenApiJson = foxOpenApiJson;
    this.fetchImpl = fetchImpl;
    this.WebSocketImpl = WebSocketImpl;
    this.webBaseUrl = webBaseUrl.replace(/\/$/, '');
    this.logger = logger;
    this.now = now;
    this.liveRequestIntervalMs = liveRequestIntervalMs;
    this.socket = null;
    this.liveRequestTimer = null;
    this.fingerprint = '';
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
      onDemandEnabled: true,
      demandActive: false,
      updatedAt: null,
      lastError: null
    };
    this.reconcileTimer = null;
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
    if (this.liveRequestTimer) clearInterval(this.liveRequestTimer);
    this.liveRequestTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.removeAllListeners?.();
    if (socket.readyState === this.WebSocketImpl.OPEN) socket.close(1000, 'configuration changed');
    else if (socket.readyState !== this.WebSocketImpl.CLOSED) socket.terminate?.();
  }

  startLiveRequests(socket, generation) {
    if (this.liveRequestTimer) clearInterval(this.liveRequestTimer);
    const requestFrame = () => {
      if (
        generation === this.connectionGeneration
        && this.socket === socket
        && socket.readyState === this.WebSocketImpl.OPEN
      ) {
        socket.send('getdata');
      }
    };
    requestFrame();
    this.liveRequestTimer = setInterval(requestFrame, this.liveRequestIntervalMs);
    this.liveRequestTimer.unref?.();
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

  async loginToPortal(credentials) {
    const headers = await this.makePortalHeaders(WEB_LOGIN_PATH);
    const response = await this.fetchImpl(`${this.webBaseUrl}${WEB_LOGIN_PATH}`, {
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
    if (!response.ok) throw new Error(`FoxESS web login returned HTTP ${response.status}`);
    const data = await response.json();
    if (data.errno !== 0 || !data.result?.token) {
      throw new Error(`FoxESS web login rejected (${data.errno ?? 'unknown'})`);
    }
    return data.result.token;
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

  async connect(state, credentials, generation) {
    const plantId = await this.discoverPlantId(state);
    const token = await this.loginToPortal(credentials);
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
        this.socket?.terminate?.();
        finish(new Error('FoxESS live self-test timed out without a fresh telemetry frame'));
      }, CONNECT_TIMEOUT_MS);
      timeout.unref?.();

      const socket = new this.WebSocketImpl(socketUrl, {
        handshakeTimeout: 15_000,
        origin: this.webBaseUrl,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      this.socket = socket;

      socket.on('open', () => {
        if (generation !== this.connectionGeneration) {
          socket.close();
          return;
        }
        this.startLiveRequests(socket, generation);
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
          if (this.liveRequestTimer) clearInterval(this.liveRequestTimer);
          this.liveRequestTimer = null;
          this.setFallback(FOX_LIVE_MODE, 'connection-error', error);
        }
        finish(error);
      });
      socket.on('close', () => {
        if (generation === this.connectionGeneration) {
          if (this.liveRequestTimer) clearInterval(this.liveRequestTimer);
          this.liveRequestTimer = null;
          this.socket = null;
          this.setFallback(FOX_LIVE_MODE, 'connection-closed');
        }
        finish(new Error('FoxESS live connection closed before receiving telemetry'));
      });
    });
  }

  async reconcile({ force = false, waitForLive = false, bypassDemand = false } = {}) {
    const state = await this.loadState();
    const credentials = state.credentials || {};
    const mode = normalizeMode(credentials);
    const onDemandEnabled = state.liveWsOnDemand !== false;
    const demandActive = isLiveDemandActive(state, this.now());
    const configured = Boolean(
      credentials.foxSN &&
      credentials.foxToken &&
      credentials.foxWebUsername &&
      credentials.foxWebPassword
    );
    this.status.mode = mode;
    this.status.configured = configured;
    this.status.onDemandEnabled = onDemandEnabled;
    this.status.demandActive = demandActive;

    if (mode === FOX_REST_MODE) {
      this.connectionGeneration += 1;
      this.closeSocket();
      this.fingerprint = getCredentialFingerprint(credentials);
      this.setFallback(mode, 'rest-selected');
      return this.getPublicStatus();
    }
    if (!onDemandEnabled) {
      this.connectionGeneration += 1;
      this.closeSocket();
      this.fingerprint = getCredentialFingerprint(credentials);
      this.setFallback(mode, 'client-disabled', null, { officialRest: true, state: 'rest-only' });
      return this.getPublicStatus();
    }
    if (!configured) {
      this.connectionGeneration += 1;
      this.closeSocket();
      this.fingerprint = getCredentialFingerprint(credentials);
      this.setFallback(mode, 'live-credentials-empty');
      return this.getPublicStatus();
    }
    if (!demandActive && !bypassDemand) {
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
      mode,
      source: 'rest-fallback',
      state: 'connecting',
      reason: force ? 'self-test' : 'connecting',
      connected: false,
      configured: true,
      updatedAt: this.latestAt ? new Date(this.latestAt).toISOString() : null,
      lastError: null
    };
    const attempt = this.connect(state, credentials, generation)
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
    const officialRest = mode === FOX_REST_MODE
      || state.liveWsOnDemand === false
      || !isLiveDemandActive(state, this.now());
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
      mode,
      mode === FOX_REST_MODE
        ? 'rest-selected'
        : (state.liveWsOnDemand === false ? 'client-disabled' : (this.status.reason || 'live-unavailable')),
      this.status.lastError,
      {
        officialRest,
        state: officialRest
          ? (mode === FOX_REST_MODE || state.liveWsOnDemand === false ? 'rest-only' : 'standby')
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
    try {
      await this.reconcile({ force: true, waitForLive: true, bypassDemand: true });
    } catch {
      // The public status contains a redacted diagnostic and REST fallback state.
    }
    return this.getPublicStatus();
  }
}
