# Disk Storage Analyser WebApp

React web UI plus the localhost helper bridge for Disk Storage Analyser.

`NodeApp` is the Electron desktop app. `WebApp` contains the web app, helper service, static server, and launcher.

## Run

```powershell
npm.cmd install
.\open-web-app.bat
```

The launcher builds the React app, starts the static web server, and opens the website. The website shows a Helper Launcher button when local disk support is not connected.

To launch the website and helper together for development:

```powershell
.\open-web-app-with-helper.bat
```

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
