# Documentation rules

The project uses ASD-STE100 Issue 9 as its writing reference.
The [official specification](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf) contains the writing rules and dictionary.
The [official download page](https://asd-ste100.org/STE_downloads.html) provides current issue information.

These project rules support an STE review.
A sentence-length check does not prove compliance with the complete specification.
The official dictionary defines approved words, meanings, and parts of speech.

## Write procedures

1. Use command sentences.
2. Give one instruction in each sentence.
3. Put the steps in the order of operation.
4. Put a necessary condition before the instruction.
5. Use a maximum of 20 words in each instruction sentence.
6. Use notes for information, not required actions.

## Write descriptions

1. Give one subject in each sentence.
2. Use a maximum of 25 words in each sentence.
3. Give each paragraph one topic.
4. Use no more than six sentences in each paragraph.
5. Use the same term for the same item.
6. Check technical terms against the list below.

## Project terms

| Term | Meaning |
|---|---|
| Pi | The Raspberry Pi that runs the installed service. |
| web edition | The standalone app that runs in a browser. |
| dashboard | The interface that displays data and accepts deliberate changes. |
| worker | The single Pi browser process that runs unattended automation. |
| Smart Dispatch | A charging window supplied by Octopus Energy. |
| LAN access code | The optional code for dashboard access on the local network. |
| Remote Access Key | The separate key for access through the public tunnel. |
| browser session | The temporary login on one remote browser. |
| public URL | The address that Cloudflare assigns to a Quick Tunnel. |
| official REST readback | The FoxESS response used to check the written schedule. |
| telemetry | Measurements of power, charge level, and device state. |
| history interval | A 15-minute group of observed measurements. |
| DEV | The development version used for review on the Pi. |

The terms in this table identify software and energy-system items.
This table is a project terminology record, not a replacement for the STE dictionary.

## Review a document

1. Check the instructions against the current interface.
2. Check each command against the current code.
3. Check sentence length.
4. Check the approved meaning of each general word.
5. Check product names and interface labels.
6. Check that each condition comes before its related action.
7. Check that no technical fact changed during the rewrite.

Keep source code, API field names, URLs, and command options exact.
Keep the GPL text and third-party licence texts unchanged.
Do not describe a document as certified or fully compliant without a complete review.
