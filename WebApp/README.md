# Disk Storage Analyser WebApp

React web UI plus the localhost helper bridge for Disk Storage Analyser.

`NodeApp` is the Electron desktop app. `WebApp` contains the web app, helper service, static server, and launcher.

## Run

```powershell
npm.cmd install
.\open-web-app.bat
```

The launcher builds the React app, starts the static web server, and opens the website. The website shows a Helper EXE button when local disk support is not connected.

To launch the website and helper together for development:

```powershell
.\open-web-app-with-helper.bat
```

## Native Helper EXE

Package the localhost helper shell:

```powershell
npm.cmd run package:helper:win
```

Output:

```text
dist\native-light\disk_storage_analyzer-win32-x64\disk_storage_analyzer.exe
```

This EXE is a lightweight native Windows Forms shell, not Electron. It starts the local helper, starts the local web server, opens the localhost website in the browser, and keeps a small status window open. It expects `node.exe` to be installed and available on `PATH`.

## Source Layout

```text
WebApp/
|-- helper/
|   `-- server.cjs
|-- scripts/
|   |-- open-web-app.ps1
|   |-- start-helper-dev.ps1
|   |-- start-web-dev.ps1
|   |-- package-helper-win.ps1
|   `-- web-static-server.cjs
|-- native-light/
|   `-- DiskStorageAnalyzerHelper.cs
|-- src/
|   |-- App.jsx
|   |-- main.jsx
|   `-- styles.css
|-- index.html
|-- open-web-app.bat
`-- package.json
```

`src/styles.css` imports the shared base UI stylesheet from `..\NodeApp\src\styles.css`, then adds web-only layout and React-specific overrides.
