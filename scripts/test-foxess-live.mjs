import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
  FOX_LIVE_POLICY_ALWAYS,
  FOX_LIVE_POLICY_ON_DEMAND,
  FOX_LIVE_POLICY_REST,
  FOX_LIVE_MODE,
  FOX_REST_MODE,
  FoxessLiveTelemetry,
  mapFoxWebSocketTelemetry,
  normalizeLivePolicy
} from '../linux/foxess-live.mjs';

assert.equal(normalizeLivePolicy({ credentials: { foxLiveMode: FOX_LIVE_MODE } }), FOX_LIVE_POLICY_ON_DEMAND);
assert.equal(normalizeLivePolicy({
  liveWsPolicy: FOX_LIVE_POLICY_ALWAYS,
  credentials: { foxLiveMode: FOX_LIVE_MODE }
}), FOX_LIVE_POLICY_ALWAYS);
assert.equal(normalizeLivePolicy({
  liveWsPolicy: FOX_LIVE_POLICY_REST,
  credentials: { foxLiveMode: FOX_LIVE_MODE }
}), FOX_LIVE_POLICY_REST);

const mapped = mapFoxWebSocketTelemetry({
  result: {
    node: {
      bat: { soc: '73', charge: '1', power: { value: '2500', unit: 'W' } },
      solar: { power: { value: '3.2', unit: 'kW' } },
      load: { power: { value: '900', unit: 'W' } },
      grid: { gridStatus: '3', power: { value: '200', unit: 'W' } }
    }
  }
});
assert.deepEqual(mapped, {
  SoC: 73,
  batChargePower: 2.5,
  batDischargePower: 0,
  pvPower: 3.2,
  loadsPower: 0.9,
  gridConsumptionPower: 0.2,
  feedinPower: 0
});

let restCalls = 0;
const fallbackService = new FoxessLiveTelemetry({
  loadState: async () => ({
    credentials: {
      foxSN: 'SN-TEST',
      foxToken: 'TOKEN-TEST',
      foxLiveMode: FOX_LIVE_MODE,
      foxWebUsername: '',
      foxWebPassword: ''
    }
  }),
  foxOpenApiJson: async (_state, path) => {
    assert.equal(path, '/op/v0/device/real/query');
    restCalls += 1;
    return {
      errno: 0,
      result: [{
        datas: [
          { variable: 'SoC', value: 61 },
          { variable: 'pvPower', value: 1.4 }
        ]
      }]
    };
  },
  logger: { warn() {} }
});
const fallbackTelemetry = await fallbackService.getTelemetry();
assert.equal(fallbackTelemetry.source, 'rest');
assert.equal(fallbackTelemetry.reason, 'live-credentials-empty');
assert.equal(fallbackTelemetry.values.SoC, 61);
assert.equal(fallbackTelemetry.cached, false);
assert.equal((await fallbackService.getTelemetry()).cached, true);
assert.equal(restCalls, 1);
fallbackService.stop();

let liveFramesRequested = 0;
let liveHeartbeats = 0;
class FakeWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.emit('open');
    });
  }

  send(message) {
    assert.equal(message, 'getdata');
    liveFramesRequested += 1;
    queueMicrotask(() => {
      this.emit('message', Buffer.from(JSON.stringify({
        errno: 0,
        result: {
          timeDiff: 5,
          node: {
            bat: { soc: '82', charge: '0', power: { value: '1200', unit: 'W' } },
            solar: { power: { value: '2.6', unit: 'kW' } },
            load: { power: { value: '700', unit: 'W' } },
            grid: { gridStatus: '2', power: { value: '700', unit: 'W' } }
          }
        }
      })));
    });
  }

  ping() {
    liveHeartbeats += 1;
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    queueMicrotask(() => this.emit('close'));
  }

  terminate() {
    this.close();
  }
}

let liveOpenApiCalls = 0;
let loginBody;
const liveService = new FoxessLiveTelemetry({
  loadState: async () => ({
    liveWsOnDemand: true,
    liveWsDemandActive: true,
    liveWsDemandStartsAt: '2000-01-01T00:00:00.000Z',
    liveWsDemandEndsAt: '2100-01-01T00:00:00.000Z',
    credentials: {
      foxSN: 'SN-LIVE',
      foxToken: 'TOKEN-LIVE',
      foxLiveMode: FOX_LIVE_MODE,
      foxWebUsername: 'user@example.test',
      foxWebPassword: 'secret-password'
    }
  }),
  foxOpenApiJson: async (_state, path) => {
    assert.equal(path, '/op/v0/plant/list');
    liveOpenApiCalls += 1;
    return { errno: 0, result: { data: [{ stationID: 'PLANT-1' }] } };
  },
  fetchImpl: async (_url, options) => {
    loginBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ errno: 0, result: { token: 'WEB-TOKEN' } })
    };
  },
  WebSocketImpl: FakeWebSocket,
  liveHeartbeatIntervalMs: 10,
  logger: { warn() {} }
});
const liveStatus = await liveService.selfTest();
assert.equal(liveStatus.state, 'live');
assert.equal(liveStatus.source, 'live-ws');
assert.equal(liveStatus.connected, true);
assert.match(loginBody.password, /^[0-9a-f]{32}$/);
assert.notEqual(loginBody.password, 'secret-password');
const liveTelemetry = await liveService.getTelemetry();
assert.equal(liveTelemetry.source, 'live-ws');
assert.equal(liveTelemetry.values.SoC, 82);
assert.equal(liveTelemetry.values.batDischargePower, 1.2);
assert.equal(liveOpenApiCalls, 1);
await new Promise(resolve => setTimeout(resolve, 35));
assert.equal(liveFramesRequested, 1, 'Live WS should subscribe to the telemetry stream once');
assert.ok(liveHeartbeats >= 3, 'Live WS should keep the transport alive with protocol heartbeats');
assert.equal(liveService.getPublicStatus().source, 'live-ws');
liveService.stop();

let cachedTokenLoginCalls = 0;
const cachedTokenService = new FoxessLiveTelemetry({
  loadState: async () => ({}),
  foxOpenApiJson: async () => ({}),
  fetchImpl: async () => {
    cachedTokenLoginCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ errno: 0, result: { token: `WEB-TOKEN-${cachedTokenLoginCalls}` } })
    };
  },
  logger: { warn() {} }
});
const cachedCredentials = {
  foxWebUsername: 'user@example.test',
  foxWebPassword: 'secret-password'
};
assert.equal(await cachedTokenService.loginToPortal(cachedCredentials), 'WEB-TOKEN-1');
assert.equal(await cachedTokenService.loginToPortal(cachedCredentials), 'WEB-TOKEN-1');
assert.equal(cachedTokenLoginCalls, 1, 'A reconnect should reuse the current web token');
assert.equal(
  await cachedTokenService.loginToPortal(cachedCredentials, { force: true }),
  'WEB-TOKEN-2'
);
assert.equal(cachedTokenLoginCalls, 2, 'An explicit forced test may request a fresh login');
cachedTokenService.stop();

let standbyLoginCalls = 0;
const standbyService = new FoxessLiveTelemetry({
  loadState: async () => ({
    liveWsOnDemand: true,
    liveWsDemandActive: false,
    credentials: {
      foxSN: 'SN-STANDBY',
      foxToken: 'TOKEN-STANDBY',
      foxLiveMode: FOX_LIVE_MODE,
      foxWebUsername: 'user@example.test',
      foxWebPassword: 'secret-password'
    }
  }),
  foxOpenApiJson: async (_state, path) => {
    assert.equal(path, '/op/v0/device/real/query');
    return { errno: 0, result: [{ datas: [{ variable: 'SoC', value: 64 }] }] };
  },
  fetchImpl: async () => {
    standbyLoginCalls += 1;
    throw new Error('Standby must not log in');
  },
  logger: { warn() {} }
});
const standbyTelemetry = await standbyService.getTelemetry();
assert.equal(standbyTelemetry.source, 'rest');
assert.equal(standbyTelemetry.state, 'standby');
assert.equal(standbyTelemetry.reason, 'waiting-for-dynamic-schedule');
assert.equal(standbyLoginCalls, 0);
standbyService.stop();

class DelayedFakeWebSocket extends FakeWebSocket {
  send(message) {
    assert.equal(message, 'getdata');
    setTimeout(() => {
      if (this.readyState !== DelayedFakeWebSocket.OPEN) return;
      this.emit('message', Buffer.from(JSON.stringify({
        errno: 0,
        result: {
          timeDiff: 1,
          node: { bat: { soc: '70' } }
        }
      })));
    }, 15);
  }
}

let temporaryTestLoginCalls = 0;
const temporaryTestService = new FoxessLiveTelemetry({
  loadState: async () => ({
    liveWsPolicy: FOX_LIVE_POLICY_ON_DEMAND,
    liveWsDemandActive: false,
    credentials: {
      foxSN: 'SN-TEMPORARY',
      foxToken: 'TOKEN-TEMPORARY',
      foxLiveMode: FOX_LIVE_MODE,
      foxWebUsername: 'user@example.test',
      foxWebPassword: 'secret-password'
    }
  }),
  foxOpenApiJson: async (_state, path) => {
    if (path === '/op/v0/plant/list') {
      return { errno: 0, result: { data: [{ stationID: 'PLANT-TEMPORARY' }] } };
    }
    assert.equal(path, '/op/v0/device/real/query');
    return { errno: 0, result: [{ datas: [{ variable: 'SoC', value: 69 }] }] };
  },
  fetchImpl: async () => {
    temporaryTestLoginCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ errno: 0, result: { token: 'WEB-TOKEN' } })
    };
  },
  WebSocketImpl: DelayedFakeWebSocket,
  logger: { warn() {} }
});
const temporarySelfTest = temporaryTestService.selfTest();
await new Promise(resolve => setTimeout(resolve, 1));
const concurrentRestTelemetry = temporaryTestService.getTelemetry();
const [temporaryTestStatus, concurrentTelemetry] = await Promise.all([
  temporarySelfTest,
  concurrentRestTelemetry
]);
assert.equal(temporaryTestStatus.source, 'live-ws');
assert.equal(temporaryTestStatus.state, 'live');
assert.equal(concurrentTelemetry.source, 'rest');
assert.equal(temporaryTestLoginCalls, 1);
assert.equal(temporaryTestService.getPublicStatus().state, 'standby');
assert.equal(temporaryTestService.getPublicStatus().reason, 'waiting-for-dynamic-schedule');
temporaryTestService.stop();

const alwaysService = new FoxessLiveTelemetry({
  loadState: async () => ({
    liveWsPolicy: FOX_LIVE_POLICY_ALWAYS,
    liveWsDemandActive: false,
    credentials: {
      foxSN: 'SN-ALWAYS',
      foxToken: 'TOKEN-ALWAYS',
      foxLiveMode: FOX_LIVE_MODE,
      foxWebUsername: 'user@example.test',
      foxWebPassword: 'secret-password'
    }
  }),
  foxOpenApiJson: async (_state, path) => {
    assert.equal(path, '/op/v0/plant/list');
    return { errno: 0, result: { data: [{ stationID: 'PLANT-ALWAYS' }] } };
  },
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ errno: 0, result: { token: 'WEB-TOKEN' } })
  }),
  WebSocketImpl: FakeWebSocket,
  logger: { warn() {} }
});
const alwaysStatus = await alwaysService.reconcile({ waitForLive: true });
assert.equal(alwaysStatus.policy, FOX_LIVE_POLICY_ALWAYS);
assert.equal(alwaysStatus.source, 'live-ws');
assert.equal(alwaysStatus.demandActive, false);
alwaysService.stop();

const enabledRestPolicyService = new FoxessLiveTelemetry({
  loadState: async () => ({
    liveWsPolicy: FOX_LIVE_POLICY_REST,
    credentials: {
      foxSN: 'SN-REST-TEST',
      foxToken: 'TOKEN-REST-TEST',
      foxLiveMode: FOX_LIVE_MODE,
      foxWebUsername: 'user@example.test',
      foxWebPassword: 'secret-password'
    }
  }),
  foxOpenApiJson: async (_state, path) => {
    assert.equal(path, '/op/v0/plant/list');
    return { errno: 0, result: { data: [{ stationID: 'PLANT-REST-TEST' }] } };
  },
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ errno: 0, result: { token: 'WEB-TOKEN' } })
  }),
  WebSocketImpl: FakeWebSocket,
  logger: { warn() {} }
});
const enabledRestPolicyTest = await enabledRestPolicyService.selfTest();
assert.equal(enabledRestPolicyTest.source, 'live-ws', 'Native self-test must work while the client policy is REST-only');
assert.equal(enabledRestPolicyService.getPublicStatus().state, 'rest-only');
enabledRestPolicyService.stop();

const restOnlyService = new FoxessLiveTelemetry({
  loadState: async () => ({
    credentials: {
      foxSN: 'SN-REST',
      foxToken: 'TOKEN-REST',
      foxLiveMode: FOX_REST_MODE
    }
  }),
  foxOpenApiJson: async () => ({
    errno: 0,
    result: [{ datas: [{ variable: 'SoC', value: 55 }] }]
  }),
  logger: { warn() {} }
});
const restOnlyTelemetry = await restOnlyService.getTelemetry();
assert.equal(restOnlyTelemetry.source, 'rest');
assert.equal(restOnlyTelemetry.state, 'rest-only');
assert.equal(restOnlyTelemetry.values.SoC, 55);
restOnlyService.stop();

console.log('FoxESS Live WebSocket mapping, one-shot subscription, heartbeat, token reuse, race-free temporary self-test, on-demand, always-live, REST-only, caching, and fallback checks passed.');
