# Prepare the FoxESS inverter

Complete this setup before using any edition.

1. Open the inverter **Work Mode** page in the FoxESS app or website.
2. Under **Advanced**, enable **Mode Scheduler**.
3. Open the **Mode Scheduler** settings.
4. Set **Remaining Time Mode** to **Self-Use**.
5. Save the settings.

**Both settings are required for Smart Charging to work as intended.**

Smart Charging uses Mode Scheduler to request Force Charge during relevant EV charging windows.
This prevents Self-Use from supplying that EV load from the home battery.
The design charges the home solar-storage battery alongside the EV during those low-cost periods, subject to your configured limits.

Mode Scheduler applies the periods that Smart Charging programs.
Outside scheduled periods, Remaining Time Mode keeps the inverter in Self-Use.
The current work mode can change during a scheduled period.

Check the actual inverter schedule and battery behaviour after enabling automation.
Use one active automation host for each inverter.

[Choose your setup guide](../README.md#choose-your-setup-guide)
