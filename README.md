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
`-- NodeApp
    |-- package.json
    |-- package-lock.json
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

## Notes

- Scanning large drives can take a while, especially protected or deeply nested system paths.
- Inaccessible files and folders are skipped and counted in the scan summary.
- The delete action uses Electron's `shell.trashItem`, so items are moved to the Recycle Bin where supported.
