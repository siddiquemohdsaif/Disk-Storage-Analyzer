const elements = {
  selectPath: document.querySelector('#selectPath'),
  rescan: document.querySelector('#rescan'),
  refreshList: document.querySelector('#refreshList'),
  themeToggle: document.querySelector('#themeToggle'),
  cancelScan: document.querySelector('#cancelScan'),
  minFileSize: document.querySelector('#minFileSize'),
  fileSizeUnit: document.querySelector('#fileSizeUnit'),
  minFolderSize: document.querySelector('#minFolderSize'),
  folderSizeUnit: document.querySelector('#folderSizeUnit'),
  selectedPath: document.querySelector('#selectedPath'),
  totalSize: document.querySelector('#totalSize'),
  fileCount: document.querySelector('#fileCount'),
  folderCount: document.querySelector('#folderCount'),
  skippedCount: document.querySelector('#skippedCount'),
  foldersBody: document.querySelector('#foldersBody'),
  filesBody: document.querySelector('#filesBody'),
  folderSummary: document.querySelector('#folderSummary'),
  fileSummary: document.querySelector('#fileSummary'),
  foldersPanel: document.querySelector('#foldersPanel'),
  filesPanel: document.querySelector('#filesPanel'),
  panelResizer: document.querySelector('#panelResizer'),
  folderSortSize: document.querySelector('#folderSortSize'),
  folderSortCreated: document.querySelector('#folderSortCreated'),
  fileSortSize: document.querySelector('#fileSortSize'),
  fileSortCreated: document.querySelector('#fileSortCreated'),
  nestedFolderView: document.querySelector('#nestedFolderView'),
  flatFolderView: document.querySelector('#flatFolderView'),
  progressPanel: document.querySelector('#progressPanel'),
  progressCounts: document.querySelector('#progressCounts'),
  progressPath: document.querySelector('#progressPath'),
  notice: document.querySelector('#notice')
};

let currentPath = null;
let currentResults = null;
let isScanning = false;
let folderViewMode = 'nested';
let folderSortMode = 'size';
let fileSortMode = 'size';
let expandedFolderPaths = new Set();

const iconPaths = {
  folderOpen: '<path d="M6 14h13l-2 5H4l2-5Z"></path><path d="M3 6h6l2 2h10v4H6l-3 7V6Z"></path>',
  scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2"></path><path d="M17 4h2a1 1 0 0 1 1 1v2"></path><path d="M20 17v2a1 1 0 0 1-1 1h-2"></path><path d="M7 20H5a1 1 0 0 1-1-1v-2"></path><path d="M7 12h10"></path>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"></path><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>',
  stop: '<path d="M6 6h12v12H6z"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
  moon: '<path d="M20.8 13.3A8.5 8.5 0 0 1 10.7 3.2a7 7 0 1 0 10.1 10.1Z"></path>',
  chevron: '<path d="m9 18 6-6-6-6"></path>',
  folder: '<path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"></path>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path>',
  external: '<path d="M15 3h6v6"></path><path d="m10 14 11-11"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
  trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>'
};

function createIcon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24">${iconPaths[name]}</svg>`;
  return span;
}

function setButtonContent(button, iconName, label) {
  button.textContent = '';
  button.append(createIcon(iconName));

  if (label) {
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('diskAnalyserTheme', theme);
  const isDark = theme === 'dark';
  elements.themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  elements.themeToggle.setAttribute('aria-label', elements.themeToggle.title);
  setButtonContent(elements.themeToggle, isDark ? 'sun' : 'moon', '');
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('diskAnalyserTheme');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(savedTheme || systemTheme);
}

function initializeButtonIcons() {
  setButtonContent(elements.selectPath, 'folderOpen', 'Select Path');
  setButtonContent(elements.rescan, 'scan', 'Scan');
  setButtonContent(elements.refreshList, 'refresh', 'Refresh');
  setButtonContent(elements.cancelScan, 'stop', 'Cancel');
}

function sizeToBytes(input, unitSelect) {
  const value = Math.max(0, Number(input.value) || 0);
  const unit = unitSelect.value;
  return value * (unit === 'GB' ? 1024 ** 3 : 1024 ** 2);
}

function minimumFileBytes() {
  return sizeToBytes(elements.minFileSize, elements.fileSizeUnit);
}

function minimumFolderBytes() {
  return sizeToBytes(elements.minFolderSize, elements.folderSizeUnit);
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function sortItems(items, sortMode) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sortMode === 'created') {
      return (b.createdAt || 0) - (a.createdAt || 0) || b.size - a.size;
    }

    return b.size - a.size || (b.createdAt || 0) - (a.createdAt || 0);
  });

  return sorted;
}

function normalizePath(value) {
  return value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function isInsidePath(childPath, parentPath) {
  const parent = normalizePath(parentPath);
  const child = normalizePath(childPath);
  return child === parent || child.startsWith(`${parent}\\`);
}

function parentPath(value) {
  const normalized = value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '');
  const driveRoot = /^[a-zA-Z]:$/.test(normalized);
  if (driveRoot) {
    return '';
  }

  const index = normalized.lastIndexOf('\\');
  if (index < 0) {
    return '';
  }

  if (index === 2 && normalized[1] === ':') {
    return `${normalized.slice(0, 2)}\\`;
  }

  return normalized.slice(0, index);
}

function setNotice(message, type = 'info') {
  if (!message) {
    elements.notice.className = 'notice hidden';
    elements.notice.textContent = '';
    return;
  }

  elements.notice.className = `notice ${type}`;
  elements.notice.textContent = message;
}

function setScanning(scanning) {
  isScanning = scanning;
  elements.selectPath.disabled = scanning;
  elements.rescan.disabled = scanning || !currentPath;
  elements.refreshList.disabled = scanning || !currentResults;
  elements.cancelScan.disabled = !scanning;
  elements.progressPanel.classList.toggle('hidden', !scanning);
}

function renderEmpty(tbody, message) {
  tbody.innerHTML = '';
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.className = 'empty';
  cell.textContent = message;
  row.append(cell);
  tbody.append(row);
}

function createFolderTree(folders, sortMode) {
  const nodes = folders.map((item) => ({ ...item, children: [] }));
  const byPath = new Map(nodes.map((node) => [normalizePath(node.path), node]));
  const roots = [];

  for (const node of nodes) {
    const parent = byPath.get(normalizePath(parentPath(node.path)));
    if (parent && parent.path !== node.path) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (items) => {
    items.sort((a, b) => {
      if (sortMode === 'created') {
        return (b.createdAt || 0) - (a.createdAt || 0) || b.size - a.size;
      }

      return b.size - a.size || (b.createdAt || 0) - (a.createdAt || 0);
    });
    for (const item of items) {
      sortNodes(item.children);
    }
  };

  sortNodes(roots);
  return roots;
}

function createActionButton(label, className, iconName, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button ${className}`;
  setButtonContent(button, iconName, label);
  button.addEventListener('click', onClick);
  return button;
}

function appendItemRow(fragment, item, options = {}) {
  const row = document.createElement('tr');

  const name = document.createElement('td');
  name.className = options.isTree ? 'name-cell tree-name-cell' : 'name-cell';

  if (options.isTree) {
    const treeContent = document.createElement('div');
    treeContent.className = 'tree-name';
    treeContent.style.setProperty('--depth', String(options.depth || 0));

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedFolderPaths.has(item.path);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = hasChildren ? 'tree-toggle' : 'tree-toggle placeholder';
    toggle.setAttribute('aria-label', isExpanded ? 'Collapse folder' : 'Expand folder');
    toggle.setAttribute('aria-expanded', String(isExpanded));
    toggle.disabled = !hasChildren;
    toggle.title = hasChildren ? (isExpanded ? 'Collapse folder' : 'Expand folder') : '';
    toggle.append(createIcon('chevron'));
    toggle.addEventListener('click', () => {
      if (expandedFolderPaths.has(item.path)) {
        expandedFolderPaths.delete(item.path);
      } else {
        expandedFolderPaths.add(item.path);
      }
      renderFolders(currentResults);
    });

    const typeIcon = createIcon('folder');
    typeIcon.classList.add('tree-type-icon');

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = item.name;
    label.title = item.path;
    treeContent.append(toggle, typeIcon, label);
    name.append(treeContent);
  } else {
    const itemLabel = document.createElement('div');
    itemLabel.className = 'item-label';
    itemLabel.append(createIcon(item.type === 'folder' ? 'folder' : 'file'));
    const label = document.createElement('span');
    label.textContent = item.name;
    itemLabel.append(label);
    name.append(itemLabel);
  }

  const size = document.createElement('td');
  size.className = 'size-cell';
  size.textContent = formatBytes(item.size);

  const itemPath = document.createElement('td');
  itemPath.className = 'path-cell';
  itemPath.title = item.path;
  itemPath.textContent = item.path;

  const actions = document.createElement('td');
  actions.className = 'actions-cell';
  actions.append(
    createActionButton('Open', 'open', 'external', async () => {
      try {
        await window.diskAnalyser.showItem(item.path);
      } catch (error) {
        setNotice(error.message, 'error');
      }
    })
  );

  if (!item.isRoot) {
    actions.append(
      createActionButton('Delete', 'delete', 'trash', async () => {
        const confirmed = window.confirm(`Move this ${item.type} to the Recycle Bin?\n\n${item.path}`);
        if (!confirmed) {
          return;
        }

        try {
          await window.diskAnalyser.deleteItem(item.path);
          removeItem(item);
          setNotice(`Moved to Recycle Bin: ${item.path}`, 'success');
        } catch (error) {
          setNotice(error.message, 'error');
        }
      })
    );
  }

  row.append(name, size, itemPath, actions);
  fragment.append(row);
}

function renderTable(tbody, items, emptyMessage) {
  tbody.innerHTML = '';

  if (!items.length) {
    renderEmpty(tbody, emptyMessage);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    appendItemRow(fragment, item);
  }

  tbody.append(fragment);
}

function renderNestedFolders(items) {
  elements.foldersBody.innerHTML = '';

  if (!items.length) {
    renderEmpty(elements.foldersBody, 'No folders meet the minimum size.');
    return;
  }

  const fragment = document.createDocumentFragment();
  const appendNode = (node, depth) => {
    appendItemRow(fragment, node, { isTree: true, depth });

    if (expandedFolderPaths.has(node.path)) {
      for (const child of node.children) {
        appendNode(child, depth + 1);
      }
    }
  };

  for (const item of createFolderTree(items, folderSortMode)) {
    appendNode(item, 0);
  }

  elements.foldersBody.append(fragment);
}

function renderFolders(results) {
  if (!results) {
    renderEmpty(elements.foldersBody, 'Select a path to scan.');
    return;
  }

  elements.nestedFolderView.classList.toggle('active', folderViewMode === 'nested');
  elements.flatFolderView.classList.toggle('active', folderViewMode === 'flat');
  elements.nestedFolderView.setAttribute('aria-checked', String(folderViewMode === 'nested'));
  elements.flatFolderView.setAttribute('aria-checked', String(folderViewMode === 'flat'));
  elements.folderSortSize.classList.toggle('active', folderSortMode === 'size');
  elements.folderSortCreated.classList.toggle('active', folderSortMode === 'created');
  elements.folderSortSize.setAttribute('aria-checked', String(folderSortMode === 'size'));
  elements.folderSortCreated.setAttribute('aria-checked', String(folderSortMode === 'created'));

  const sortedFolders = sortItems(results.folders, folderSortMode);

  if (folderViewMode === 'nested') {
    renderNestedFolders(sortedFolders);
  } else {
    renderTable(elements.foldersBody, sortedFolders, 'No folders meet the minimum size.');
  }
}

function renderFiles(results) {
  if (!results) {
    renderEmpty(elements.filesBody, 'Select a path to scan.');
    return;
  }

  elements.fileSortSize.classList.toggle('active', fileSortMode === 'size');
  elements.fileSortCreated.classList.toggle('active', fileSortMode === 'created');
  elements.fileSortSize.setAttribute('aria-checked', String(fileSortMode === 'size'));
  elements.fileSortCreated.setAttribute('aria-checked', String(fileSortMode === 'created'));
  renderTable(elements.filesBody, sortItems(results.files, fileSortMode), 'No files meet the minimum size.');
}

function removeItem(item) {
  if (!currentResults) {
    return;
  }

  const collection = item.type === 'folder' ? currentResults.folders : currentResults.files;
  const index = collection.findIndex((candidate) => candidate.path === item.path);
  if (index >= 0) {
    collection.splice(index, 1);
  }

  if (item.type === 'folder') {
    currentResults.folders = currentResults.folders.filter((candidate) => !isInsidePath(candidate.path, item.path));
    currentResults.files = currentResults.files.filter((candidate) => !isInsidePath(candidate.path, item.path));
    expandedFolderPaths.delete(item.path);
  }

  renderResults(currentResults);
}

function renderResults(results) {
  currentResults = results;

  elements.totalSize.textContent = formatBytes(results.rootSize);
  elements.fileCount.textContent = results.files.length.toLocaleString();
  elements.folderCount.textContent = results.folders.length.toLocaleString();
  elements.skippedCount.textContent = results.totals.skipped.toLocaleString();
  const folderSortLabel = folderSortMode === 'created' ? 'newest created first' : 'largest first';
  const fileSortLabel = fileSortMode === 'created' ? 'newest created first' : 'largest first';
  elements.folderSummary.textContent = `${results.folders.length.toLocaleString()} folders at or above minimum size, ${folderSortLabel}`;
  elements.fileSummary.textContent = `${results.files.length.toLocaleString()} files at or above minimum size, ${fileSortLabel}`;

  renderFolders(results);
  renderFiles(results);
  elements.refreshList.disabled = isScanning || !currentResults;

  if (results.totals.errors.length) {
    setNotice(`Scan finished. Some protected or inaccessible items were skipped (${results.totals.errors.length} shown internally).`, 'warning');
  } else {
    setNotice('Scan finished successfully.', 'success');
  }
}

function pruneMissingItems(missingPaths) {
  const missing = new Set(missingPaths.map(normalizePath));
  const missingFolders = currentResults.folders.filter((folder) => missing.has(normalizePath(folder.path)));
  const isMissingOrInsideMissingFolder = (item) => {
    const normalized = normalizePath(item.path);
    if (missing.has(normalized)) {
      return true;
    }

    return missingFolders.some((folder) => item.path !== folder.path && isInsidePath(item.path, folder.path));
  };

  currentResults.folders = currentResults.folders.filter((item) => !isMissingOrInsideMissingFolder(item));
  currentResults.files = currentResults.files.filter((item) => !isMissingOrInsideMissingFolder(item));

  for (const missingPath of missingPaths) {
    expandedFolderPaths.delete(missingPath);
  }
}

async function refreshCurrentList() {
  if (!currentResults || isScanning) {
    return;
  }

  elements.refreshList.disabled = true;
  setNotice('Refreshing current list...', 'info');

  try {
    const items = [...currentResults.folders, ...currentResults.files].map((item) => ({
      path: item.path,
      type: item.type
    }));
    const validation = await window.diskAnalyser.validateItems(items);
    const missingPaths = validation.filter((item) => !item.exists).map((item) => item.path);

    if (!missingPaths.length) {
      renderResults(currentResults);
      setNotice('Refresh complete. No deleted items found.', 'success');
      return;
    }

    pruneMissingItems(missingPaths);
    renderResults(currentResults);
    setNotice(`Refresh complete. Removed ${missingPaths.length.toLocaleString()} deleted item(s) from the list.`, 'success');
  } catch (error) {
    setNotice(error.message, 'error');
  } finally {
    elements.refreshList.disabled = isScanning || !currentResults;
  }
}

function renderProgress(progress) {
  elements.progressCounts.textContent = [
    `${progress.scannedFiles.toLocaleString()} files scanned`,
    `${progress.scannedFolders.toLocaleString()} folders scanned`,
    `${progress.matchedFiles.toLocaleString()} files matched`,
    `${progress.matchedFolders.toLocaleString()} folders matched`,
    `${progress.skipped.toLocaleString()} skipped`
  ].join(' | ');
  elements.progressPath.textContent = progress.currentPath || 'Scanning...';
  elements.progressPath.title = progress.currentPath || '';
}

async function scanSelectedPath() {
  if (!currentPath || isScanning) {
    return;
  }

  setScanning(true);
  setNotice('Scanning. Large drives can take a while, especially from C:\\.', 'info');
  elements.totalSize.textContent = 'Scanning...';
  elements.fileCount.textContent = '-';
  elements.folderCount.textContent = '-';
  elements.skippedCount.textContent = '-';
  renderEmpty(elements.foldersBody, 'Scanning folders...');
  renderEmpty(elements.filesBody, 'Scanning files...');
  renderProgress({
    currentPath,
    scannedFiles: 0,
    scannedFolders: 0,
    skipped: 0,
    matchedFiles: 0,
    matchedFolders: 0
  });

  try {
    const results = await window.diskAnalyser.scanPath({
      rootPath: currentPath,
      minFileBytes: minimumFileBytes(),
      minFolderBytes: minimumFolderBytes()
    });
    expandedFolderPaths = new Set([results.rootPath]);
    renderResults(results);
  } catch (error) {
    if (error.message === 'Scan cancelled.') {
      setNotice('Scan cancelled.', 'warning');
    } else {
      setNotice(error.message, 'error');
    }
  } finally {
    setScanning(false);
  }
}

async function selectAndScan() {
  try {
    const selectedPath = await window.diskAnalyser.selectPath();
    if (!selectedPath) {
      return;
    }

    currentPath = selectedPath;
    elements.selectedPath.textContent = selectedPath;
    elements.rescan.disabled = false;
    elements.refreshList.disabled = true;
    await scanSelectedPath();
  } catch (error) {
    setNotice(error.message, 'error');
    setScanning(false);
  }
}

elements.selectPath.addEventListener('click', selectAndScan);
elements.rescan.addEventListener('click', scanSelectedPath);
elements.refreshList.addEventListener('click', refreshCurrentList);
elements.themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});
elements.cancelScan.addEventListener('click', async () => {
  await window.diskAnalyser.cancelScan();
  setScanning(false);
  setNotice('Cancelling scan...', 'warning');
});

elements.nestedFolderView.addEventListener('click', () => {
  folderViewMode = 'nested';
  renderFolders(currentResults);
});

elements.flatFolderView.addEventListener('click', () => {
  folderViewMode = 'flat';
  renderFolders(currentResults);
});

elements.folderSortSize.addEventListener('click', () => {
  folderSortMode = 'size';
  if (currentResults) {
    renderResults(currentResults);
  } else {
    renderFolders(currentResults);
  }
});

elements.folderSortCreated.addEventListener('click', () => {
  folderSortMode = 'created';
  if (currentResults) {
    renderResults(currentResults);
  } else {
    renderFolders(currentResults);
  }
});

elements.fileSortSize.addEventListener('click', () => {
  fileSortMode = 'size';
  if (currentResults) {
    renderResults(currentResults);
  } else {
    renderFiles(currentResults);
  }
});

elements.fileSortCreated.addEventListener('click', () => {
  fileSortMode = 'created';
  if (currentResults) {
    renderResults(currentResults);
  } else {
    renderFiles(currentResults);
  }
});

function resetPanelSizes() {
  elements.foldersPanel.style.flex = '1 1 0';
  elements.filesPanel.style.flex = '1 1 0';
}

elements.panelResizer.addEventListener('dblclick', resetPanelSizes);
elements.panelResizer.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const container = elements.panelResizer.parentElement;
  const startY = event.clientY;
  const folderStart = elements.foldersPanel.getBoundingClientRect().height;
  const fileStart = elements.filesPanel.getBoundingClientRect().height;
  const total = folderStart + fileStart;
  const minPanelHeight = 170;

  elements.panelResizer.setPointerCapture(event.pointerId);

  const onPointerMove = (moveEvent) => {
    const delta = moveEvent.clientY - startY;
    const folderHeight = Math.max(minPanelHeight, Math.min(total - minPanelHeight, folderStart + delta));
    const fileHeight = total - folderHeight;
    elements.foldersPanel.style.flex = `0 0 ${folderHeight}px`;
    elements.filesPanel.style.flex = `0 0 ${fileHeight}px`;
  };

  const onPointerUp = () => {
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
  };

  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
});

window.diskAnalyser.onScanProgress(renderProgress);

window.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  initializeButtonIcons();
  renderEmpty(elements.foldersBody, 'Select a path to scan.');
  renderEmpty(elements.filesBody, 'Select a path to scan.');
  setTimeout(selectAndScan, 350);
});
