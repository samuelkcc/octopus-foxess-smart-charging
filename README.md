# Octopus & FoxESS Smart Charging Detector

A smart automated bridge to stop FoxESS home batteries from draining during Intelligent Octopus Go EV charging slots.

## ℹ️ Overview & Purpose
When *Intelligent Octopus Go* smartly charges your EV, your FoxESS solar battery thinks your house is using massive amounts of power. If left in "Self-Use" mode, it will completely drain your home battery trying to cover the EV load. This tool automatically detects upcoming cheap EV charging slots and switches your FoxESS inverter to **Force Charge**, protecting your home battery's lifespan and soaking up cheap off-peak rates.

## 🚀 Setup Instructions

### 1. Download the App
* Click on `Octoups_IGO_Smart_Charing_Detector.html` in this repository.
* Click the **Download raw file** button (top right of the file view) to save it to your computer.
* Double-click the downloaded file to open it in any web browser.

### 2. Create Your Google Apps Script Relay (Required)
Because FoxESS explicitly blocks direct browser connections via CORS restrictions, you need a free Google Script to route requests securely.
1. Go to [script.google.com](https://script.google.com) and click **New Project**.
2. Paste the snippet provided in the app's **"View Setup Instructions"** modal.
3. Click **Deploy** > **New deployment** > Select type **Web app**.
4. Set *Execute as* to **Me** and *Who has access* to **Anyone**. 
5. Copy the generated Web App URL and paste it into the app login screen.

## ⚖️ License & Disclaimer
This is an unofficial, independent tool. It is not affiliated with, endorsed by, or supported by Octopus Energy Ltd or FoxESS Co., Ltd. 

Distributed under the **GNU General Public License v3.0**. Use at your own risk.
