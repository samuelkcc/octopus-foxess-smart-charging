# Source backup, recovery, and disk housekeeping

[Back to project](../README.md)

## What GitHub preserves

The [GitHub repository](https://github.com/samuelkcc/octopus-foxess-smart-charging) stores the application source, documentation, artwork, screenshots, tutorial video, licence texts, tests, and build scripts.
The source includes the web, Pi, Windows Portable, macOS, and ESP32 editions.
The `main` branch is the maintenance branch.
Release tags preserve earlier source versions.

Required local assets include `src/icons/`, `Image/`, `docs/screenshots/`, `docs/tutorial/`, and the vendored JavaScript and WebAssembly files.
These assets are ordinary Git files. They do not use Git LFS or external file links.
The ESP32 USB installer also requires `prototype/esp32-usb-test/`.
Despite its directory name, this installer source remains necessary.

Generated downloads are separate from source backup.
The [GitHub releases](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases) retain published firmware, setup tools, and application downloads.
The frozen OTA record identifies the reviewed firmware binary.
A new compilation does not guarantee an identical binary digest.

## What needs a separate private backup

GitHub does not preserve installed account credentials, access keys, browser storage, device settings, or device History.
The Pi data directory is `/var/lib/octopus-foxess`.
Computer editions and ESP32 store their own configuration and observations outside the tracked application source.

Local diagnostics, private review screenshots, and tutorial production working files are intentionally excluded from Git.
The published tutorial, captions, narration text, and chapters are tracked.
Rebuilding the application does not require the excluded video production environment.
Recreating that production environment requires a separate private backup.

1. Store account credentials in a password manager.
2. Store GitHub recovery codes separately from this computer.
3. Before replacing a running host, export its supported settings and History.
4. Keep private backups outside this source directory.

## Recover the application source

Use Node.js 22 or later, npm, Git, Python 3, and a C compiler.
On macOS, the Xcode Command Line Tools provide the compiler.
On Linux, the compiler must support C11.
Dependency recovery requires internet access to GitHub, npm, and official tool suppliers.

1. Clone the repository:

```sh
git clone https://github.com/samuelkcc/octopus-foxess-smart-charging.git
```

2. Open the cloned directory:

```sh
cd octopus-foxess-smart-charging
```

3. Install the locked application dependencies:

```sh
npm ci
```

4. Prepare the pinned native test dependencies:

```sh
sh scripts/prepare-esp32-tests-ci.sh
```

5. Run the complete checks:

```sh
npm run check
```

6. Build and verify the shared interfaces:

```sh
npm run build:dev
```

The checks use mocks and temporary local servers.
They require permission to open localhost sockets.
They do not require account credentials or inverter commands.
The native dependency preparation uses a sparse ESP-IDF checkout for tests.
That checkout is not a complete firmware development environment.

## Build additional editions

| Output | Build instructions |
|---|---|
| Web HTML and Pi package | `npm run check` builds both outputs. |
| Shared DEV interfaces | `npm run build:dev` |
| ESP32 firmware | Install full ESP-IDF v5.5.2. Follow [ESP32 Build](../esp32/README.md#build). |
| ESP32 firmware with Docker | `sh scripts/build-esp32-firmware-ci.sh` uses `espressif/idf:v5.5.2`. |
| USB deployment website | After firmware exists, run `npm run build:esp32-deploy`. |
| ESP32 setup apps | Follow [setup app Build](../esp32/desktop/README.md#build). |
| Windows Portable | Install locked desktop dependencies with `npm ci --prefix desktop`. Run `npm run build:desktop`. |
| macOS host | Install locked desktop dependencies with `npm ci --prefix desktop`. Run `npm run build:mac` on macOS. |
| GitHub Pages files | After building the interfaces and USB website, run `npm run build:pages`. |

ESP-IDF, Electron, cloudflared, and their platform tools are external dependencies.
Version records and lockfiles identify their required versions.
The repository does not contain complete offline copies of those development tools.
The GitHub workflows provide clean build recipes for supported hosts.
Building locally does not publish a release or operate hardware.

## Keep GitHub Desktop synchronised

1. In GitHub Desktop, select **octopus-foxess-smart-charging**.
2. Select the `main` branch.
3. Before editing, select **Fetch origin**.
4. If updates are available, select **Pull origin**.
5. After editing, review the changed files.
6. Commit the intended changes.
7. Select **Push origin**.
8. On GitHub, check that `main` shows the new commit.

A local commit alone is not an off-computer backup.
Ignored files do not appear in the normal commit list.
Release tags are historical records, not additional development branches.

## Remove obsolete packaging copies

Packaging retains previous `dist/` contents under `.build/artifacts-*`.
Repeated packaging can accumulate large duplicate archives.
Versioned setup copies and release staging directories can also accumulate.
These directories contain generated products, not maintenance source.
Store authored source and private backups elsewhere.

1. Before cleanup, stop active builds and packaging tasks.
2. Preview the obsolete archive list:

```sh
npm run clean:archives
```

3. Review the displayed paths and total allocated size.
4. Remove the listed archives:

```sh
npm run clean:archives -- --apply
```

The command preserves `dist/`, Git history, source, documentation, dependencies, SDKs, firmware builds, and unknown working directories.
It preserves release and setup staging directories for the current package version and newer versions.
It refuses tracked archives and a linked `.build` directory.
It skips archive-directory links.
It only removes recognised obsolete packaging directories after `--apply` is supplied.
Packaging does not run this cleanup automatically.
Run the preview after packaging sessions to control disk growth.

Do not delete the complete `.build/` directory without reviewing its contents.
This checkout contains local SDK files, diagnostic records, and tutorial working files there.

## Verification record: 18 November 2026

The original source commit was `9b2f5cd21cae9776cf3aa517c884cbac8cf53a13`, version 2.5.6.
All 332 tracked files were present in the live GitHub tree.
No tracked asset used Git LFS or a symbolic link.
GitHub authentication and repository access succeeded.
GitHub Desktop fetched the repository and displayed the same commit on `main`.

Four extra local branches and their GitHub branches contained no commits outside `main`.
They were removed after ancestry checks and remote revision checks.
Only `main` remains as a development branch.
Release tags remain available.

A fresh GitHub clone installed locked npm dependencies and downloaded pinned native test dependencies.
That clone passed `npm run check` and `npm run build:dev` without borrowing this checkout's build directories.
The [GitHub build](https://github.com/samuelkcc/octopus-foxess-smart-charging/actions/runs/43458775513) independently passed the same checks and built the ESP32 deployment website.
Published 2.5.6 release assets were confirmed on GitHub.

Cleanup selected 69 obsolete packaging directories using 58.18 GiB of allocated disk space.
Current downloads, current version archives, the local SDK, tutorial working files, and private diagnostics were retained.
The resulting checkout uses approximately 10.9 GB, including approximately 7.7 GB for the retained SDK environment.
All tracked file hashes matched their pre-cleanup values after archive deletion.

Local Time Machine snapshots were present during verification.
Deleted files can remain in those snapshots until macOS expires them.
The folder size reduction does not guarantee an immediate equal increase in free disk space.
No Time Machine snapshot was removed.

Native desktop packaging and physical device operation were not repeated during this audit.
This verifies application source recovery with downloadable dependencies.
It does not verify restoration of private credentials, live History, or an entirely offline development environment.
