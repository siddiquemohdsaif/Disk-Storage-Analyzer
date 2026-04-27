const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

let mainWindow;
let scanId = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f7f8fb',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('dialog:selectPath', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select a drive or folder to scan',
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('scan:path', async (_event, options) => {
  const currentScanId = ++scanId;
  const rootPath = options?.rootPath;
  const minFileBytes = Math.max(0, Number(options?.minFileBytes) || 0);
  const minFolderBytes = Math.max(0, Number(options?.minFolderBytes) || 0);
  const sender = _event.sender;
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
    sender.send('scan:progress', {
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
          const size = await walk(entryPath);
          folderSize += size;

          if (size >= minFolderBytes) {
            folders.push({
              name: entry.name,
              path: entryPath,
              size,
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

  if (rootSize >= minFolderBytes) {
    folders.push({
      name: path.basename(rootPath) || rootPath,
      path: rootPath,
      size: rootSize,
      type: 'folder',
      isRoot: true
    });
  }

  files.sort((a, b) => b.size - a.size);
  folders.sort((a, b) => b.size - a.size);
  sendProgress(rootPath, true);

  return {
    rootPath,
    rootSize,
    files,
    folders,
    totals
  };
});

ipcMain.handle('scan:cancel', async () => {
  scanId += 1;
  return true;
});

ipcMain.handle('item:show', async (_event, itemPath) => {
  if (!itemPath) {
    throw new Error('Missing item path.');
  }

  shell.showItemInFolder(itemPath);
  return true;
});

ipcMain.handle('item:delete', async (_event, itemPath) => {
  if (!itemPath) {
    throw new Error('Missing item path.');
  }

  await shell.trashItem(itemPath);
  return true;
});

ipcMain.handle('items:validate', async (_event, items) => {
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
});
