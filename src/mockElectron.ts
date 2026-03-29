export const mockElectronAPI = {
  minimize: () => console.log('Minimize window'),
  maximize: () => console.log('Maximize window'),
  close: () => console.log('Close window'),
  openDirectory: async () => {
    // Simulate folder picker
    return new Promise(resolve => setTimeout(() => resolve('/Users/demo/Projects'), 500));
  },
  createFolders: async (data: any[]) => {
    console.log('Creating folders/files:', data);
    return new Promise(resolve => setTimeout(() => resolve({ created: data.length, skipped: 0 }), 800));
  },
  scanDirectory: async (path: string, depth: number, files: boolean) => {
    return new Promise(resolve => setTimeout(() => resolve({
      id: 'scanned-root',
      name: 'ScannedFolder',
      type: 'folder',
      children: [
        { id: 's1', name: 'src', type: 'folder' },
        { id: 's2', name: 'README.md', type: 'file' }
      ]
    }), 1000));
  },
  loadSettings: async () => {
    const s = localStorage.getItem('ff_settings');
    return s ? JSON.parse(s) : { targetPath: '' };
  },
  saveSettings: async (data: any) => {
    localStorage.setItem('ff_settings', JSON.stringify(data));
  },
  loadHistory: async () => {
    const h = localStorage.getItem('ff_history');
    return h ? JSON.parse(h) : [];
  },
  saveHistory: async (entry: any) => {
    const h = localStorage.getItem('ff_history');
    const history = h ? JSON.parse(h) : [];
    history.unshift(entry);
    if (history.length > 100) history.pop();
    localStorage.setItem('ff_history', JSON.stringify(history));
  },
  clearHistory: async () => {
    localStorage.removeItem('ff_history');
  },
  loadCustomTemplates: async () => {
    const t = localStorage.getItem('ff_custom_templates');
    return t ? JSON.parse(t) : [];
  },
  saveCustomTemplate: async (t: any) => {
    const templatesStr = localStorage.getItem('ff_custom_templates');
    let templates = templatesStr ? JSON.parse(templatesStr) : [];
    const idx = templates.findIndex((x: any) => x.id === t.id);
    if (idx >= 0) templates[idx] = t;
    else templates.push(t);
    localStorage.setItem('ff_custom_templates', JSON.stringify(templates));
  },
  deleteCustomTemplate: async (id: string) => {
    const templatesStr = localStorage.getItem('ff_custom_templates');
    if (!templatesStr) return;
    let templates = JSON.parse(templatesStr);
    templates = templates.filter((x: any) => x.id !== id);
    localStorage.setItem('ff_custom_templates', JSON.stringify(templates));
  },
  openFile: async () => {
    return new Promise(resolve => setTimeout(() => resolve('/Users/demo/file.txt'), 500));
  },
  exportTemplate: async (template: any) => {
    console.log('Mock export template:', template.name);
    return true;
  },
  exportTemplateZip: async (template: any) => {
    console.log('Mock export template as ZIP:', template.name);
    return true;
  },
  importTemplate: async () => {
    console.log('Mock import template');
    return null;
  }
};

// Inject into window
(window as any).electronAPI = mockElectronAPI;
