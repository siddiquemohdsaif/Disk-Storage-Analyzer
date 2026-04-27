const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diskAnalyser', {
  selectPath: () => ipcRenderer.invoke('dialog:selectPath'),
  scanPath: (options) => ipcRenderer.invoke('scan:path', options),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  showItem: (itemPath) => ipcRenderer.invoke('item:show', itemPath),
  deleteItem: (itemPath) => ipcRenderer.invoke('item:delete', itemPath),
  validateItems: (items) => ipcRenderer.invoke('items:validate', items),
  onScanProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('scan:progress', listener);
    return () => ipcRenderer.removeListener('scan:progress', listener);
  }
});
