import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const utilities = new Function(`
  ${extractFunction('isActiveFoxSchedule')}
  ${extractFunction('scheduleFingerprint')}
  ${extractFunction('prepareFoxSchedulePayload')}
  ${extractFunction('getActiveAgreement')}
  ${extractFunction('selectActiveElectricityTariffs')}
  ${extractFunction('getProductCodeFromTariffCode')}
  ${extractFunction('getRateAtTime')}
  ${extractFunction('getTariffSlotsForDate')}
  ${extractFunction('getWeeklyForcedChargePeriods')}
  ${extractFunction('buildScheduleGroupsFromTimeline')}
  ${extractFunction('getAutoResumeSource')}
  ${extractFunction('getAutoResumeUntil')}
  ${extractFunction('isScheduleMinuteSuppressed')}
  return { scheduleFingerprint, prepareFoxSchedulePayload, getActiveAgreement, selectActiveElectricityTariffs, getProductCodeFromTariffCode, getRateAtTime, getTariffSlotsForDate, getWeeklyForcedChargePeriods, buildScheduleGroupsFromTimeline, getAutoResumeSource, getAutoResumeUntil, isScheduleMinuteSuppressed };
`)();

const tariffNow = new Date('2026-07-26T12:00:00Z');
const importAgreement = { tariff_code: 'E-1R-INTELLI-VAR-24-10-29-A', valid_from: '2026-01-01T00:00:00Z', valid_to: null };
const exportAgreement = { tariff_code: 'E-1R-OUTGOING-SEG-20-05-13-A', valid_from: '2026-02-01T00:00:00Z', valid_to: null };
const tariffSelections = utilities.selectActiveElectricityTariffs({
  properties: [
    {
      electricity_meter_points: [
        { mpan: 'export-first', is_export: true, agreements: [exportAgreement] }
      ]
    },
    {
      electricity_meter_points: [
        {
          mpan: 'import-second',
          is_export: false,
          agreements: [
            { tariff_code: 'E-1R-OLD-IMPORT-A', valid_from: '2025-01-01T00:00:00Z', valid_to: '2026-01-01T00:00:00Z' },
            importAgreement
          ]
        }
      ]
    }
  ]
}, tariffNow);
assert.equal(tariffSelections.importTariff.meterPoint.mpan, 'import-second', 'SEG export meter points must never replace the import tariff');
assert.equal(tariffSelections.importTariff.agreement.tariff_code, importAgreement.tariff_code);
assert.equal(tariffSelections.exportTariff.meterPoint.mpan, 'export-first');
assert.equal(tariffSelections.exportTariff.agreement.tariff_code, exportAgreement.tariff_code);
assert.equal(utilities.getProductCodeFromTariffCode(importAgreement.tariff_code), 'INTELLI-VAR-24-10-29');
assert.equal(
  utilities.getRateAtTime(
    [{ valid_from: '2022-02-01T00:00:00Z', valid_to: null, value_inc_vat: 4.1 }],
    tariffNow
  ).value_inc_vat,
  4.1,
  'A fixed SEG rate with no end date must remain active'
);
const fixedExportSlots = utilities.getTariffSlotsForDate(
  [{ valid_from: '2022-02-01T00:00:00Z', valid_to: null, value_inc_vat: 4.1 }],
  tariffNow
);
assert.equal(fixedExportSlots.length, 48, 'A fixed SEG rate must expand across every half-hour of the selected day');
assert.ok(fixedExportSlots.every(slot => slot.value_inc_vat === 4.1));
assert.equal(
  utilities.getActiveAgreement(
    { agreements: [{ tariff_code: 'FUTURE', valid_from: '2026-08-01T00:00:00Z', valid_to: null }, importAgreement] },
    tariffNow
  ).tariff_code,
  importAgreement.tariff_code,
  'A future agreement must not replace the tariff active today'
);

const sampleGroups = Array.from({ length: 7 }, (_, index) => ({
  startHour: index,
  startMinute: 0,
  endHour: index,
  endMinute: 30,
  workMode: 'ForceCharge',
  extraParam: { fdSoc: 80 }
}));

const prepared = utilities.prepareFoxSchedulePayload(sampleGroups);
assert.equal(prepared.activeGroups.length, 5);
assert.equal(prepared.paddedGroups.length, 5);
assert.equal(prepared.droppedCount, 2);
assert.ok(prepared.paddedGroups.every(group => group.enable === 1));

const sparse = utilities.prepareFoxSchedulePayload(sampleGroups.slice(0, 2));
assert.equal(sparse.activeGroups.length, 2);
assert.equal(sparse.paddedGroups.filter(group => group.enable === 0).length, 3);
const preparedAgain = utilities.prepareFoxSchedulePayload(sparse.paddedGroups);
assert.equal(preparedAgain.activeGroups.length, 2, 'Disabled padding must stay disabled on reuse');
const foxResponsePadding = sparse.paddedGroups.map(group => {
  const { enable, ...withoutEnable } = group;
  return withoutEnable;
});
const preparedFoxResponse = utilities.prepareFoxSchedulePayload(foxResponsePadding);
assert.equal(preparedFoxResponse.activeGroups.length, 2, '00:00 Self-Use padding without an enable flag must stay disabled');

assert.equal(
  utilities.scheduleFingerprint([{ ...sampleGroups[0], extraParam: undefined }]),
  utilities.scheduleFingerprint([{ ...sampleGroups[0], fdSoc: 100, extraParam: undefined }]),
  'Default ForceCharge SOC should compare as 100%'
);

const weeklyOvernight = utilities.getWeeklyForcedChargePeriods({
  enabled: true,
  startTime: '23:30',
  endTime: '05:30',
  days: [2, 3]
}, new Date(2026, 6, 22, 12, 0));
assert.deepEqual(weeklyOvernight.map(period => [period.startHour, period.startMinute, period.endHour, period.endMinute]), [
  [0, 0, 5, 30],
  [23, 30, 23, 59]
], 'An overnight rule must be split into the two periods FoxESS accepts');
assert.deepEqual(
  utilities.getWeeklyForcedChargePeriods({ enabled: true, startTime: '23:30', endTime: '05:30', days: [1] }, new Date(2026, 6, 21, 12, 0)).map(period => [period.startHour, period.startMinute, period.endHour, period.endMinute]),
  [[0, 0, 5, 30]],
  'Tuesday must retain Monday night only until the morning boundary'
);
assert.deepEqual(
  utilities.getWeeklyForcedChargePeriods({ enabled: true, startTime: '23:30', endTime: '05:30', days: [2] }, new Date(2026, 6, 21, 12, 0)).map(period => [period.startHour, period.startMinute, period.endHour, period.endMinute]),
  [[23, 30, 23, 59]],
  'Tuesday selection must not create an early Tuesday period from Monday night'
);
assert.deepEqual(utilities.getWeeklyForcedChargePeriods({ enabled: true, startTime: '05:30', endTime: '05:30', days: [1] }, new Date(2026, 6, 20, 12, 0)), []);

const mergedTimeline = new Array(1440).fill(null);
for (let minute = 0; minute < 330; minute++) {
  mergedTimeline[minute] = {
    workMode: 'ForceCharge',
    finalFdSoc: 100,
    source: minute >= 60 && minute < 180 ? 'dispatch' : 'weekly'
  };
}
const mergedGroups = utilities.buildScheduleGroupsFromTimeline(mergedTimeline, 11, 5000);
assert.equal(mergedGroups.length, 1, 'FoxESS-equivalent adjacent charge periods must stay merged despite different UI sources');
assert.deepEqual(
  [mergedGroups[0].startHour, mergedGroups[0].startMinute, mergedGroups[0].endHour, mergedGroups[0].endMinute],
  [0, 0, 5, 30]
);
assert.equal(mergedGroups[0].extraParam.schSource, 'weekly', 'The base weekly source must remain available for display and Auto-Resume');

assert.equal(utilities.getAutoResumeSource(['weekly'], false), 'weekly');
assert.equal(utilities.getAutoResumeSource(['price'], false), 'price');
assert.equal(utilities.getAutoResumeSource(['weekly', 'dispatch'], true), null, 'Auto-Resume must not cancel an active Smart Dispatch');
const weeklyConfig = { enabled: true, startTime: '23:30', endTime: '05:30', days: [3] };
const overnightResumeUntil = utilities.getAutoResumeUntil('weekly', mergedGroups[0], new Date(2026, 6, 22, 23, 45), weeklyConfig);
assert.equal(overnightResumeUntil.getTime(), new Date(2026, 6, 23, 5, 30).getTime(), 'Late-night Auto-Resume lock must end after midnight');
const fulfilledWeekly = { source: 'weekly', until: new Date(2026, 6, 23, 5, 30).getTime() };
assert.equal(utilities.isScheduleMinuteSuppressed(fulfilledWeekly, 'weekly', new Date(2026, 6, 23, 2, 0).getTime()), true);
assert.equal(utilities.isScheduleMinuteSuppressed(fulfilledWeekly, 'dispatch', new Date(2026, 6, 23, 2, 0).getTime()), false, 'Smart Dispatch must survive weekly Auto-Resume');
assert.equal(utilities.isScheduleMinuteSuppressed(fulfilledWeekly, 'weekly', new Date(2026, 6, 23, 23, 30).getTime()), false, 'The next nightly schedule must remain available');

assert.doesNotMatch(source, /localStorage\.setItem\(['"](?:octoAcc|octoApi|foxSn|foxToken|gasUrl)['"]/);
assert.match(source, /if \(refreshTimerId !== null\) clearInterval\(refreshTimerId\)/);
assert.match(source, /async function fetchJson/);
assert.match(source, /dispatchActiveNow/, 'Auto-Resume must not cancel an active Smart Dispatch');
assert.match(source, /if \(isAutoPrice && window\.importRates\?\.length\)/, 'Target-price charging must use import rates');
assert.match(source, /if \(isAutoPrice && isAutoExport && window\.exportRates\?\.length\)/, 'Price export must use export rates');
assert.match(source, /label: 'Import tariff'/, 'The import chart must label the import tariff');
assert.match(source, /label: 'Export tariff'/, 'The export chart must label the export tariff');
assert.match(source, /data: exportDataPoints/, 'The price chart must plot export rates independently');
assert.match(source, /getElementById\('importPriceChart'\)/, 'The import tariff must use its own chart');
assert.match(source, /getElementById\('exportPriceChart'\)/, 'The export tariff must use its own chart');
assert.match(source, /window\.linuxRole === 'worker'/, 'Only the Raspberry Pi worker may run unattended actions');
assert.match(source, /if \(!btn && !canRunAutomaticActions\(\)\) return false/, 'LAN dashboards must not duplicate unattended schedule writes');
assert.match(source, /gasUrl: '\/api\/foxess'/, 'Raspberry Pi credentials must use the local FoxESS relay');

const capturedChartConfigs = [];
const chartElements = {
  importPriceChart: { style: {}, getContext: () => ({ canvas: 'import' }) },
  exportPriceChart: { style: {}, getContext: () => ({ canvas: 'export' }) },
  'import-chart-empty': { style: {} },
  'export-chart-empty': { style: {} }
};
const drawPriceCharts = new Function('window', 'document', 'Chart', `
  let importPriceChartInst = null;
  let exportPriceChartInst = null;
  ${extractFunction('getRateAtTime')}
  ${extractFunction('drawPriceCharts')}
  return drawPriceCharts;
`)(
  {
    importRates: [{ valid_from: '2000-01-01T00:00:00Z', valid_to: '2100-01-01T00:00:00Z', value_inc_vat: 7.5 }],
    exportRates: [{ valid_from: '2022-02-01T00:00:00Z', valid_to: null, value_inc_vat: 4.1 }]
  },
  {
    documentElement: { getAttribute: () => 'light' },
    getElementById: id => {
      assert.ok(chartElements[id], `Unexpected chart element ${id}`);
      return chartElements[id];
    }
  },
  class ChartMock {
    constructor(context, config) {
      capturedChartConfigs.push({ context, config });
    }
    destroy() {}
  }
);
drawPriceCharts(30, 7.5, []);
assert.deepEqual(
  capturedChartConfigs.map(chart => chart.config.data.datasets[0].label),
  ['Import tariff', 'Export tariff'],
  'Import and export tariffs must render in separate charts'
);
assert.equal(capturedChartConfigs[0].config.data.datasets[0].data[0], 7.5);
assert.equal(capturedChartConfigs[1].config.data.datasets[0].data[0], 4.1);
assert.equal(chartElements.importPriceChart.style.display, 'block');
assert.equal(chartElements.exportPriceChart.style.display, 'block');
assert.equal(chartElements['export-chart-empty'].style.display, 'none');

console.log('Scheduler, storage, timer, and request-safety checks passed.');
