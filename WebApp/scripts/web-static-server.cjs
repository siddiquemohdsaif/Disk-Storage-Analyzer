const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.DSA_WEB_PORT || 5173);
const DIST_DIR = process.env.DSA_WEB_DIST_DIR || path.join(__dirname, '..', 'dist');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    ...headers
  });
  response.end(body);
}

function safeJoin(base, requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  const resolvedPath = path.resolve(base, `.${decodedPath}`);
  if (!resolvedPath.startsWith(path.resolve(base))) {
    return null;
  }
  return resolvedPath;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);

  if (url.pathname === '/download-helper.ps1' || url.pathname === '/download-helper.cmd') {
    const token = url.searchParams.get('token') || '';
    const helperPort = Number(url.searchParams.get('helperPort') || 37891);
    const origin = url.searchParams.get('origin') || `http://${HOST}:${PORT}`;
    const appDir = path.resolve(__dirname, '..');

    if (url.pathname.endsWith('.ps1')) {
      const safeAppDir = appDir.replace(/'/g, "''");
      const safeToken = token.replace(/'/g, "''");
      const safeOrigin = origin.replace(/'/g, "''");
      const script = [
        '$ErrorActionPreference = "Stop"',
        `$env:DSA_HELPER_PORT = '${helperPort}'`,
        `$env:DSA_HELPER_TOKEN = '${safeToken}'`,
        `$env:DSA_ALLOWED_ORIGINS = '${safeOrigin}'`,
        `Set-Location '${safeAppDir}'`,
        'npm.cmd run helper:start'
      ].join('\r\n');

      send(response, 200, script, {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': 'attachment; filename="start-disk-analyser-helper.ps1"'
      });
      return;
    }

    const safeAppDir = appDir.replace(/"/g, '""');
    const safeToken = token.replace(/"/g, '');
    const safeOrigin = origin.replace(/"/g, '');
    const script = [
      '@echo off',
      'setlocal',
      `set "DSA_HELPER_PORT=${helperPort}"`,
      `set "DSA_HELPER_TOKEN=${safeToken}"`,
      `set "DSA_ALLOWED_ORIGINS=${safeOrigin}"`,
      `cd /d "${safeAppDir}"`,
      'echo Starting Disk Storage Analyser helper...',
      'echo Helper: http://127.0.0.1:%DSA_HELPER_PORT%',
      'echo Keep this window open while using the website.',
      'npm.cmd run helper:start',
      'echo.',
      'echo Helper stopped. Press any key to close.',
      'pause > nul'
    ].join('\r\n');

    send(response, 200, script, {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="start-disk-analyser-helper.cmd"'
    });
    return;
  }

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    send(response, 500, 'React build is missing. Run: npm.cmd run build from WebApp.', {
      'content-type': 'text/plain; charset=utf-8'
    });
    return;
  }

  const requestPath = request.url === '/' ? '/index.html' : request.url;
  let filePath = safeJoin(DIST_DIR, requestPath);

  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const extension = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  send(response, 200, body, {
    'content-type': mimeTypes[extension] || 'application/octet-stream'
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Disk Storage Analyser web UI listening on http://${HOST}:${PORT}`);
  console.log(`Serving ${DIST_DIR}`);
});
