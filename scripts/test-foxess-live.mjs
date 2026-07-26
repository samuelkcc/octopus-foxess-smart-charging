import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
  FOX_LIVE_MODE,
  FOX_REST_MODE,
  FoxessLiveTelemetry,
  mapFoxWebSocketTelemetry
} from '../linux/foxess-live.mjs';

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
assert.equal(fallbackTelemetry.source, 'rest-fallback');
assert.equal(fallbackTelemetry.reason, 'live-credentials-empty');
assert.equal(fallbackTelemetry.values.SoC, 61);
assert.equal(fallbackTelemetry.cached, false);
assert.equal((await fallbackService.getTelemetry()).cached, true);
assert.equal(restCalls, 1);
fallbackService.stop();

let liveFramesRequested = 0;
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
  liveRequestIntervalMs: 10,
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
assert.ok(liveFramesRequested >= 3, 'Live WS should request fresh telemetry repeatedly');
assert.equal(liveService.getPublicStatus().source, 'live-ws');
liveService.stop();

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

console.log('FoxESS Live WebSocket mapping, self-test, REST-only mode, caching, and fallback checks passed.');
