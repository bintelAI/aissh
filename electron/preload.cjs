const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
});
