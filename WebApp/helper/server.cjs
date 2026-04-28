const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.DSA_HELPER_PORT || 37891);
const TOKEN = process.env.DSA_HELPER_TOKEN || crypto.randomBytes(18).toString('base64url');
const ALLOWED_ORIGINS = new Set(
  (process.env.DSA_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

let scanId = 0;
const sockets = new Set();

function createdTimestamp(stat) {
  return stat.birthtimeMs || stat.ctimeMs || stat.mtimeMs || 0;
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function sendJson(response, status, body, origin) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }

  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function sendError(response, status, message, origin) {
  sendJson(response, status, { error: message }, origin);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    request.on('error', reject);
  });
}

function requireAuth(request, response) {
  if (!isAllowedOrigin(request)) {
    sendError(response, 403, 'Origin is not allowed.', request.headers.origin);
    return false;
  }

  if (request.headers.authorization !== `Bearer ${TOKEN}`) {
    sendError(response, 401, 'Missing or invalid pairing token.', request.headers.origin);
    return false;
  }

  return true;
}

function broadcast(event, payload) {
  const message = JSON.stringify({ event, payload });
  const frame = createWsFrame(message);

  for (const socket of sockets) {
    socket.write(frame);
  }
}

function createWsFrame(message) {
  const payload = Buffer.from(message);
  const length = payload.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

async function scanPath(options) {
  const currentScanId = ++scanId;
  const rootPath = options?.rootPath;
  const minFileBytes = Math.max(0, Number(options?.minFileBytes) || 0);
  const minFolderBytes = Math.max(0, Number(options?.minFolderBytes) || 0);
  let lastProgressAt = 0;

  if (!rootPath) {
    throw new Error('No path selected.');
  }

  const rootStat = await fs.stat(rootPath);
  if (!rootStat.isDirectory()) {
    throw new Error('Selected path must be a folder or drive.');
  }

  const totals = {
    scannedFiles: 0,
    scannedFolders: 0,
    skipped: 0,
    errors: []
  };
  const files = [];
  const folders = [];

  function sendProgress(currentPath, force = false) {
    const now = Date.now();
    if (!force && now - lastProgressAt < 150) {
      return;
    }

    lastProgressAt = now;
    broadcast('scan:progress', {
      currentPath,
      scannedFiles: totals.scannedFiles,
      scannedFolders: totals.scannedFolders,
      skipped: totals.skipped,
      matchedFiles: files.length,
      matchedFolders: folders.length
    });
  }

  async function walk(folderPath) {
    if (currentScanId !== scanId) {
      throw new Error('Scan cancelled.');
    }

    totals.scannedFolders += 1;
    sendProgress(folderPath);
    let entries;

    try {
      entries = await fs.readdir(folderPath, { withFileTypes: true });
    } catch (error) {
      totals.skipped += 1;
      if (totals.errors.length < 80) {
        totals.errors.push({ path: folderPath, message: error.message });
      }
      return 0;
    }

    let folderSize = 0;

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);

      try {
        if (entry.isSymbolicLink()) {
          totals.skipped += 1;
          continue;
        }

        if (entry.isDirectory()) {
          const stat = await fs.stat(entryPath);
          const size = await walk(entryPath);
          folderSize += size;

          if (size >= minFolderBytes) {
            folders.push({
              name: entry.name,
              path: entryPath,
              size,
              createdAt: createdTimestamp(stat),
              type: 'folder'
            });
          }
          continue;
        }

        if (entry.isFile()) {
          const stat = await fs.stat(entryPath);
          totals.scannedFiles += 1;
          folderSize += stat.size;
          sendProgress(entryPath);

          if (stat.size >= minFileBytes) {
            files.push({
              name: entry.name,
              path: entryPath,
              size: stat.size,
              createdAt: createdTimestamp(stat),
              type: 'file'
            });
          }
        }
      } catch (error) {
        totals.skipped += 1;
        sendProgress(entryPath);
        if (totals.errors.length < 80) {
          totals.errors.push({ path: entryPath, message: error.message });
        }
      }
    }

    return folderSize;
  }

  const rootSize = await walk(rootPath);

  folders.push({
    name: path.basename(rootPath) || rootPath,
    path: rootPath,
    size: rootSize,
    createdAt: createdTimestamp(rootStat),
    type: 'folder',
    isRoot: true
  });

  files.sort((a, b) => b.size - a.size);
  folders.sort((a, b) => b.size - a.size);
  sendProgress(rootPath, true);

  return { rootPath, rootSize, files, folders, totals };
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: false },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }

        resolve(stdout.trim());
      }
    );
  });
}

async function selectPath() {
  if (process.platform !== 'win32') {
    throw new Error('Native folder picker is currently implemented for Windows.');
  }

  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select a drive or folder to scan'
$dialog.ShowNewFolderButton = $false
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.SelectedPath)
}
`;
  return runPowerShell(script);
}

function showItem(itemPath) {
  if (process.platform === 'win32') {
    spawn('explorer.exe', ['/select,', itemPath], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  throw new Error('Open location is currently implemented for Windows.');
}

async function trashItem(itemPath) {
  if (process.platform !== 'win32') {
    throw new Error('Recycle Bin delete is currently implemented for Windows.');
  }

  const escaped = itemPath.replace(/'/g, "''");
  const stat = await fs.stat(itemPath);
  const command = stat.isDirectory() ? 'DeleteDirectory' : 'DeleteFile';

  await runPowerShell(`
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::${command}('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')
`);
}

async function validateItems(items) {
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array.');
  }

  const results = [];

  for (const item of items) {
    const itemPath = item?.path;
    if (!itemPath) {
      continue;
    }

    try {
      await fs.access(itemPath);
      results.push({ path: itemPath, exists: true });
    } catch {
      results.push({ path: itemPath, exists: false });
    }
  }

  return results;
}

async function handleRoute(request, response) {
  const origin = request.headers.origin;

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request)) {
      sendError(response, 403, 'Origin is not allowed.', origin);
      return;
    }

    response.writeHead(204, {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-max-age': '7200',
      vary: 'Origin'
    });
    response.end();
    return;
  }

  if (request.url === '/health' && request.method === 'GET') {
    if (!isAllowedOrigin(request)) {
      sendError(response, 403, 'Origin is not allowed.', origin);
      return;
    }
    sendJson(response, 200, { ok: true, app: 'Disk Storage Analyser Helper' }, origin);
    return;
  }

  if ((request.url === '/' || request.url === '/favicon.ico') && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      app: 'Disk Storage Analyser Helper',
      message: 'The helper is running. Open the React web UI, then paste the pairing token shown in this terminal.',
      webUi: 'http://127.0.0.1:5173'
    }, origin);
    return;
  }

  if (!requireAuth(request, response)) {
    return;
  }

  const body = request.method === 'POST' ? await readJson(request) : {};

  if (request.url === '/dialog/select-path' && request.method === 'POST') {
    sendJson(response, 200, { path: await selectPath() }, origin);
    return;
  }

  if (request.url === '/scan' && request.method === 'POST') {
    sendJson(response, 200, await scanPath(body), origin);
    return;
  }

  if (request.url === '/scan/cancel' && request.method === 'POST') {
    scanId += 1;
    sendJson(response, 200, { ok: true }, origin);
    return;
  }

  if (request.url === '/item/show' && request.method === 'POST') {
    showItem(body.path);
    sendJson(response, 200, { ok: true }, origin);
    return;
  }

  if (request.url === '/item/delete' && request.method === 'POST') {
    if (body.confirm !== 'MOVE_TO_RECYCLE_BIN') {
      throw new Error('Delete confirmation is required.');
    }
    await trashItem(body.path);
    sendJson(response, 200, { ok: true }, origin);
    return;
  }

  if (request.url === '/items/validate' && request.method === 'POST') {
    sendJson(response, 200, await validateItems(body.items), origin);
    return;
  }

  sendError(response, 404, 'Route not found.', origin);
}

const server = http.createServer((request, response) => {
  handleRoute(request, response).catch((error) => {
    sendError(response, 500, error.message, request.headers.origin);
  });
});

server.on('upgrade', (request, socket) => {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);

  if (url.pathname !== '/events' || !isAllowedOrigin(request) || url.searchParams.get('token') !== TOKEN) {
    socket.destroy();
    return;
  }

  const key = request.headers['sec-websocket-key'];
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    ''
  ].join('\r\n'));

  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => sockets.delete(socket));
});

server.listen(PORT, HOST, () => {
  console.log(`Disk Storage Analyser helper listening on http://${HOST}:${PORT}`);
  console.log(`Allowed origins: ${Array.from(ALLOWED_ORIGINS).join(', ')}`);
  console.log(`Pairing token: ${TOKEN}`);
});
