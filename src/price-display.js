/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Display conversion only. Scheduler values and tariff snapshots stay in UK pence.
 */
(() => {
  const storageKey = 'smartChargingPriceDisplayV1';
  const defaults = {enabled:false,code:'GBP',symbol:'£',fx:1};
  function validate(value) {
    if (!value || typeof value.enabled !== 'boolean' || !/^[A-Z]{3}$/.test(value.code)
        || typeof value.symbol !== 'string' || !value.symbol.trim() || value.symbol.length > 12
        || /[<>\u0000-\u001f\u007f]/.test(value.symbol)
        || typeof value.fx !== 'number' || !Number.isFinite(value.fx) || value.fx <= 0 || value.fx > 1000000) {
      throw new Error('Enter a three-letter currency code, a symbol, and a positive exchange rate up to 1000000.');
    }
    return {enabled:value.enabled,code:value.code,symbol:value.symbol.trim(),fx:value.fx};
  }
  let preference = {...defaults};
  try {const saved=localStorage.getItem(storageKey);if(saved)preference=validate(JSON.parse(saved));} catch {}
  const read = () => ({...preference});
  const convert = pence => Number.isFinite(pence) ? (preference.enabled ? pence / 100 * preference.fx : pence) : null;
  const number = pence => {const value=convert(pence);return value===null?'—':value.toFixed(preference.enabled?4:2);};
  const unit = () => preference.enabled ? `${preference.symbol}/kWh (${preference.code})` : 'p/kWh';
  window.priceDisplay = {
    read, validate, convert, number, unit,
    format:pence=>`${number(pence)} ${unit()}`,
    save(value) {
      const next=validate(value);
      localStorage.setItem(storageKey,JSON.stringify(next));preference=next;
      window.dispatchEvent(new Event('price-display-change'));
    }
  };
})();
