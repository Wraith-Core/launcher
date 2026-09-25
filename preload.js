// The only bridge between the page and the launcher: a fixed list of calls, no Node access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wraith', {
  feed: () => ipcRenderer.invoke('feed'),
  feedCached: () => ipcRenderer.invoke('feed-cached'),
  status: () => ipcRenderer.invoke('status'),
  players: () => ipcRenderer.invoke('players'),
  redm: () => ipcRenderer.invoke('redm'),
  me: () => ipcRenderer.invoke('me'),
  game: () => ipcRenderer.invoke('game'),
  quitGame: () => ipcRenderer.invoke('quit-game'),
  image: (name) => ipcRenderer.invoke('image', name),
  version: () => ipcRenderer.invoke('version'),
  connect: () => ipcRenderer.invoke('connect'),
  open: (which) => ipcRenderer.invoke('open', which),
  window: (action) => ipcRenderer.send('window', action),
  onUpdate: (callback) => ipcRenderer.on('update', (_e, info) => callback(info)),
  installUpdate: () => ipcRenderer.send('update-install'),
  updateState: () => ipcRenderer.invoke('update-state'),
});
