const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const AdmZip = require('adm-zip');

if (require('electron-squirrel-startup')) {
  app.quit();
}

// Determine if running in development or production
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0D0D0D',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// --- Helper: User Data File Paths ---
function getUserDataPath(filename) {
  const dir = app.getPath('userData');
  return path.join(dir, filename);
}

function readJSON(filepath, fallback) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${filepath}:`, err);
  }
  return fallback;
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// --- IPC Handlers ---

// Window controls
ipcMain.handle('minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('close', () => {
  mainWindow?.close();
});

// Open directory dialog
ipcMain.handle('open-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Open file dialog (for custom file picker)
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Create folders and files on disk
ipcMain.handle('create-folders', async (_event, items) => {
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const fullPath = path.join(item.basePath, item.path);
    try {
      if (item.isFile) {
        // Ensure parent directory exists
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        if (!fs.existsSync(fullPath)) {
          if (item.sourceFilePath && fs.existsSync(item.sourceFilePath)) {
            // Copy source file
            fs.copyFileSync(item.sourceFilePath, fullPath);
          } else {
            const ext = path.extname(fullPath).toLowerCase();
            if (ext === '.xlsx') {
              // Copy bundled empty Excel template
              const templateFile = isDev
                ? path.join(__dirname, 'templates', 'empty.xlsx')
                : path.join(process.resourcesPath, 'templates', 'empty.xlsx');
              fs.copyFileSync(templateFile, fullPath);
            } else {
              fs.writeFileSync(fullPath, item.content || '', 'utf-8');
            }
          }
          created++;
        } else {
          skipped++;
        }
      } else {
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
          created++;
        } else {
          skipped++;
        }
      }
    } catch (err) {
      console.error(`Error creating ${fullPath}:`, err);
      skipped++;
    }
  }

  return { created, skipped };
});

// Scan directory into a tree node
ipcMain.handle('scan-directory', async (_event, dirPath, maxDepth, includeFiles) => {
  function scanDir(currentPath, depth) {
    const name = path.basename(currentPath);
    const node = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type: 'folder',
      children: [],
    };

    if (depth >= maxDepth) return node;

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        // Skip hidden files/dirs
        if (entry.name.startsWith('.')) continue;

        const entryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          node.children.push(scanDir(entryPath, depth + 1));
        } else if (includeFiles) {
          node.children.push({
            id: Math.random().toString(36).substr(2, 9),
            name: entry.name,
            type: 'file',
          });
        }
      }
    } catch (err) {
      console.error(`Error scanning ${currentPath}:`, err);
    }

    return node;
  }

  return scanDir(dirPath, 0);
});

// Settings
ipcMain.handle('load-settings', () => {
  return readJSON(getUserDataPath('settings.json'), { targetPath: '' });
});

ipcMain.handle('save-settings', (_event, data) => {
  writeJSON(getUserDataPath('settings.json'), data);
});

// History
ipcMain.handle('load-history', () => {
  return readJSON(getUserDataPath('history.json'), []);
});

ipcMain.handle('save-history', (_event, entry) => {
  const history = readJSON(getUserDataPath('history.json'), []);
  history.unshift(entry);
  if (history.length > 100) history.pop();
  writeJSON(getUserDataPath('history.json'), history);
});

ipcMain.handle('clear-history', () => {
  writeJSON(getUserDataPath('history.json'), []);
});

// Custom Templates
ipcMain.handle('load-custom-templates', () => {
  return readJSON(getUserDataPath('templates.json'), []);
});

ipcMain.handle('save-custom-template', (_event, template) => {
  const templates = readJSON(getUserDataPath('templates.json'), []);
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.push(template);
  }
  writeJSON(getUserDataPath('templates.json'), templates);
});

ipcMain.handle('delete-custom-template', (_event, id) => {
  let templates = readJSON(getUserDataPath('templates.json'), []);
  templates = templates.filter((t) => t.id !== id);
  writeJSON(getUserDataPath('templates.json'), templates);
});

// Export template to JSON file
ipcMain.handle('export-template', async (_event, template) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Template',
    defaultPath: `${template.name.replace(/[^a-z0-9]/gi, '_')}.folderforge.json`,
    filters: [
      { name: 'FolderForge Template', extensions: ['folderforge.json', 'json'] },
    ],
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(template, null, 2), 'utf-8');
  return true;
});

// Helper: recursively collect all sourceFilePath entries from a template tree
function collectLinkedFiles(node) {
  const files = [];
  if (node.sourceFilePath) files.push(node.sourceFilePath);
  if (node.children) {
    for (const child of node.children) {
      files.push(...collectLinkedFiles(child));
    }
  }
  return files;
}

// Helper: recursively rewrite sourceFilePath in template tree
function rewriteSourcePaths(node, pathMap) {
  if (node.sourceFilePath && pathMap[node.sourceFilePath]) {
    node.sourceFilePath = pathMap[node.sourceFilePath];
  }
  if (node.children) {
    for (const child of node.children) {
      rewriteSourcePaths(child, pathMap);
    }
  }
}

// Export template as ZIP with linked files
ipcMain.handle('export-template-zip', async (_event, template) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Template as ZIP',
    defaultPath: `${template.name.replace(/[^a-z0-9]/gi, '_')}.folderforge.zip`,
    filters: [
      { name: 'FolderForge Template Bundle', extensions: ['zip'] },
    ],
  });
  if (result.canceled || !result.filePath) return false;

  const linkedFiles = collectLinkedFiles(template.root);

  // Build a copy of the template with rewritten paths
  const exportTemplate = JSON.parse(JSON.stringify(template));
  const pathMap = {};
  const usedNames = new Set();

  for (const filePath of linkedFiles) {
    let baseName = path.basename(filePath);
    // Handle name collisions by prefixing with a counter
    let finalName = baseName;
    let counter = 1;
    while (usedNames.has(finalName)) {
      const ext = path.extname(baseName);
      const nameNoExt = path.basename(baseName, ext);
      finalName = `${nameNoExt}_${counter}${ext}`;
      counter++;
    }
    usedNames.add(finalName);
    pathMap[filePath] = `linked_files/${finalName}`;
  }

  rewriteSourcePaths(exportTemplate.root, pathMap);

  return new Promise((resolve) => {
    const output = fs.createWriteStream(result.filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(true));
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      resolve(false);
    });

    archive.pipe(output);

    // Add the template JSON
    archive.append(JSON.stringify(exportTemplate, null, 2), { name: 'template.folderforge.json' });

    // Add linked files
    for (const [originalPath, archivePath] of Object.entries(pathMap)) {
      if (fs.existsSync(originalPath)) {
        archive.file(originalPath, { name: archivePath });
      }
    }

    archive.finalize();
  });
});

// Import template from JSON or ZIP file
ipcMain.handle('import-template', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Template',
    filters: [
      { name: 'FolderForge Template', extensions: ['folderforge.json', 'json', 'zip'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.zip') {
      // ZIP import
      const zip = new AdmZip(filePath);
      const templateEntry = zip.getEntry('template.folderforge.json');
      if (!templateEntry) return null;

      const templateStr = templateEntry.getData().toString('utf-8');
      const template = JSON.parse(templateStr);
      if (!template.name || !template.root) return null;

      // Extract linked files to userData
      const importDir = path.join(app.getPath('userData'), 'imported_files', template.id || Math.random().toString(36).substr(2, 9));
      if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });

      // Rewrite linked_files/ paths to absolute paths in userData
      const rewriteImportPaths = (node) => {
        if (node.sourceFilePath && node.sourceFilePath.startsWith('linked_files/')) {
          const relativeName = node.sourceFilePath.replace('linked_files/', '');
          const entry = zip.getEntry(node.sourceFilePath);
          if (entry) {
            const destPath = path.join(importDir, relativeName);
            fs.writeFileSync(destPath, entry.getData());
            node.sourceFilePath = destPath;
          }
        }
        if (node.children) {
          for (const child of node.children) {
            rewriteImportPaths(child);
          }
        }
      };

      rewriteImportPaths(template.root);

      // Give it a new ID to avoid collisions
      template.id = 'imported_' + Math.random().toString(36).substr(2, 9);
      return template;
    } else {
      // JSON import (existing behavior)
      const content = fs.readFileSync(filePath, 'utf-8');
      const template = JSON.parse(content);
      if (!template.name || !template.root) return null;
      template.id = 'imported_' + Math.random().toString(36).substr(2, 9);
      return template;
    }
  } catch (err) {
    console.error('Failed to import template:', err);
    return null;
  }
});

// --- App lifecycle ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
