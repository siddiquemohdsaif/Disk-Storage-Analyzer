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
