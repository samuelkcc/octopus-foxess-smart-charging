// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
const { contextBridge, ipcRenderer } = require('electron');
const invoke = (operation, value) => ipcRenderer.invoke('desktop:service', operation, value);
contextBridge.exposeInMainWorld('desktopHost', Object.freeze({
  platform: process.platform === 'darwin' ? 'macos' : 'windows',
  configuration: () => invoke('configuration'),
  saveConfiguration: value => invoke('saveConfiguration', value),
  status: () => invoke('status'),
  remoteAccess: () => invoke('remoteAccess'),
  setRemoteAccess: value => invoke('setRemoteAccess', value),
  copyRemoteKey: () => invoke('copyRemoteKey'),
  copyPublicUrl: () => invoke('copyPublicUrl'),
  copyLanCode: () => invoke('copyLanCode')
}));
