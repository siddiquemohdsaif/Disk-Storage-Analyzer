# Disk Storage Analyser WebApp

React web UI plus the localhost helper bridge for Disk Storage Analyser.

`NodeApp` is the Electron desktop app. `WebApp` contains the web app, helper service, static server, and launcher.

## Run

```powershell
npm.cmd install
.\open-web-app.bat
```

The launcher builds the React app, starts the helper on localhost, starts the static web server, generates a pairing token, and opens the browser already paired.

## Source Layout

```text
WebApp/
|-- helper/
|   `-- server.cjs
|-- scripts/
|   |-- open-web-app.ps1
|   |-- start-helper-dev.ps1
|   |-- start-web-dev.ps1
|   `-- web-static-server.cjs
|-- src/
|   |-- App.jsx
|   |-- main.jsx
|   `-- styles.css
|-- index.html
|-- open-web-app.bat
`-- package.json
```

`src/styles.css` imports the shared base UI stylesheet from `..\NodeApp\src\styles.css`, then adds web-only layout and React-specific overrides.
