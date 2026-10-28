# Third-party notices

## FoxESS web-portal signature integration

The Raspberry Pi edition's optional experimental FoxESS Live WebSocket
telemetry is adapted from:

- Project: `nicois/foxess-control`
- Copyright: Copyright (c) 2026 Nick Farrell
- Source: https://github.com/nicois/foxess-control
- Licence: MIT

This project gratefully acknowledges Nick Farrell's original work documenting
the FoxESS web-signature and live-telemetry interface.

The adapted portion includes the FoxESS web-signature calling convention and
the `linux/foxess-signature.wasm` asset.

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

Both editions load Chart.js 4.4.9 from a CDN.
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

Both editions load CryptoJS 4.1.1 from a CDN.
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

The Windows portable edition bundles Electron 45.0.0 under the MIT licence.
Electron and Chromium licence files remain beside the application resources.
Source: https://github.com/electron/electron/tree/v45.0.0

The Windows and macOS editions bundle cloudflared 2026.10.4 under Apache-2.0.
The complete licence is included in `desktop-assets/cloudflared-LICENSE.txt`.
The pinned download and SHA-256 digest are recorded in `desktop/vendor.json`.
Source: https://github.com/cloudflare/cloudflared/tree/2026.10.4
