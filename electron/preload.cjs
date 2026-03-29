const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('minimize'),
  maximize: () => ipcRenderer.invoke('maximize'),
  close: () => ipcRenderer.invoke('close'),

  // File system operations
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  openFile: () => ipcRenderer.invoke('open-file'),
  createFolders: (items) => ipcRenderer.invoke('create-folders', items),
  scanDirectory: (dirPath, maxDepth, includeFiles) =>
    ipcRenderer.invoke('scan-directory', dirPath, maxDepth, includeFiles),

  // Settings
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // History
  loadHistory: () => ipcRenderer.invoke('load-history'),
  saveHistory: (entry) => ipcRenderer.invoke('save-history', entry),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Custom Templates
  loadCustomTemplates: () => ipcRenderer.invoke('load-custom-templates'),
  saveCustomTemplate: (template) => ipcRenderer.invoke('save-custom-template', template),
  deleteCustomTemplate: (id) => ipcRenderer.invoke('delete-custom-template', id),
  exportTemplate: (template) => ipcRenderer.invoke('export-template', template),
  exportTemplateZip: (template) => ipcRenderer.invoke('export-template-zip', template),
  importTemplate: () => ipcRenderer.invoke('import-template'),
});
