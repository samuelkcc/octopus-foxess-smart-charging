# Web edition guide

The web edition runs in your browser.
It needs your own Octopus account, FoxESS account, and Google Apps Script relay.

## Prepare the FoxESS app

- Open your inverter's **Work Mode** page.
- Under **Advanced**, enable **Mode Scheduler**.
- Open its settings.
- Set **Remaining Time Mode** to **Self-use**.
- Save the settings.

Mode Scheduler applies the periods that Smart Charging programs.
Outside scheduled periods, the inverter uses **Self-use**.

The Pi edition does not need the Google relay.

## Create the relay

- Open [Google Apps Script](https://script.google.com/).
- Create a project.
- Add this code:

The [relay source download](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/latest/download/Smart_Charging_Google_Relay.gs) contains the same code.

```javascript
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
```

- Select **Deploy → New deployment**.
- Select **Web app** as the deployment type.
- Set **Execute as** to **Me**.
- Set **Who has access** to **Anyone**.
- Deploy the project.
- Complete the Google permission steps for your account.
- Copy the Web App URL that ends in `/exec`.

The relay runs in your Google account.
It forwards the signed FoxESS requests from this app.
Safari compatibility mode also forwards Octopus requests through this relay.
Google processes the credentials and data in those requests.
Use only a relay that you own.

## Update an existing relay

- In Smart Charging, open **Create or update the relay** from the Google relay setup stage.
- Select **Copy relay code**.
- Open your existing Apps Script project.
- Replace its code with the code above.
- Save the project.
- Select **Deploy → Manage deployments**.
- Select your existing Web App deployment.
- Select **Edit → New version → Deploy**.
- Keep the same `/exec` URL in Smart Charging.

Saving source code alone does not update a deployed Web App.
Editing the existing deployment keeps its URL.
Creating another deployment gives you another URL.

## Safari compatibility mode

Safari can reject Octopus's direct connection before sign-in finishes.
Compatibility mode sends those requests through your own Google relay.
It uses the same relay URL as FoxESS.
Pi and Windows use their own host service and do not need this mode.

- Update your relay with the code above.
- Open **Modify setup** from Welcome.
- Select **3. Google relay**.
- Select **Safari compatibility — my Google relay** under **Octopus connection**.
- Select **Connect**.

Settings also includes **Octopus connection → Save connection method**.
The selected method stays in saved browser setup and encrypted configuration backups.
Existing configurations continue to use direct connection until you change this option.
The app checks relay support before forwarding Octopus credentials.
An old deployment shows an update instruction instead of attempting unsupported requests.
Actual API rate limits still apply through the relay.

## Connect the app

- Open the hosted app or the downloaded HTML file.
- Select **Set up Smart Charging**.
- Enter your Octopus account number and API key.
- Select **Continue**.
- Enter your FoxESS inverter serial number and API token.
- Select **Continue**.
- Paste the Web App URL into **Google Apps Script Web App URL**.
- Select **CONNECT**.
- Check both connection states.

Version 2.0.0 groups these fields into three setup stages.
**Restore a saved setup** opens the existing encrypted import flow.
Its setup guide opens from the side of the screen.

On later visits, Welcome shows **Connect** when the browser restores your saved setup.
**Modify setup** opens the three setup stages when you need to change a value.
Restoring saved setup does not automatically contact the APIs.

Normal web login has no added 60-second cooldown.
If Octopus returns a rate limit, the app waits before another request.
The connection screen shows that remaining wait.
Routine refresh still has a 60-second minimum.

## Run automation

- Open **Automations**.
- Select the required rules.
- Check the times and charge-level limits.
- Select **Review & apply**.
- Check the review information.
- Select **Apply changes**.
- Check the FoxESS schedule.

The review step summarizes changes before the existing scheduler applies them.

The browser must stay open and awake.
Automation stops when the browser closes or the device sleeps.

## Save a backup

- Open **Settings**.
- Select **Save configuration**.
- Enter a backup passphrase.
- Save the encrypted file.
- Keep the passphrase in a private location.

The file can contain account credentials.
The passphrase protects that exported copy.

## Restore a backup

- Open the setup screen.
- Select **Load Config**.
- Select the encrypted backup file.
- Enter its passphrase.
- Check the connection state.

## Remove saved browser data

- Open **Settings**.
- Select **Wipe saved data**.
- Confirm **Yes, Wipe Data**.

This action clears this browser's local storage, session storage, and app IndexedDB data.
Other browsers and exported backup files are separate copies.

## Update the web edition

The hosted app uses the version published on GitHub Pages.
A downloaded HTML file does not replace itself.

- Export an encrypted backup before changing browsers or devices.
- Download the approved new HTML file.
- Open the new file.
- If necessary, restore the backup.
- Check the connection state.

## If a connection fails

| State | Check |
|---|---|
| Octopus rejects the request | Check the account number and API key. |
| FoxESS rejects the request | Check the serial number and API token. |
| The relay fails | Check the deployment access and `/exec` URL. |
| Data stops changing | Check that the browser and device remain awake. |
| No export price appears | Check that the account has an active export tariff. |

The Pi-only history store is not part of the standalone web edition.
The app's About & License panel contains the complete GPL and component notices.

## Pause browser automation

- Open **Overview**.
- Select **Pause automation**.
- Select the required period.
- Confirm the pause.

The browser saves the pause and shows a red banner.
The existing FoxESS schedule stays in place.
Use the FoxESS app to change temporary settings.
History shows pause and resume activity from this browser.
The Pi edition also stores power history.
A timed pause resumes when this browser is open and awake.
The Pi timer runs without an open dashboard.

## Downloaded file

The current test file is `Smart_Charging_v2.0.0.html`.
It uses your existing GAS Web App URL.
It includes no account credentials.
The file requires an internet connection for APIs and external script libraries.
The hosted app and downloaded file use the same interface.

## Check data updates

- Open **Overview**.
- Find the Octopus and FoxESS health badges in the header.
- Check their circular interval progress.
- To request fresh data, select the related badge.
- If a red problem button appears, select it.
- Read the reported problem.
- After recovery, select **Clear alert**.

The red button remains after recovery until you clear it.
An active failure cannot be cleared as healthy.
The last successful update time remains visible during a failure.
A power value of `0.00 kW` means measured zero.
A value of `--` means the required measurement is unavailable.
Data refresh does not cancel an automation pause.

FoxESS power data passes through your configured GAS relay.
Grid and battery power require their corresponding variables in the FoxESS response.
The new file requests those variables with solar, home power, and charge level.
The browser must remain open and awake for countdowns and automation.

## Identify a connection failure

The welcome screen identifies Octopus sign-in, Octopus data, or FoxESS relay requests.
An Octopus error selects the Octopus setup step.
A network error means the browser did not receive a readable response.
It does not prove that your credentials are wrong.

1. Check the service named in the message.
2. If Octopus reports a rate limit, wait for the displayed cooldown.
3. If a network error remains, try another browser or network.
4. If the relay returns a sign-in page, check its deployment access.

A working Windows host can reuse an existing token while a browser needs a new login.
Do not repeatedly select Connect during an API cooldown.

### Safari preflight rejection

During a Safari check, Octopus rejected the browser preflight with HTTP 403.
The app could not receive an authentication response.
The user confirmed that Chrome and the Windows host could connect.
Content blockers did not explain the isolated failure.
The app reports the affected Octopus request instead of displaying a generic GAS error.
This patch does not claim to resolve the upstream Safari rejection.

## Display another currency

1. Open **Settings → Price display**.
2. Enable **Use a custom display currency**.
3. Enter the currency code.
4. Enter its display symbol.
5. Enter the manual exchange rate against one GBP.
6. Select **Save price display**.

Overview prices and tariff charts use this browser preference.
Rule inputs remain in UK p/kWh, with a converted reference value beside each input.
This setting does not support accounts from other Octopus countries.
No GAS update is required for currency display or the new diagnostics.
Host snapshot recovery and LAN tunnel management apply only to Pi and Windows hosts.
