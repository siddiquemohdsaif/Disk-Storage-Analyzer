# Disk Storage Analyser

Electron app source for the Disk Storage Analyser desktop tool. The app scans a selected drive or folder, ranks large files and folders by size, and provides quick cleanup actions through File Explorer and the Recycle Bin.

## Features

- Native folder or drive picker on launch.
- Scan selected folders or drive roots such as `C:\`.
- Separate folders and files tables sorted by descending size.
- Nested and flat folder result modes.
- Expandable folder tree for branch-level inspection.
- Adjustable minimum-size filters for files and folders.
- Live scan progress with current path, scanned counts, matches, and skipped items.
- Scan cancellation.
- Open result locations in File Explorer.
- Move unwanted files or folders to the Recycle Bin.
- Refresh the current results to remove items deleted outside the app.
- Manually resizable folder and file panels.

## Run

```powershell
npm.cmd install
npm.cmd start
```

PowerShell may block the `npm` script shim on some Windows machines, so `npm.cmd` is used above.

## Source Layout

```text
src/
|-- index.html
|-- main.js
|-- preload.js
|-- renderer.js
`-- styles.css
```
