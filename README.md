# Octopus & FoxESS Smart Charging Detector

🚀 **Live App:** [https://samuelkcc.github.io/octopus-foxess-smart-charging/](https://samuelkcc.github.io/octopus-foxess-smart-charging/)

A lightweight, zero-install smart automation bridge to prevent FoxESS home batteries from draining during Intelligent Octopus Go EV charging slots.

![Smart Charging Detector Dashboard](Dashboard.png)

## ℹ️ The Problem & The Solution
When *Intelligent Octopus Go* dynamically opens a cheap slot to charge your electric vehicle, your FoxESS solar battery thinks your home is experiencing a massive energy load. If your inverter is left in standard "Self-Use" mode, it will aggressively dump all your stored home battery power straight into your EV. This wastes your captured solar energy, degrades your battery cells, and misses the opportunity to soak up cheap off-peak rates.

This standalone web tool acts as a private automation bridge. It pulls upcoming smart dispatch intervals via your Octopus account and syncs them directly with your FoxESS inverter using the robust V3 Mode Scheduler API. Your system automatically locks into **Force Charge** exactly when the car starts drinking cheap grid power, completely insulating your home battery.

---

## 🔑 Credentials Guide: Where to Find Your API Info

Before launching the app, you will need to gather 4 specific pieces of information:

### 1. 🐙 Octopus Energy Credentials
* **Account Number:** Log into your standard Octopus Energy dashboard. Your account number is at the top of the page and usually starts with `A-XXXXXXXX`.
* **API Key:** Go to your account profile page, click on **Personal Details**, and scroll down to **API Access** (or go directly to `octopus.energy/dashboard/new/accounts/personal-details/api-access`). Click generate to get your secret key starting with `sk_live_...`.

### 2. 🦊 FoxESS Cloud Credentials
* **Inverter Serial Number (SN):** You can find this on a physical sticker on the side of your inverter, or open your **FoxCloud Mobile App**, tap **Device**, and look directly below the inverter image. It typically starts with a code like `60B...`.
* **API Token:** You *cannot* generate this from the mobile app. You must log into the official **FoxCloud V1 Web Dashboard** at `www.foxesscloud.com/login`. Once logged in, go to **User Profile** ➔ **API Management** to generate and copy your API Token.

---

## 🚀 Detailed Setup Guide

### 1. Launch the Web App
Because this application runs entirely client-side for absolute privacy, there is no software to install. 
1. Simply navigate to the live dashboard here: **[Launch Octopus & FoxESS Smart Charging Detector](https://samuelkcc.github.io/octopus-foxess-smart-charging/)**
2. *(Optional)* If you prefer to run it offline, you can download `index.html` from this repository and run it locally in your browser.

💡 **Always-On Dashboard Use Case:** A popular setup is to open the live app (or the local HTML file) on a dedicated device, such as an Android tablet, when you plug your EV charger in. **Be sure to turn off your device's screen timeout/lock** so the browser remains active and can continuously monitor and sync the charging slots.

### 2. Deploy Your Google Apps Script Proxy (Required)
FoxESS cloud servers enforce strict browser security protocols (CORS restrictions) which explicitly block standalone web pages from sending direct network requests. 

To easily bypass this without configuring an expensive server, we use a short, private Google Apps Script relay. 

1. Launch the [live web app](https://samuelkcc.github.io/octopus-foxess-smart-charging/) in your browser.
2. Click the red **"View Setup Instructions"** button inside the setup guide panel.
3. Follow the steps displayed to copy your private routing script and deploy it as a web app.
4. Paste your generated Google Web App URL into the app login screen along with your cloud credentials.

---

## 🔒 Security, Privacy & Local Storage
Your security is maintained by design:
* **Zero Third-Party Logging:** This application is served as a static GitHub Page and does not transmit data to any tracking networks or external servers. All logic occurs locally in your personal browser tab.
* **Local Encryption:** Your credentials can be saved locally within your browser's standard `localStorage` wrapper. For safe manual backups, you can download a locally encrypted backup data file protected by AES-256 standard encryption.

---

## ⚖️ Legal Disclaimer
This software is an unofficial, community-driven utility. It is entirely independent and has no official affiliation, endorsement, or operational relationship with Octopus Energy Ltd or FoxESS Co., Ltd. Product names, trademarks, and branding belong exclusively to their respective corporate holders. 

Controlling physical battery infrastructure and working with third-party web services introduces natural hardware degradation and rate-limiting risks. By executing this script, you accept full individual liability for system stability, unexpected inverter behaviors, or billing discrepancies. Monitor system logs consistently.

Licensed globally under the **GNU General Public License v3.0**.

---

## Support the Project ☕

If this Octopus & FoxESS bridge has saved you money, kept your house battery healthy, or simply made your home automation setup easier, consider buying me a coffee to support continued features and updates!

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/samuelchen)
