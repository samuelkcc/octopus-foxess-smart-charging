# 🐙🦊 Intelligent Octopus Go & FoxESS Smart Charging Detector

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Hosted on GitHub Pages](https://img.shields.io/badge/Hosted-GitHub%20Pages-success.svg)](https://samuelkcc.github.io/octopus-foxess-smart-charging/)
[![Zero Install](https://img.shields.io/badge/Setup-Zero%20Install-orange.svg)]()

A lightweight, client-side automation bridge that prevents your FoxESS home battery from draining during Intelligent Octopus Go EV charging slots. 

### 🚀 [Launch the Live App Here](https://samuelkcc.github.io/octopus-foxess-smart-charging/)

![Smart Charging Detector Dashboard](Dashboard.png)

---

## ✨ Key Features
* **Zero Installation:** Runs entirely inside your browser via GitHub Pages.
* **Privacy First:** Client-side only. No third-party servers, no telemetry, and local credential encryption.
* **Automated Protection:** Automatically syncs Intelligent Octopus Go smart dispatch intervals with the FoxESS V3 Mode Scheduler.
* **Hardware Safe:** Locks your inverter into "Force Charge" only when needed, preserving battery health and maximizing cheap off-peak rates.

---

## 📖 The Problem & Solution
When **Intelligent Octopus Go** dynamically opens a cheap slot to charge your electric vehicle, your FoxESS solar battery thinks your home is experiencing a massive energy load. If your inverter is left in standard "Self-Use" mode, it will aggressively dump all your stored home battery power straight into your EV. 

This wastes captured solar energy, degrades your battery cells, and misses the opportunity to soak up cheap grid rates. This dashboard pulls your upcoming smart dispatch intervals and acts as a bridge, instructing your FoxESS system to insulate your home battery exactly when the car starts charging.

---

## 🛠️ Getting Started 

Follow these steps in order to get your dashboard up and running. 

### Step 1: Gather Your API Credentials
You need API keys from both providers before starting the app.

**Intelligent Octopus Go:**
1. Log into your standard [Octopus Energy dashboard](https://octopus.energy/dashboard/). Find your **Account Number** at the top (`A-XXXXXXXX`).
2. Go to **Personal Details** ➔ **API Access** (or [click here](https://octopus.energy/dashboard/new/accounts/personal-details/api-access)). Generate your **API Key** (`sk_live_...`).

**FoxESS Cloud:**
1. Find your **Inverter Serial Number (SN)** on the physical unit sticker or right beneath the inverter image in your FoxCloud Mobile App (`60B...`).
2. Log into the [FoxCloud Web Dashboard](https://www.foxesscloud.com/login) (You *cannot* do this in the mobile app).
3. Navigate to **User Profile** ➔ **API Management** to generate and copy your **API Token**.

### Step 2: Open the Dashboard
Navigate to the live application: **[Intelligent Octopus Go & FoxESS Smart Charging Detector](https://samuelkcc.github.io/octopus-foxess-smart-charging/)**

*(If you prefer to run it completely offline, you can download `index.html` from this repository and double-click it to open it natively in your browser).*

### Step 3: Deploy the Proxy Bridge (GAS)
FoxESS cloud servers enforce strict CORS security protocols that block web browsers from making direct API calls. To bypass this for free, we use a private Google Apps Script (GAS).

1. On the app's login screen, click the red **"View Setup Instructions"** button.
2. Follow the on-screen guide to copy the provided routing script.
3. Deploy it as a web app on your Google account.
4. Copy the resulting **Google Web App URL**.

### Step 4: Connect & Monitor
Paste your Octopus credentials, FoxESS credentials, and your new GAS Web App URL into the dashboard and hit connect. 

> 💡 **Pro-Tip: Always-On Dashboard Setup**
> A popular use case is to open the app on a dedicated device, such as a wall-mounted Android tablet, whenever you plug your EV in. If you do this, **ensure you disable your device's screen timeout/auto-lock**. The browser tab must remain active to continuously monitor and sync the charging slots.

---

## 🔒 Security & Privacy
Your security is maintained by design:
* **Zero Third-Party Logging:** This application is a static page. All logic and network requests occur strictly between your browser, your private Google script, and the energy APIs.
* **Local AES-256 Encryption:** Your credentials can be saved locally within your browser's standard `localStorage` wrapper. For safe manual backups, you can download a locally encrypted backup data file.

---

## ⚖️ Legal Disclaimer
This software is an unofficial, community-driven utility. It is entirely independent and has no official affiliation, endorsement, or operational relationship with Octopus Energy Ltd or FoxESS Co., Ltd. Product names, trademarks, and branding belong exclusively to their respective corporate holders. 

Controlling physical battery infrastructure and working with third-party web services introduces natural hardware degradation and rate-limiting risks. By executing this script, you accept full individual liability for system stability, unexpected inverter behaviors, or billing discrepancies. Monitor system logs consistently.

---

## ☕ Support the Project

If this bridge has saved you money, kept your house battery healthy, or simply made your home automation setup easier, consider buying me a coffee to support continued features and updates!

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/samuelchen)
