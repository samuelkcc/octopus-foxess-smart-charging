# Web edition guide

The web edition runs in your browser.
It needs your own Octopus account, FoxESS account, and Google Apps Script relay.
The Pi edition does not need the Google relay.

## Create the relay

- Open [Google Apps Script](https://script.google.com/).
- Create a project.
- Add this code:

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

- Select **Deploy → New deployment**.
- Select **Web app** as the deployment type.
- Set **Execute as** to **Me**.
- Set **Who has access** to **Anyone**.
- Deploy the project.
- Complete the Google permission steps for your account.
- Copy the Web App URL that ends in `/exec`.

The relay runs in your Google account.
It forwards the signed FoxESS requests from this app.

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
