import {
  ChevronRight,
  Download,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  Moon,
  RefreshCw,
  ScanLine,
  Square,
  Sun,
  Trash2
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_HELPER_URL = 'http://127.0.0.1:37891';

function initialQuerySetting(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function createToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function sizeToBytes(value, unit) {
  return Math.max(0, Number(value) || 0) * (unit === 'GB' ? 1024 ** 3 : 1024 ** 2);
}

function normalizePath(value) {
  return value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function parentPath(value) {
  const normalized = value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '');
  if (/^[a-zA-Z]:$/.test(normalized)) return '';
  const index = normalized.lastIndexOf('\\');
  if (index < 0) return '';
  if (index === 2 && normalized[1] === ':') return `${normalized.slice(0, 2)}\\`;
  return normalized.slice(0, index);
}

function isInsidePath(childPath, parent) {
  const child = normalizePath(childPath);
  const normalizedParent = normalizePath(parent);
  return child === normalizedParent || child.startsWith(`${normalizedParent}\\`);
}

function sortItems(items, sortMode) {
  return [...items].sort((a, b) => {
    if (sortMode === 'created') {
      return (b.createdAt || 0) - (a.createdAt || 0) || b.size - a.size;
    }
    return b.size - a.size || (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function createFolderTree(folders, sortMode) {
  const nodes = folders.map((item) => ({ ...item, children: [] }));
  const byPath = new Map(nodes.map((node) => [normalizePath(node.path), node]));
  const roots = [];

  for (const node of nodes) {
    const parent = byPath.get(normalizePath(parentPath(node.path)));
    if (parent && parent.path !== node.path) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (items) => {
    items.sort((a, b) => {
      if (sortMode === 'created') {
        return (b.createdAt || 0) - (a.createdAt || 0) || b.size - a.size;
      }
    return b.size - a.size || (b.createdAt || 0) - (a.createdAt || 0);
    });
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

function App() {
  const [helperUrl, setHelperUrl] = useState(initialQuerySetting('helperUrl') || localStorage.getItem('helperUrl') || DEFAULT_HELPER_URL);
  const [token, setToken] = useState(initialQuerySetting('token') || localStorage.getItem('helperToken') || createToken());
  const [connection, setConnection] = useState('Disconnected');
  const [theme, setTheme] = useState(localStorage.getItem('diskAnalyserTheme') || 'light');
  const [notice, setNotice] = useState({ message: 'Start the local helper, then paste its pairing token.', type: 'info' });
  const [currentPath, setCurrentPath] = useState('');
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [minFileSize, setMinFileSize] = useState(10);
  const [fileSizeUnit, setFileSizeUnit] = useState('MB');
  const [minFolderSize, setMinFolderSize] = useState(500);
  const [folderSizeUnit, setFolderSizeUnit] = useState('MB');
  const [folderViewMode, setFolderViewMode] = useState('nested');
  const [folderSortMode, setFolderSortMode] = useState('size');
  const [fileSortMode, setFileSortMode] = useState('size');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const foldersPanelRef = useRef(null);
  const filesPanelRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('diskAnalyserTheme', theme);
  }, [theme]);

  useEffect(() => {
    if (!window.location.search) return;
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    localStorage.setItem('helperUrl', helperUrl);
    localStorage.setItem('helperToken', token);

    const wsUrl = helperUrl.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsUrl}/events?token=${encodeURIComponent(token)}`);

    socket.addEventListener('open', () => setConnection('Connected'));
    socket.addEventListener('close', () => setConnection('Disconnected'));
    socket.addEventListener('error', () => setConnection('Socket blocked'));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.event === 'scan:progress') setProgress(message.payload);
    });

    return () => socket.close();
  }, [helperUrl, token]);

  const api = async (route, body = null) => {
    const response = await fetch(`${helperUrl}${route}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Helper request failed: ${response.status}`);
    return data;
  };

  const checkHelper = async () => {
    try {
      const response = await fetch(`${helperUrl}/health`);
      if (!response.ok) throw new Error('Helper rejected this website origin.');
      setConnection(token ? 'Connected' : 'Helper found');
      setNotice({ message: 'Helper is running. Enter the pairing token shown by the helper app.', type: 'success' });
    } catch (error) {
      setConnection('Disconnected');
      setNotice({ message: error.message || 'Helper is not reachable on localhost.', type: 'error' });
    }
  };

  const helperDownloadUrl = '/download-helper.exe';

  const selectAndScan = async () => {
    try {
      const { path } = await api('/dialog/select-path', {});
      if (!path) return;
      setCurrentPath(path);
      await scanSelectedPath(path);
    } catch (error) {
      setNotice({ message: error.message, type: 'error' });
      setIsScanning(false);
    }
  };

  const scanSelectedPath = async (pathOverride = currentPath) => {
    if (!pathOverride || isScanning) return;
    setIsScanning(true);
    setResults(null);
    setProgress({
      currentPath: pathOverride,
      scannedFiles: 0,
      scannedFolders: 0,
      skipped: 0,
      matchedFiles: 0,
      matchedFolders: 0
    });
    setNotice({ message: 'Scanning. Large drives can take a while.', type: 'info' });

    try {
      const scanResults = await api('/scan', {
        rootPath: pathOverride,
        minFileBytes: sizeToBytes(minFileSize, fileSizeUnit),
        minFolderBytes: sizeToBytes(minFolderSize, folderSizeUnit)
      });
      setResults(scanResults);
      setExpandedFolders(new Set([scanResults.rootPath]));
      setNotice({
        message: scanResults.totals.errors.length
          ? `Scan finished. Some protected or inaccessible items were skipped (${scanResults.totals.errors.length} shown internally).`
          : 'Scan finished successfully.',
        type: scanResults.totals.errors.length ? 'warning' : 'success'
      });
    } catch (error) {
      setNotice({ message: error.message, type: error.message === 'Scan cancelled.' ? 'warning' : 'error' });
    } finally {
      setIsScanning(false);
    }
  };

  const cancelScan = async () => {
    await api('/scan/cancel', {});
    setIsScanning(false);
    setNotice({ message: 'Cancelling scan...', type: 'warning' });
  };

  const removeItem = (item) => {
    if (!results) return;
    const next = {
      ...results,
      folders: results.folders.filter((candidate) =>
        item.type === 'folder' ? !isInsidePath(candidate.path, item.path) : candidate.path !== item.path
      ),
      files: results.files.filter((candidate) =>
        item.type === 'folder' ? !isInsidePath(candidate.path, item.path) : candidate.path !== item.path
      )
    };
    setResults(next);
  };

  const deleteItem = async (item) => {
    const confirmed = window.confirm(`Move this ${item.type} to the Recycle Bin?\n\n${item.path}`);
    if (!confirmed) return;
    await api('/item/delete', { path: item.path, confirm: 'MOVE_TO_RECYCLE_BIN' });
    removeItem(item);
    setNotice({ message: `Moved to Recycle Bin: ${item.path}`, type: 'success' });
  };

  const refreshList = async () => {
    if (!results) return;
    const validation = await api('/items/validate', {
      items: [...results.folders, ...results.files].map((item) => ({ path: item.path, type: item.type }))
    });
    const missingPaths = validation.filter((item) => !item.exists).map((item) => item.path);
    const missing = new Set(missingPaths.map(normalizePath));
    const missingFolders = results.folders.filter((folder) => missing.has(normalizePath(folder.path)));
    const isMissing = (item) =>
      missing.has(normalizePath(item.path)) ||
      missingFolders.some((folder) => item.path !== folder.path && isInsidePath(item.path, folder.path));

    setResults({
      ...results,
      folders: results.folders.filter((item) => !isMissing(item)),
      files: results.files.filter((item) => !isMissing(item))
    });
    setNotice({
      message: missingPaths.length
        ? `Refresh complete. Removed ${missingPaths.length.toLocaleString()} deleted item(s) from the list.`
        : 'Refresh complete. No deleted items found.',
      type: 'success'
    });
  };

  const folderItems = useMemo(() => sortItems(results?.folders || [], folderSortMode), [results, folderSortMode]);
  const fileItems = useMemo(() => sortItems(results?.files || [], fileSortMode), [results, fileSortMode]);
  const folderTree = useMemo(() => createFolderTree(folderItems, folderSortMode), [folderItems, folderSortMode]);

  const renderRows = (items, isTree = false, depth = 0) =>
    items.flatMap((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const row = (
        <tr key={item.path}>
          <td className="name-cell">
            <div className="item-name" style={{ '--depth': isTree ? depth : 0 }}>
              {isTree ? (
                <button
                  className={`tree-toggle ${item.children?.length ? '' : 'placeholder'}`}
                  type="button"
                  aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                  aria-expanded={isExpanded}
                  disabled={!item.children?.length}
                  onClick={() => {
                    const next = new Set(expandedFolders);
                    if (next.has(item.path)) next.delete(item.path);
                    else next.add(item.path);
                    setExpandedFolders(next);
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              ) : null}
              {item.type === 'folder' ? <Folder size={17} /> : <File size={17} />}
              <span title={item.path}>{item.name}</span>
            </div>
          </td>
          <td className="size-cell">{formatBytes(item.size)}</td>
          <td className="path-cell" title={item.path}>
            {item.path}
          </td>
          <td className="actions-cell">
            <button className="icon-button" type="button" title="Open location" onClick={() => api('/item/show', { path: item.path })}>
              <ExternalLink size={16} />
              <span>Open</span>
            </button>
            {!item.isRoot ? (
              <button className="icon-button delete" type="button" title="Move to Recycle Bin" onClick={() => deleteItem(item)}>
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            ) : null}
          </td>
        </tr>
      );

      if (!isTree || !isExpanded) return [row];
      return [row, ...renderRows(item.children, true, depth + 1)];
    });

  const metricValues = results
    ? {
        total: formatBytes(results.rootSize),
        files: results.files.length.toLocaleString(),
        folders: results.folders.length.toLocaleString(),
        skipped: results.totals.skipped.toLocaleString()
      }
    : { total: isScanning ? 'Scanning...' : '-', files: '-', folders: '-', skipped: '-' };

  const resetPanelSizes = () => {
    if (!foldersPanelRef.current || !filesPanelRef.current) return;
    foldersPanelRef.current.style.flex = '1 1 0';
    filesPanelRef.current.style.flex = '1 1 0';
  };

  const startPanelResize = (event) => {
    if (!foldersPanelRef.current || !filesPanelRef.current) return;

    event.preventDefault();
    const resizer = event.currentTarget;
    const startY = event.clientY;
    const folderStart = foldersPanelRef.current.getBoundingClientRect().height;
    const fileStart = filesPanelRef.current.getBoundingClientRect().height;
    const total = folderStart + fileStart;
    const minPanelHeight = 170;

    resizer.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent) => {
      const delta = moveEvent.clientY - startY;
      const folderHeight = Math.max(minPanelHeight, Math.min(total - minPanelHeight, folderStart + delta));
      const fileHeight = total - folderHeight;

      foldersPanelRef.current.style.flex = `0 0 ${folderHeight}px`;
      filesPanelRef.current.style.flex = `0 0 ${fileHeight}px`;
    };

    const onPointerUp = () => {
      resizer.removeEventListener('pointermove', onPointerMove);
      resizer.removeEventListener('pointerup', onPointerUp);
    };

    resizer.addEventListener('pointermove', onPointerMove);
    resizer.addEventListener('pointerup', onPointerUp);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Disk Storage Analyser</h1>
          <p>{currentPath || 'Connect the helper and choose a drive or folder to scan.'}</p>
        </div>
        <div className="toolbar">
          <label className="field compact">
            <span>Helper URL</span>
            <input value={helperUrl} onChange={(event) => setHelperUrl(event.target.value)} />
          </label>
          <label className="field compact">
            <span>Pairing token</span>
            <input value={token} onChange={(event) => setToken(event.target.value.trim())} placeholder="Paste token" />
          </label>
          <button className="button" type="button" onClick={checkHelper}>
            <RefreshCw size={17} />
            <span>{connection}</span>
          </button>
          <button className="button icon-only" type="button" title="Switch theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <section className="control-strip">
        <label className="field">
          <span>Files minimum</span>
          <div className="size-input">
            <input type="number" min="0" step="1" value={minFileSize} onChange={(event) => setMinFileSize(event.target.value)} />
            <select value={fileSizeUnit} onChange={(event) => setFileSizeUnit(event.target.value)}>
              <option value="MB">MB</option>
              <option value="GB">GB</option>
            </select>
          </div>
        </label>
        <label className="field">
          <span>Folders minimum</span>
          <div className="size-input">
            <input type="number" min="0" step="1" value={minFolderSize} onChange={(event) => setMinFolderSize(event.target.value)} />
            <select value={folderSizeUnit} onChange={(event) => setFolderSizeUnit(event.target.value)}>
              <option value="MB">MB</option>
              <option value="GB">GB</option>
            </select>
          </div>
        </label>
        <button className="button primary" type="button" disabled={connection !== 'Connected' || isScanning} onClick={selectAndScan}>
          <FolderOpen size={17} />
          <span>Select Path</span>
        </button>
        <button className="button" type="button" disabled={connection !== 'Connected' || !currentPath || isScanning} onClick={() => scanSelectedPath()}>
          <ScanLine size={17} />
          <span>Scan</span>
        </button>
        <button className="button" type="button" disabled={connection !== 'Connected' || !results || isScanning} onClick={refreshList}>
          <RefreshCw size={17} />
          <span>Refresh</span>
        </button>
        <button className="button danger" type="button" disabled={!isScanning} onClick={cancelScan}>
          <Square size={17} />
          <span>Cancel</span>
        </button>
      </section>

      <section className="status-grid">
        <div className="metric"><span>Total size</span><strong>{metricValues.total}</strong></div>
        <div className="metric"><span>Files found</span><strong>{metricValues.files}</strong></div>
        <div className="metric"><span>Folders found</span><strong>{metricValues.folders}</strong></div>
        <div className="metric"><span>Skipped</span><strong>{metricValues.skipped}</strong></div>
      </section>

      {notice.message ? <section className={`notice ${notice.type}`}>{notice.message}</section> : null}

      {connection !== 'Connected' ? (
        <section className="helper-panel">
          <div>
            <strong>Local helper required</strong>
            <span>Run disk_storage_analyzer.exe to start local disk support, then click Connect.</span>
          </div>
          <a className="button primary" href={helperDownloadUrl} download="disk_storage_analyzer.exe">
            <Download size={17} />
            <span>Helper EXE</span>
          </a>
        </section>
      ) : null}

      {isScanning && progress ? (
        <section className="progress-panel" aria-live="polite">
          <div className="progress-heading">
            <strong>Scanning</strong>
            <span>
              {progress.scannedFiles.toLocaleString()} files | {progress.scannedFolders.toLocaleString()} folders |{' '}
              {progress.matchedFiles.toLocaleString()} file matches | {progress.matchedFolders.toLocaleString()} folder matches |{' '}
              {progress.skipped.toLocaleString()} skipped
            </span>
          </div>
          <div className="progress-track"><div className="progress-bar" /></div>
          <p title={progress.currentPath}>{progress.currentPath || 'Scanning...'}</p>
        </section>
      ) : null}

      <section className="tables">
        <article ref={foldersPanelRef} className="panel">
          <div className="panel-heading">
            <div>
              <h2>Folders</h2>
              <span>{folderItems.length.toLocaleString()} folders, {folderSortMode === 'created' ? 'newest created first' : 'largest first'}</span>
            </div>
            <div className="panel-control-group">
              <Segment value={folderSortMode} onChange={setFolderSortMode} options={[['size', 'Size'], ['created', 'Newest']]} />
              <Segment value={folderViewMode} onChange={setFolderViewMode} options={[['nested', 'Nested'], ['flat', 'Flat']]} />
            </div>
          </div>
          <ResultTable empty="No folders meet the minimum size. The scanned root is always shown when the scan succeeds.">
            {folderViewMode === 'nested' ? renderRows(folderTree, true) : renderRows(folderItems)}
          </ResultTable>
        </article>

        <div className="panel-resizer" title="Drag to resize panels. Double-click to auto fit." onPointerDown={startPanelResize} onDoubleClick={resetPanelSizes} />

        <article ref={filesPanelRef} className="panel">
          <div className="panel-heading">
            <div>
              <h2>Files</h2>
              <span>{fileItems.length.toLocaleString()} files, {fileSortMode === 'created' ? 'newest created first' : 'largest first'}</span>
            </div>
            <Segment value={fileSortMode} onChange={setFileSortMode} options={[['size', 'Size'], ['created', 'Newest']]} />
          </div>
          <ResultTable empty="No files meet the minimum size. Lower the file minimum and scan again to show smaller files.">{renderRows(fileItems)}</ResultTable>
        </article>
      </section>
    </main>
  );
}

function Segment({ value, onChange, options }) {
  return (
    <div className="view-switch" role="radiogroup">
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          className={`mode-button ${value === optionValue ? 'active' : ''}`}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          <span className="radio-dot" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ResultTable({ children, empty }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Path</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>{children.length ? children : <tr><td className="empty" colSpan="4">{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}

export default App;
