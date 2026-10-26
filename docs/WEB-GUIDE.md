# Web edition guide

The web edition runs in your browser.
It needs your own Octopus account, FoxESS account, and Google Apps Script relay.
The Pi edition does not need the Google relay.

## Create the relay

1. Open [Google Apps Script](https://script.google.com/).
2. Create a project.
3. Add this code:

```javascript
function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: requestData.headers,
      payload: JSON.stringify(requestData.body),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(requestData.url, options);
    return ContentService.createTextOutput(response.getContentText())
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      errno: 999,
      msg: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Select **Deploy → New deployment**.
5. Select **Web app** as the deployment type.
6. Set **Execute as** to **Me**.
7. Set **Who has access** to **Anyone**.
8. Deploy the project.
9. Complete the Google permission steps for your account.
10. Copy the Web App URL that ends in `/exec`.

The relay runs in your Google account.
It forwards the signed FoxESS requests from this app.

## Connect the app

1. Open the hosted app or the downloaded HTML file.
2. Select **Set up Smart Charging**.
3. Enter your Octopus account number and API key.
4. Select **Continue**.
5. Enter your FoxESS inverter serial number and API token.
6. Select **Continue**.
7. Paste the Web App URL into **Google Apps Script Web App URL**.
8. Select **CONNECT**.
9. Check both connection states.

Version 2.0.0 groups these fields into three setup stages.
**Restore a saved setup** opens the existing encrypted import flow.
Its setup guide opens from the side of the screen.
The public interface retains its existing layout until approval.

## Run automation

1. Open **Automations**.
2. Select the required rules.
3. Check the times and charge-level limits.
4. Select **Review & apply** in DEV.
5. Check the review information.
6. Select **Apply changes**.
7. Check the FoxESS schedule.

The public interface uses **Apply Smart Charging** and **Apply Smart Discharging**.
The DEV interface adds a review step before those same engine operations.

The browser must stay open and awake.
Automation stops when the browser closes or the device sleeps.

## Save a backup

1. Open **Settings**.
2. Select **Save configuration**.
3. Enter a backup passphrase.
4. Save the encrypted file.
5. Keep the passphrase in a private location.

The file can contain account credentials.
The passphrase protects that exported copy.

## Restore a backup

1. Open the setup screen.
2. Select **Load Config**.
3. Select the encrypted backup file.
4. Enter its passphrase.
5. Check the connection state.

## Remove saved browser data

1. Open **Settings**.
2. Select **Wipe saved data**.
3. Confirm **Yes, Wipe Data**.

This action clears this browser's local storage, session storage, and app IndexedDB data.
Other browsers and exported backup files are separate copies.

## Update the web edition

The hosted app uses the version published on GitHub Pages.
A downloaded HTML file does not replace itself.

1. Export an encrypted backup before changing browsers or devices.
2. Download the approved new HTML file.
3. Open the new file.
4. If necessary, restore the backup.
5. Check the connection state.

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

1. Open **Overview**.
2. Select **Pause automation**.
3. Select the required period.
4. Confirm the pause.

The browser saves the pause and shows a red banner.
The existing FoxESS schedule stays in place.
Use the FoxESS app to change temporary settings.
History shows pause and resume activity from this browser.
The Pi edition also stores power history.
A timed pause resumes when this browser is open and awake.
The Pi timer runs without an open dashboard.

## Test the redesigned file

The current test file is `Smart_Charging_v2.0.0.html`.
It uses your existing GAS Web App URL.
It includes no account credentials.
The file requires an internet connection for APIs and external script libraries.
The hosted public edition remains unchanged until release approval.

## Check data updates

1. Open **Overview**.
2. Find **Data updates** below the power readings.
3. Check the Octopus and FoxESS countdowns.
4. To request fresh data, select **Update now**.
5. If a red problem button appears, select it.
6. Read the reported problem.
7. After recovery, select **Clear alert**.

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
