# 🐙🦊 Intelligent Octopus Go & FoxESS Smart Charging Detector

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Hosted on GitHub Pages](https://img.shields.io/badge/Hosted-GitHub%20Pages-success.svg)](https://samuelkcc.github.io/octopus-foxess-smart-charging/)
[![Zero Install](https://img.shields.io/badge/Setup-Zero%20Install-orange.svg)]()

A lightweight, zero-install automation bridge that prevents your FoxESS home battery from draining during Intelligent Octopus Go EV charging slots. 

### 🚀 [Launch the Live App Here](https://samuelkcc.github.io/octopus-foxess-smart-charging/)

![Smart Charging Detector Dashboard](Dashboard.png)

---

## 📖 The Problem & Solution
When **Intelligent Octopus Go** dynamically opens a cheap slot to charge your electric vehicle, your FoxESS solar battery assumes your home is experiencing a massive energy spike. If left in standard "Self-Use" mode, your inverter will aggressively dump all your stored home battery power straight into your EV. 

This wastes captured solar energy, degrades your battery cells, and misses the opportunity to soak up cheap grid rates. This dashboard pulls your upcoming smart dispatch intervals and acts as a bridge, instructing your FoxESS system to insulate your home battery exactly when the car starts charging.

---

## ⚡ The Home Assistant (HA) Alternative
For many, optimizing smart charging means diving into a full home automation ecosystem. While Home Assistant is incredibly powerful, it comes with a steep learning curve for beginners—requiring you to understand complex concepts like entity IDs, YAML configurations, state triggers, and custom HACS integrations just to get a basic sync working.

**This tool offers a streamlined, instant alternative:**
* **Instant Deployment:** Works out of the box in under 30 minutes without any complex configuration setups.
* **Leverage Existing Hardware:** There is no need to set up a dedicated home automation server or manage Docker containers. You can run this dashboard directly on an old Android tablet, an existing Raspberry Pi 4/5, or any browser-enabled device you already own.
* **Zero Configuration Hassle:** Skip the steep learning curve of automation logic and entity mapping. Just paste your credentials, and the bridge safely handles the rest.

---

## ✨ Key Features & What's New
* **Zero Installation:** Runs entirely inside your web browser via GitHub Pages or as a downloaded local file.
* **Privacy First:** Client-side architecture. No third-party servers, no telemetry, and local credential encryption.
* **Automated Protection:** Automatically syncs Intelligent Octopus Go smart dispatch intervals with your FoxESS V3 Mode Scheduler.
* **Tablet Optimized (New!):** Built-in **Full Screen Mode** and an automated **Screen Saver (Blank Screen)** utility—perfect for dedicated Android wall tablets and low-power displays. 
* **Hardware-Level Safety:** Pushes native V3 Hardware Limits (Target SOC, Max Charge Power, Min SOC) directly to the inverter, ensuring failsafe battery protection.
* **Smart API Quota Management:** Built-in caching system throttles requests to ensure you never breach the strict FoxESS 1,440 daily API call limit.
* **Live Telemetry:** Real-time, expandable dashboard showing live PV Power, Home Load, Battery Temperature, and Ambient Temperature.
* **Auto-Resume:** Automatically ends grid-charging schedules early and reverts to Self-Use mode once your custom Target SOC is reached.
* **Weekly Forced Charge:** Create a fixed Force Charge window (including overnight schedules such as 23:30–05:30) and select the weekdays when it runs.

---

## 🛠️ Getting Started 

Follow these steps to get your dashboard up and running. 

### Step 1: Gather Your API Credentials
You need API keys from both providers before starting the app.

#### Octopus Energy
1. Log into your standard [Octopus Energy dashboard](https://octopus.energy/dashboard/). Find your **Account Number** at the top (`A-XXXXXXXX`).
2. Go to **Personal Details** ➔ **API Access** (or [click here](https://octopus.energy/dashboard/new/accounts/personal-details/api-access)). Generate your **API Key** (`sk_live_...`).

#### FoxESS Cloud
1. Find your **Inverter Serial Number (SN)** on the physical unit sticker or beneath the inverter image in your FoxCloud Mobile App (`60B...`).
2. Log into the [FoxCloud Web Dashboard V1](https://www.foxesscloud.com/login). 
   > ⚠️ **Important:** The API token *cannot* be obtained from the V2 website or mobile app. If redirected to V2, click your user profile, scroll to the bottom, and switch back to V1.
3. Navigate to **User Profile** ➔ **API Management** to generate and copy your **API Token**.

---

### Step 2: Deploy the Proxy Bridge (Google Apps Script)
Because FoxESS blocks direct browser connections (CORS), we use a free Google Apps Script to securely route your requests.

#### A. Create the Script
1. Go to [script.google.com](https://script.google.com/) and sign in with your Google account.
2. Click **New Project** (top left).
3. Delete any placeholder code and paste the exact snippet below:

```javascript
function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': requestData.headers,
      'payload': JSON.stringify(requestData.body),
      'muteHttpExceptions': true
    };
    var response = UrlFetchApp.fetch(requestData.url, options);
    return ContentService.createTextOutput(response.getContentText())
                                 .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ errno: 999, msg: err.toString() }))
                                 .setMimeType(ContentService.MimeType.JSON);
  }
}
```

#### B. Deploy as a Web App
1. Click the blue **Deploy** button in the top right corner, then select **New deployment**.
2. Click the **Gear icon** next to "Select type" and choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone** *(This is crucial for the connection to work)*.
5. Click **Deploy** and copy the generated **Web app URL** to your clipboard.

### Step 3: Open the Dashboard
Navigate to the live application: **[Intelligent Octopus Go & FoxESS Smart Charging Detector](https://samuelkcc.github.io/octopus-foxess-smart-charging/)**

*(If you prefer to run it locally rather than hosting it on GitHub Pages, you can download `index.html` from this repository and double-click it to open it natively in your browser. Please note that an active internet connection is still required to communicate with the APIs).*

### Step 4: Launch the App
Paste your Octopus credentials, FoxESS credentials, and your new Google Apps Script Web App URL directly into the dashboard configuration fields and click **Connect**. 

> ⚠️ **CRITICAL: Single Device Operation**
> **Do not run this dashboard on multiple devices simultaneously.** The FoxESS API enforces strict connection limits. Having the app actively running on more than one device at the same time will cause API communication errors, trigger rate-limiting, and ultimately break the automated mode selection updates for your battery.

> 💡 **Pro-Tip: Always-On Dashboard Setup**
> A popular use case is to open the app on a single dedicated device, such as a wall-mounted Android tablet, whenever you plug your EV in. If you do this, **ensure you disable your device's screen timeout/auto-lock**. The browser tab must remain active to continuously monitor and sync the charging slots.

---

## 🔒 Security, Privacy & Data Management
Your security is maintained by design:
* **Zero Third-Party Logging:** This application is a static page. All logic and network requests occur strictly between your browser, your private Google script, and the energy APIs.
* **Encrypted Browser Storage:** After a successful connection, credentials are encrypted with a non-exportable AES-GCM device key before persistent browser storage. If secure persistent storage is unavailable, credentials are retained for the current browser session only.
* **Wipe Data Feature:** If you are using a shared device or simply want to clean up, you can use the built-in "Wipe Data" button. This will instantly and permanently erase all saved credentials, API keys, and Web App URLs from your browser's local storage.
* **Manual Backups:** For safe manual backups, you can download a locally encrypted backup data file.
* **Password-Protected Backups:** Exported configuration files use the password entered during export and must be kept private.

---

## 🧑‍💻 Development and Builds

The maintainable source is split by responsibility:

```text
src/
  index.html     App markup
  styles.css     App styles
  app.js         App behaviour and API integrations
scripts/
  build.mjs      Creates the standalone SPA
prototype/       Original single-file app retained as a reference
dist/            Generated build output (not committed)
```

Node.js 18 or newer is required. There are currently no third-party npm packages to install.

```bash
npm run check
npm run build
```

The build creates `dist/Octopus_IGO_Smart_Charging_Detector.html`. Edit the files in `src/`, not the generated file in `dist/`.

Pushes to `main` are checked and deployed by the GitHub Pages workflow. In **Settings → Pages**, select **GitHub Actions** as the source.

---

## ⚖️ Legal Disclaimer
This software is an unofficial, community-driven utility. It is entirely independent and has no official affiliation, endorsement, or operational relationship with Octopus Energy Ltd or FoxESS Co., Ltd. Product names, trademarks, and branding belong exclusively to their respective corporate holders. 

Controlling physical battery infrastructure and working with third-party web services introduces natural hardware degradation and rate-limiting risks. By executing this script, you accept full individual liability for system stability, unexpected inverter behaviors, or billing discrepancies. Monitor system logs consistently.

---

## ☕ Support the Project

If this bridge has saved you money, kept your house battery healthy, or simply made your home automation setup easier, consider buying me a coffee to support continued features and updates!

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/samuelchen)
