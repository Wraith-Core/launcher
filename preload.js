// The only bridge between the page and the launcher: a fixed list of calls, no Node access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wraith', {
  feed: () => ipcRenderer.invoke('feed'),
  status: () => ipcRenderer.invoke('status'),
  image: (name) => ipcRenderer.invoke('image', name),
  version: () => ipcRenderer.invoke('version'),
  connect: () => ipcRenderer.invoke('connect'),
  open: (which) => ipcRenderer.invoke('open', which),
  window: (action) => ipcRenderer.send('window', action),
  onUpdate: (callback) => ipcRenderer.on('update', (_e, info) => callback(info)),
  installUpdate: () => ipcRenderer.send('install-update'),
});
