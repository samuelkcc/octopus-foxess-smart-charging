# Third-party notices

## ESP32 connection-test firmware

The ESP32 prototype uses Espressif ESP-IDF v5.5.2 and its bundled components.
Complete SDK and component licence texts are retained in `esp32/SDK_NOTICES.txt`.
The firmware serves these texts at `/sdk-notices` on its local status page.
ESP-IDF source: https://github.com/espressif/esp-idf/tree/v5.5.2
The browser firmware installer uses the self-hosted esptool-js 0.7.1 bundle under Apache-2.0.
Its complete licence is retained in `prototype/esp32-usb-test/vendor/esptool-LICENSE.txt`.
Bundled pako and atob-lite licence texts are retained in `prototype/esp32-usb-test/vendor/DEPENDENCY_NOTICES.txt`.
These files are copied into the deployment artifact.
esptool-js source: https://github.com/espressif/esptool-js
USB configuration uses browser APIs without uploading credentials.

## FoxESS web-portal signature integration

The optional FoxESS Live WebSocket integration used by the Pi, desktop, and ESP32 editions is adapted from:

- Project: `nicois/foxess-control`
- Copyright: Copyright (c) 2026 Nick Farrell
- Source: https://github.com/nicois/foxess-control
- Licence: MIT

This project gratefully acknowledges Nick Farrell's original work documenting
the FoxESS web-signature and live-telemetry interface.

The adapted portion includes the FoxESS web-signature calling convention and
the `linux/foxess-signature.wasm` asset.
The ESP32 uses a native signature implementation and the adapted read-only telemetry mapping.
The native signature matches fresh instances of that upstream asset in regression tests.

```text
MIT License

Copyright (c) 2026 Nick Farrell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ws

The Raspberry Pi archive bundles `ws` 8.21.1:

- Copyright (c) 2011 Einar Otto Stangvik
- Copyright (c) 2013 Arnout Kazemier and contributors
- Copyright (c) 2016 Luigi Pinca and contributors
- Source: https://github.com/websockets/ws
- Licence: MIT

The complete licence is retained at `node_modules/ws/LICENSE` in the Raspberry
Pi release package.

## Chart.js

Web, Pi and desktop dashboards load Chart.js 4.4.9 from a CDN.
The ESP32 dashboard bundles the same version locally.
Source and licence: https://github.com/chartjs/Chart.js/blob/v4.4.9/LICENSE.md

```text
MIT License

Copyright (c) 2014-2024 Chart.js Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## CryptoJS

Web, Pi and desktop dashboards load CryptoJS 4.1.1 from a CDN.
Source and licence: https://github.com/brix/crypto-js/blob/develop/LICENSE

```text
MIT License

Copyright (c) 2009-2013 Jeff Mott
Copyright (c) 2013-2016 Evan Vosberg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Cloudflare cloudflared

Optional Quick Tunnel support uses the separately installed `cloudflared`
executable from Cloudflare's signed APT repository, licensed under Apache-2.0.
It is not bundled in the HTML file or Pi release archive. Its license and
notices remain in the installed system package.

- Source: https://github.com/cloudflare/cloudflared
- License: https://github.com/cloudflare/cloudflared/blob/master/LICENSE


## Windows desktop edition

The Windows portable edition and ESP32 setup hosts bundle Electron 45.0.0 under the MIT licence.
Electron and Chromium licence files remain beside the application resources.
Source: https://github.com/electron/electron/tree/v45.0.0

The Windows and macOS editions bundle cloudflared 2026.10.4 under Apache-2.0.
The complete licence is included in `desktop-assets/cloudflared-LICENSE.txt`.
The pinned download and SHA-256 digest are recorded in `desktop/vendor.json`.
Source: https://github.com/cloudflare/cloudflared/tree/2026.10.4

## ESP32 dashboard charts

The ESP32 dashboard bundles Chart.js 4.4.9, matching the existing web edition.
Source: https://github.com/chartjs/Chart.js/tree/v4.4.9
The pinned file and integrity digest are recorded in `esp32/dashboard/vendor/manifest.json`.

```text
The MIT License (MIT)

Copyright (c) 2014-2024 Chart.js Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

```

## Electron

Electron 45.0.0 supplies the desktop host and native ESP32 setup window.
It includes Chromium and Node.js. Their complete notices remain in the native runtime package.
Source: https://github.com/electron/electron/tree/v45.0.0

```text
Copyright (c) Electron contributors
Copyright (c) 2013-2020 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

```
