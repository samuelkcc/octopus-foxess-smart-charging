// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
function doPost(e) {
  function json(value) {
    return ContentService.createTextOutput(JSON.stringify(value))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var request = JSON.parse(e.postData.contents);
    if (request.action === 'capabilities') {
      return json({ relayVersion: 2, octopus: true });
    }
    var url = String(request.url || '');
    var method = String(request.method || 'post').toLowerCase();
    var octopus = /^https:\/\/api\.octopus\.energy\/v1\//.test(url);
    var allowedOctopus = method === 'post'
      ? url === 'https://api.octopus.energy/v1/graphql/'
      : method === 'get' && /^https:\/\/api\.octopus\.energy\/v1\/(accounts\/[A-Za-z0-9_-]+\/|products\/[A-Za-z0-9_-]+\/electricity-tariffs\/[A-Za-z0-9_-]+\/(standard-unit-rates|day-unit-rates|night-unit-rates)\/)(\?[^#]*)?$/.test(url);
    var allowedFox = method === 'post' && /^https:\/\/www\.foxesscloud\.com\/op\/(v0\/device\/(real\/query|setting\/get)|v3\/device\/scheduler\/(get|enable))$/.test(url);
    if (!(octopus && allowedOctopus) && !allowedFox) {
      return json({ errno: 999, msg: 'Unsupported relay target or method.' });
    }
    var options = {
      method: method,
      headers: request.headers || {},
      muteHttpExceptions: true,
      followRedirects: false
    };
    if (method === 'post') {
      options.contentType = 'application/json';
      options.payload = JSON.stringify(request.body);
    }
    var response = UrlFetchApp.fetch(url, options);
    if (!octopus) {
      return ContentService.createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    }
    var headers = response.getAllHeaders();
    var retryAfter = '';
    Object.keys(headers).forEach(function(name) {
      if (name.toLowerCase() === 'retry-after') retryAfter = String(headers[name]);
    });
    var body;
    try { body = JSON.parse(response.getContentText()); }
    catch (_) { body = null; }
    return json({ relayVersion: 2, status: response.getResponseCode(), retryAfter: retryAfter, body: body });
  } catch (_) {
    // Do not return exception text: upstream errors can contain request details.
    return json({ errno: 999, msg: 'Relay request failed. Check the deployment and try again.' });
  }
}
