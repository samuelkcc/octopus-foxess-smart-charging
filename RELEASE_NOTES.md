# Smart Charging v2.0.2

This patch adds optional Safari compatibility to the standalone web edition.

## Changes

- Setup and Settings include an Octopus connection selector.
- The in-app guide includes **Copy relay code** and steps to update an existing deployment.
- Compatibility mode sends Octopus sign-in, charging-window, account, and tariff requests through your own Google relay.
- Direct connection remains the default for existing setups.
- The selected method stays in saved browser setup and encrypted backups.
- A capability check detects an old relay before forwarding Octopus credentials.
- The updated relay restricts targets and methods and does not follow upstream redirects.
- Octopus HTTP status and Retry-After values reach the existing browser rate-limit policy.
- Pi and Windows retain their existing host transport.

## Update your Google relay

- Open your existing Apps Script project.
- Replace its code with the code in the [web guide](https://github.com/samuelkcc/octopus-foxess-smart-charging/blob/v2.0.2/docs/WEB-GUIDE.md#create-the-relay).
- Save the project.
- Select **Deploy → Manage deployments → Edit → New version → Deploy**.
- Keep the existing Web App URL.
- In Smart Charging, open **Modify setup → 3. Google relay**.
- Select **Safari compatibility — my Google relay**.
- Select **Connect**.

Google processes Octopus credentials and data when this option is selected.
Use only your own Google relay.
Saving Apps Script source alone does not update the deployed Web App.

## Documentation

- The repository overview focuses on functions and setup. Version-specific changes stay on the release download pages.
- The Safari setup image no longer includes viewport diagnostics or the local test strip.
- Pi removal instructions explain the command, deleted local data, and retained inverter schedule.

## Verification

Removal instructions were checked against the script.
The uninstaller was not executed.
The full regression suite passes with mock upstream APIs.
Tests cover relay redirects, Octopus GET/POST, old-code detection, real rate-limit propagation, and unchanged FoxESS command safeguards.
No test sends a command to a live inverter.
Safari received a readable HTTP 200 Octopus reply through the updated personal GAS deployment.
An invalid demonstration key was rejected as expected.
No real account credentials were used in that check.
Native Windows execution of this patch remains a user check.
