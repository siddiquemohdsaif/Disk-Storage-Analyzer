# Disk Storage Analyser

Disk Storage Analyser is a Windows-friendly Electron desktop app for finding the files and folders taking up the most space on a selected drive or directory. It scans locally, ranks results by size, and gives you quick actions for opening locations or moving unwanted items to the Recycle Bin.

## Current Features

- Native folder or drive picker when the app starts.
- Scan any selected directory, including drive roots such as `C:\`.
- Separate ranked tables for folders and files.
- Folder results can be viewed as a nested tree or a flat size-ranked list.
- Folder and file results can sort by size or newest created date.
- Expand folders in nested mode to inspect a selected branch.
- Adjustable minimum-size filters for files and folders.
- Live scan progress showing the current path, scanned counts, matches, and skipped items.
- Cancel in-progress scans.
- Open any result in File Explorer.
- Move files and folders to the Recycle Bin instead of deleting permanently.
- Refresh the current result list to remove items deleted outside the app.
- Resizable folder and file panels.
- Light and dark themes with a persistent theme toggle.

## Project Structure

```text
.
|-- README.md
|-- WebApp
|   |-- helper
|   |   `-- server.cjs
|   |-- index.html
|   |-- package.json
|   |-- scripts
|   |   |-- open-web-app.ps1
|   |   `-- web-static-server.cjs
|   `-- src
|       |-- App.jsx
|       |-- main.jsx
|       `-- styles.css
`-- NodeApp
    |-- package.json
    |-- package-lock.json
    |-- scripts
    |   |-- build-installer-win.ps1
    |   `-- package-win.ps1
    `-- src
        |-- index.html
        |-- main.js
        |-- preload.js
        |-- renderer.js
        `-- styles.css
```

## Requirements

- Node.js
- npm
- Windows is the primary target because the app uses File Explorer and Recycle Bin workflows.

## Run Locally

```powershell
cd NodeApp
npm.cmd install
npm.cmd start
```

PowerShell may block the `npm` script shim on some Windows machines, so `npm.cmd` is used above.

## Web Version With Local Helper

This repo also includes a React web UI plus a local helper service. The browser talks to the helper on `http://127.0.0.1:37891` and receives live scan progress through a WebSocket. The helper owns native disk access: folder selection, scanning, File Explorer actions, and Recycle Bin deletes.

```powershell
cd WebApp
.\open-web-app.bat
```

The web app, launcher, local helper, and web static server live in `WebApp`. `NodeApp` is kept for the Electron desktop app/exe. `WebApp/src/styles.css` imports the shared Electron UI stylesheet from `NodeApp/src/styles.css` and keeps only web-specific overrides locally.

For a real hosted website, launch the helper with `DSA_ALLOWED_ORIGINS` set to your website origin so other websites cannot call it.

## Notes

- Scanning large drives can take a while, especially protected or deeply nested system paths.
- Inaccessible files and folders are skipped and counted in the scan summary.
- The delete action uses Electron's `shell.trashItem`, so items are moved to the Recycle Bin where supported.
