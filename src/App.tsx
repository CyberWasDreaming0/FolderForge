import React, { useState, useEffect, useRef } from 'react';
import { builtinTemplates, Template, TreeNode, buildPaths, GeneratedPath, extractVariablesFromTree } from './core';
import { Folder, File, Settings, Plus, History, HelpCircle, Search, Edit2, Trash2, Check, X, ChevronRight, ChevronDown, Play, Save, FolderPlus, FilePlus, ScanLine, GripVertical, Undo2, Redo2, Download, Upload, AlertTriangle, Package, FileText } from 'lucide-react';

// --- Types ---
type Screen = 'selector' | 'builder';

// --- Empty template factory ---
function createEmptyTemplate(): Template {
  return {
    id: 'custom_' + Math.random().toString(36).substr(2, 9),
    name: 'New Template',
    category: 'custom',
    icon: '📁',
    description: '',
    variables: ['project_name'],
    root: {
      id: 'root_' + Math.random().toString(36).substr(2, 9),
      name: '{project_name}',
      type: 'folder',
      children: [
        {
          id: Math.random().toString(36).substr(2, 9),
          name: 'New Folder',
          type: 'folder',
          children: [
            {
              id: Math.random().toString(36).substr(2, 9),
              name: 'document.txt',
              type: 'file'
            }
          ]
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          name: 'New Folder',
          type: 'folder'
        }
      ]
    }
  };
}

// --- Main App Component ---
export default function App() {
  const [screen, setScreen] = useState<Screen>('selector');
  const [templates, setTemplates] = useState<Template[]>(builtinTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(builtinTemplates[0]);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [hiddenBuiltinIds, setHiddenBuiltinIds] = useState<string[]>([]);
  
  // NEW: editing template (null = new from scratch, template = editing existing)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  // NEW: search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [vars, setVars] = useState<Record<string, string>>({});
  const [targetPath, setTargetPath] = useState<string>('');
  const [disabledNodes, setDisabledNodes] = useState<Set<string>>(new Set());
  
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  // Export options state
  const [showExportOptions, setShowExportOptions] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const api = (window as any).electronAPI;
      const settings = await api.loadSettings();
      if (settings.targetPath) setTargetPath(settings.targetPath);
      const hidden = settings.hiddenBuiltinIds || [];
      setHiddenBuiltinIds(hidden);
      
      const custom = await api.loadCustomTemplates();
      setCustomTemplates(custom);
      const visibleBuiltins = builtinTemplates.filter(b => !hidden.includes(b.id));
      setTemplates([...visibleBuiltins, ...custom]);
      setSelectedTemplate([...visibleBuiltins, ...custom][0] || builtinTemplates[0]);
    };
    loadData();
  }, []);

  // Auto-extract variables from the template tree
  const autoExtractedVars = React.useMemo(() => extractVariablesFromTree(selectedTemplate.root), [selectedTemplate]);

  useEffect(() => {
    const initialVars: Record<string, string> = {};
    autoExtractedVars.forEach(v => initialVars[v] = '');
    setVars(initialVars);
    setDisabledNodes(new Set());
  }, [selectedTemplate, autoExtractedVars]);

  const showToast = (msg: string, type: 'success'|'error'|'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async () => {
    if (!targetPath) {
      showToast('Please select a target path', 'error');
      return;
    }
    
    const missing = autoExtractedVars.filter(v => !vars[v]);
    if (missing.length > 0) {
      showToast(`Missing variables: ${missing.join(', ')}`, 'error');
      return;
    }

    const paths = buildPaths(selectedTemplate.root, '', vars, disabledNodes);
    
    try {
      const api = (window as any).electronAPI;
      const result = await api.createFolders(paths.map(p => ({ ...p, basePath: targetPath })));
      
      await api.saveHistory({
        templateName: selectedTemplate.name,
        path: targetPath,
        timestamp: new Date().toISOString(),
        created: result.created
      });
      
      showToast(`Successfully created ${result.created} items`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to create folders', 'error');
    }
  };

  const handleBrowse = async () => {
    const api = (window as any).electronAPI;
    const path = await api.openDirectory();
    if (path) {
      setTargetPath(path);
      api.saveSettings({ targetPath: path });
    }
  };

  // FIX #1: Plus button opens empty editor
  const handleNewTemplate = () => {
    setEditingTemplate(createEmptyTemplate());
    setScreen('builder');
  };

  // Edit existing template
  const handleEditTemplate = () => {
    setEditingTemplate(JSON.parse(JSON.stringify(selectedTemplate)));
    setScreen('builder');
  };

  // Delete template handler
  const handleDeleteTemplate = async (template: Template) => {
    const api = (window as any).electronAPI;
    const isBuiltin = builtinTemplates.some(b => b.id === template.id);

    if (isBuiltin) {
      // Hide the builtin template
      const newHidden = [...hiddenBuiltinIds, template.id];
      setHiddenBuiltinIds(newHidden);
      const settings = await api.loadSettings();
      await api.saveSettings({ ...settings, hiddenBuiltinIds: newHidden });
    } else {
      // Delete the custom template
      await api.deleteCustomTemplate(template.id);
    }

    const custom = await api.loadCustomTemplates();
    setCustomTemplates(custom);
    const updatedHidden = isBuiltin ? [...hiddenBuiltinIds, template.id] : hiddenBuiltinIds;
    const visibleBuiltins = builtinTemplates.filter(b => !updatedHidden.includes(b.id));
    const allTemplates = [...visibleBuiltins, ...custom];
    setTemplates(allTemplates);
    if (selectedTemplate.id === template.id) {
      setSelectedTemplate(allTemplates[0] || builtinTemplates[0]);
    }
    setShowDeleteConfirm(false);
    setTemplateToDelete(null);
    showToast('Template deleted', 'success');
  };

  // Helper: check if template has linked source files
  const getLinkedFiles = (node: TreeNode): string[] => {
    const files: string[] = [];
    if (node.sourceFilePath) files.push(node.sourceFilePath);
    if (node.children) {
      for (const child of node.children) {
        files.push(...getLinkedFiles(child));
      }
    }
    return files;
  };

  const isCustomTemplate = (t: Template) => !builtinTemplates.find(b => b.id === t.id);

  // Filtered templates for search
  const filteredTemplates = searchQuery.trim()
    ? templates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templates;

  return (
    <div className="flex flex-col h-screen bg-bg text-text-main overflow-hidden">
      <TitleBar />
      
      {screen === 'selector' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Templates */}
          <div className="w-1/3 border-r border-border flex flex-col bg-surface">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Templates</h2>
              <div className="flex gap-2">
                {/* FIX #1: Plus opens empty editor */}
                <button onClick={handleNewTemplate} className="p-1.5 hover:bg-card rounded text-accent" title="New Template">
                  <Plus size={18} />
                </button>
                {/* FIX #3: Search toggle */}
                <button onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); }} className={`p-1.5 hover:bg-card rounded ${searchOpen ? 'text-accent bg-card' : ''}`} title="Search Templates">
                  <Search size={18} />
                </button>
                <button onClick={() => setShowScan(true)} className="p-1.5 hover:bg-card rounded" title="Scan Folder">
                  <ScanLine size={18} />
                </button>
                <button onClick={async () => {
                  const api = (window as any).electronAPI;
                  const imported = await api.importTemplate();
                  if (imported) {
                    await api.saveCustomTemplate(imported);
                    const custom = await api.loadCustomTemplates();
                    setCustomTemplates(custom);
                    setTemplates([...builtinTemplates, ...custom]);
                    setSelectedTemplate(imported);
                    showToast('Template imported successfully', 'success');
                  } else {
                    showToast('Import cancelled or invalid file', 'error');
                  }
                }} className="p-1.5 hover:bg-card rounded" title="Import Template">
                  <Upload size={18} />
                </button>
                <button onClick={() => setShowHistory(true)} className="p-1.5 hover:bg-card rounded" title="History">
                  <History size={18} />
                </button>
                <button onClick={() => setShowHelp(true)} className="p-1.5 hover:bg-card rounded" title="Help">
                  <HelpCircle size={18} />
                </button>
              </div>
            </div>

            {/* FIX #3: Search bar */}
            {searchOpen && (
              <div className="px-3 py-2 border-b border-border bg-bg">
                <div className="flex items-center gap-2 bg-surface border border-border rounded px-3 py-1.5">
                  <Search size={14} className="text-text-secondary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                    placeholder="Search templates..."
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-text-secondary hover:text-text-main">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredTemplates.length === 0 ? (
                <div className="text-center text-text-secondary py-8 text-sm">No templates found.</div>
              ) : (
                filteredTemplates.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`p-3 rounded-lg cursor-pointer border transition-all group/card relative ${
                      selectedTemplate.id === t.id 
                        ? 'bg-card border-accent shadow-[0_0_10px_var(--color-accent-glow)]' 
                        : 'border-transparent hover:bg-card hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-text-secondary capitalize">{t.category}</div>
                      </div>
                      <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateToDelete(t);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1.5 rounded opacity-0 group-hover/card:opacity-100 transition-opacity text-text-secondary hover:text-danger hover:bg-danger/10"
                          title="Delete Template"
                        >
                          <Trash2 size={14} />
                        </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Preview & Config */}
          <div className="flex-1 flex flex-col bg-bg">
            <div className="p-6 border-b border-border flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <h1 className="text-2xl font-extrabold">{selectedTemplate.name}</h1>
                </div>
                <p className="text-text-secondary">{selectedTemplate.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button 
                  onClick={handleEditTemplate} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded hover:bg-card transition-colors"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button 
                  onClick={() => setShowExportOptions(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded hover:bg-card transition-colors"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {autoExtractedVars.length > 0 && (
                <div className="bg-surface border border-border rounded-lg p-4">
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Variables</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {autoExtractedVars.map(v => (
                      <div key={v}>
                        <label className="block text-xs mb-1 text-text-secondary">{v}</label>
                        <input 
                          type="text" 
                          value={vars[v] || ''}
                          onChange={e => setVars({...vars, [v]: e.target.value})}
                          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
                          placeholder={`Enter ${v}...`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 bg-surface border border-border rounded-lg p-4 flex flex-col min-h-[300px]">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Preview</h3>
                <div className="flex-1 overflow-auto font-mono text-sm bg-bg p-4 rounded border border-border">
                  <TreePreview 
                    node={selectedTemplate.root} 
                    vars={vars} 
                    disabledNodes={disabledNodes}
                    setDisabledNodes={setDisabledNodes}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface flex items-center gap-4">
              <div className="flex-1 flex items-center gap-2 bg-bg border border-border rounded px-3 py-2">
                <Folder size={16} className="text-text-secondary" />
                <input 
                  type="text" 
                  value={targetPath}
                  onChange={e => setTargetPath(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                  placeholder="Select target directory..."
                />
                <button onClick={handleBrowse} className="text-xs bg-surface hover:bg-card px-2 py-1 rounded border border-border">
                  Browse
                </button>
              </div>
              <button 
                onClick={handleCreate}
                className="flex items-center gap-2 bg-accent text-bg font-bold px-6 py-2 rounded hover:bg-accent-dim transition-colors"
              >
                <Play size={16} /> Create Structure
              </button>
            </div>
          </div>
        </div>
      ) : (
        <TemplateBuilder 
          initialTemplate={editingTemplate || selectedTemplate} 
          showToast={showToast}
          onClose={() => setScreen('selector')} 
          onSave={async (t: any) => {
            const api = (window as any).electronAPI;
            await api.saveCustomTemplate(t);
            const custom = await api.loadCustomTemplates();
            setCustomTemplates(custom);
            setTemplates([...builtinTemplates, ...custom]);
            setSelectedTemplate(t);
            setScreen('selector');
            showToast('Template saved successfully', 'success');
          }}
        />
      )}

      {/* Modals & Toasts */}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showScan && <ScanModal onClose={() => setShowScan(false)} onSave={async (t) => {
        const api = (window as any).electronAPI;
        await api.saveCustomTemplate(t);
        const custom = await api.loadCustomTemplates();
        setCustomTemplates(custom);
        setTemplates([...builtinTemplates, ...custom]);
        setSelectedTemplate(t);
        setShowScan(false);
        showToast('Scanned template saved', 'success');
      }} />}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && templateToDelete && (
        <Modal title="Delete Template" onClose={() => { setShowDeleteConfirm(false); setTemplateToDelete(null); }}>
          <div className="text-center py-4 space-y-6">
            <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={32} className="text-danger" />
            </div>
            <div>
              <p className="text-lg font-bold mb-2">Are you sure?</p>
              <p className="text-text-secondary">
                This will permanently delete the template <span className="text-text-main font-semibold">"{templateToDelete.name}"</span>. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => { setShowDeleteConfirm(false); setTemplateToDelete(null); }}
                className="px-6 py-2 bg-surface border border-border rounded hover:bg-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTemplate(templateToDelete)}
                className="px-6 py-2 bg-danger text-white font-bold rounded hover:bg-danger/80 transition-colors"
              >
                Delete Template
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Export Options Modal */}
      {showExportOptions && (
        <Modal title="Export Template" onClose={() => setShowExportOptions(false)}>
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Choose how to export <span className="text-text-main font-semibold">"{selectedTemplate.name}"</span>
            </p>

            {/* Option 1: JSON Only */}
            <button
              onClick={async () => {
                setShowExportOptions(false);
                const api = (window as any).electronAPI;
                const success = await api.exportTemplate(selectedTemplate);
                if (success) showToast('Template exported as JSON', 'success');
              }}
              className="w-full p-4 bg-surface border border-border rounded-lg hover:border-accent hover:bg-card transition-all flex items-start gap-4 text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                <FileText size={20} className="text-accent" />
              </div>
              <div>
                <div className="font-bold mb-1">JSON Only</div>
                <div className="text-xs text-text-secondary">Export as a .folderforge.json file. Linked source files will not be included — the recipient must have those files at the same paths on their system.</div>
              </div>
            </button>

            {/* Option 2: ZIP with linked files */}
            {(() => {
              const linkedFiles = getLinkedFiles(selectedTemplate.root);
              return (
                <button
                  onClick={async () => {
                    setShowExportOptions(false);
                    const api = (window as any).electronAPI;
                    const success = await api.exportTemplateZip(selectedTemplate);
                    if (success) showToast('Template exported as ZIP with linked files', 'success');
                    else showToast('Export cancelled', 'info');
                  }}
                  className="w-full p-4 bg-surface border border-border rounded-lg hover:border-accent hover:bg-card transition-all flex items-start gap-4 text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                    <Package size={20} className="text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold mb-1">ZIP Bundle (with linked files)</div>
                    <div className="text-xs text-text-secondary mb-2">Export as a .zip archive containing the template config and all linked source files. Perfect for sharing with others.</div>
                    {linkedFiles.length > 0 ? (
                      <div className="bg-bg rounded border border-border p-2 mt-2">
                        <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1.5 font-bold">{linkedFiles.length} linked file{linkedFiles.length > 1 ? 's' : ''} will be included:</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {linkedFiles.map((f, i) => (
                            <div key={i} className="text-[11px] font-mono text-accent truncate" title={f}>
                              {f.split(/[/\\]/).pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-text-secondary italic">No linked files in this template — same as JSON export.</div>
                    )}
                  </div>
                </button>
              );
            })()}
          </div>
        </Modal>
      )}
      
      {toast && (
        <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg flex items-center gap-2 z-50 ${
          toast.type === 'error' ? 'bg-danger text-white' : 
          toast.type === 'success' ? 'bg-accent text-bg' : 'bg-surface border border-border text-text-main'
        }`}>
          {toast.type === 'success' && <Check size={16} />}
          {toast.type === 'error' && <X size={16} />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

// --- TitleBar Component ---
function TitleBar() {
  const api = (window as any).electronAPI;
  return (
    <div className="h-10 bg-bg border-b border-border flex justify-between items-center px-4 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center gap-2 text-accent font-bold tracking-wide">
        <div className="w-3 h-3 bg-accent rotate-45"></div>
        FolderForge
      </div>
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button onClick={() => api.minimize()} className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-text-main"><div className="w-3 h-[2px] bg-current"></div></button>
        <button onClick={() => api.maximize()} className="p-1.5 hover:bg-surface rounded text-text-secondary hover:text-text-main"><div className="w-3 h-3 border-2 border-current"></div></button>
        <button onClick={() => api.close()} className="p-1.5 hover:bg-danger hover:text-white rounded text-text-secondary hover:text-text-main"><X size={14} /></button>
      </div>
    </div>
  );
}

// --- TreePreview Component ---
function TreePreview({ node, vars, disabledNodes, setDisabledNodes, depth = 0, isLast = true, prefix = '' }: any) {
  const isDisabled = disabledNodes.has(node.id);
  
  let displayName = node.name;
  for (const [k, v] of Object.entries(vars)) {
    if (v) displayName = displayName.replace(new RegExp(`\\{${k}\\}`, 'g'), v as string);
  }

  const toggleNode = () => {
    const newSet = new Set(disabledNodes);
    if (isDisabled) newSet.delete(node.id);
    else newSet.add(node.id);
    setDisabledNodes(newSet);
  };

  return (
    <div>
      <div className={`flex items-center gap-2 py-0.5 hover:bg-surface/50 rounded px-1 ${isDisabled ? 'opacity-40' : ''}`}>
        <span className="text-text-secondary whitespace-pre">{prefix}{depth > 0 ? (isLast ? '└── ' : '├── ') : ''}</span>
        
        {node.optional && (
          <input 
            type="checkbox" 
            checked={!isDisabled} 
            onChange={toggleNode}
            className="w-3 h-3 accent-accent cursor-pointer"
          />
        )}
        
        {node.type === 'folder' ? (
          <Folder size={14} className={isDisabled ? 'text-text-secondary' : 'text-accent'} />
        ) : (
          <File size={14} className="text-text-secondary" />
        )}
        
        <span className={node.type === 'folder' ? 'font-bold' : ''}>{displayName}</span>
      </div>
      
      {node.type === 'folder' && node.children && !isDisabled && (
        <div>
          {node.children.map((child: any, idx: number) => (
            <TreePreview 
              key={child.id} 
              node={child} 
              vars={vars}
              disabledNodes={disabledNodes}
              setDisabledNodes={setDisabledNodes}
              depth={depth + 1}
              isLast={idx === node.children.length - 1}
              prefix={prefix + (depth > 0 ? (isLast ? '    ' : '│   ') : '')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- TemplateBuilder Component ---
function TemplateBuilder({ initialTemplate, onClose, onSave, showToast }: any) {
  const [template, _setTemplate] = useState<Template>(JSON.parse(JSON.stringify(initialTemplate)));
  const [undoStack, setUndoStack] = useState<Template[]>([]);
  const [redoStack, setRedoStack] = useState<Template[]>([]);

  const setTemplate = (newTemplate: Template) => {
    setUndoStack(prev => [...prev, template]);
    setRedoStack([]);
    _setTemplate(newTemplate);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [template, ...prev]);
    setUndoStack(prev => prev.slice(0, -1));
    _setTemplate(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack(prev => [...prev, template]);
    setRedoStack(prev => prev.slice(1));
    _setTemplate(next);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [template, undoStack, redoStack]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(template.root.id);
  const [filePrompt, setFilePrompt] = useState<{parentId: string} | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | 'inside' | null>(null);
  const [showEditorHelp, setShowEditorHelp] = useState(false);
  const [showEditorScan, setShowEditorScan] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  const originalRef = useRef<string>(JSON.stringify(initialTemplate));
  useEffect(() => {
    setHasChanges(JSON.stringify(template) !== originalRef.current);
  }, [template]);

  const handleBack = () => {
    if (hasChanges) {
      setShowConfirmExit(true);
    } else {
      onClose();
    }
  };

  const findNode = (root: TreeNode, id: string): TreeNode | null => {
    if (root.id === id) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const updateNode = (id: string, updates: Partial<TreeNode>) => {
    const newTemplate = JSON.parse(JSON.stringify(template));
    const node = findNode(newTemplate.root, id);
    if (node) {
      Object.assign(node, updates);
      setTemplate(newTemplate);
    }
  };

  const addNode = (parentId: string, type: 'folder' | 'file', defaultName?: string, sourceFilePath?: string) => {
    const newTemplate = JSON.parse(JSON.stringify(template));
    const parent = findNode(newTemplate.root, parentId);
    if (parent && parent.type === 'folder') {
      if (!parent.children) parent.children = [];
      const newNode: TreeNode = {
        id: Math.random().toString(36).substr(2, 9),
        name: defaultName || (type === 'folder' ? 'New Folder' : 'New File'),
        type,
        ...(sourceFilePath ? { sourceFilePath } : {})
      };
      parent.children.push(newNode);
      setTemplate(newTemplate);
      setSelectedNodeId(newNode.id);
    }
  };

  // FIX #7: Improved moveNode with position awareness (above/below/inside)
  const moveNode = (draggedId: string, targetId: string, position: 'above' | 'below' | 'inside') => {
    if (draggedId === targetId) return;
    const newTemplate = JSON.parse(JSON.stringify(template));

    const findNodeAndParent = (root: TreeNode, id: string, parent: TreeNode | null = null): { node: TreeNode, parent: TreeNode | null } | null => {
      if (root.id === id) return { node: root, parent };
      if (root.children) {
        for (const child of root.children) {
          const found = findNodeAndParent(child, id, root);
          if (found) return found;
        }
      }
      return null;
    };

    const isDescendant = (root: TreeNode, id: string): boolean => {
      if (root.id === id) return true;
      if (root.children) return root.children.some(child => isDescendant(child, id));
      return false;
    };

    const draggedInfo = findNodeAndParent(newTemplate.root, draggedId);
    const targetInfo = findNodeAndParent(newTemplate.root, targetId);

    if (!draggedInfo || !targetInfo) return;
    if (isDescendant(draggedInfo.node, targetId)) {
      showToast("Cannot move a folder into itself", "error");
      return;
    }

    // Remove from old parent
    if (draggedInfo.parent && draggedInfo.parent.children) {
      draggedInfo.parent.children = draggedInfo.parent.children.filter((c: TreeNode) => c.id !== draggedId);
    } else {
      return; // Cannot move root
    }

    if (position === 'inside') {
      // Drop into folder
      if (targetInfo.node.type === 'folder') {
        if (!targetInfo.node.children) targetInfo.node.children = [];
        targetInfo.node.children.push(draggedInfo.node);
      } else {
        // If dropping "inside" a file, insert after it
        if (targetInfo.parent && targetInfo.parent.children) {
          const targetIndex = targetInfo.parent.children.findIndex((c: TreeNode) => c.id === targetId);
          targetInfo.parent.children.splice(targetIndex + 1, 0, draggedInfo.node);
        }
      }
    } else {
      // Drop above or below a sibling
      const parentNode = targetInfo.parent;
      if (parentNode && parentNode.children) {
        const targetIndex = parentNode.children.findIndex((c: TreeNode) => c.id === targetId);
        const insertIndex = position === 'above' ? targetIndex : targetIndex + 1;
        parentNode.children.splice(insertIndex, 0, draggedInfo.node);
      }
    }
    setTemplate(newTemplate);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // FIX #7: Improved drag over with position detection
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    const node = findNode(template.root, id);
    
    if (node?.type === 'folder') {
      if (y < height * 0.25) {
        setDragPosition('above');
      } else if (y > height * 0.75) {
        setDragPosition('below');
      } else {
        setDragPosition('inside');
      }
    } else {
      if (y < height * 0.5) {
        setDragPosition('above');
      } else {
        setDragPosition('below');
      }
    }
    setDragOverId(id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    setDragPosition(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && dragPosition) {
      moveNode(draggedId, targetId, dragPosition);
    }
    setDragOverId(null);
    setDragPosition(null);
  };

  const deleteNode = (id: string) => {
    if (id === template.root.id) return;
    const newTemplate = JSON.parse(JSON.stringify(template));
    
    const removeChild = (node: TreeNode): boolean => {
      if (node.children) {
        const idx = node.children.findIndex(c => c.id === id);
        if (idx >= 0) {
          node.children.splice(idx, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeChild(child)) return true;
        }
      }
      return false;
    };
    
    removeChild(newTemplate.root);
    setTemplate(newTemplate);
    setSelectedNodeId(newTemplate.root.id);
  };

  const selectedNode = findNode(template.root, selectedNodeId);

  return (
    <div className="flex-1 flex flex-col bg-bg z-10 absolute inset-0 top-10">
      {/* Top Bar */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-card rounded text-text-secondary hover:text-text-main">
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <input 
            type="text" 
            value={template.name}
            onChange={e => setTemplate({...template, name: e.target.value})}
            className="bg-transparent text-xl font-bold focus:outline-none focus:border-b border-accent px-1"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button onClick={handleUndo} disabled={undoStack.length === 0} className={`p-2 rounded ${undoStack.length === 0 ? 'text-text-secondary/30 cursor-not-allowed' : 'text-text-secondary hover:text-text-main hover:bg-card'}`} title="Undo (Ctrl+Z)">
            <Undo2 size={18} />
          </button>
          <button onClick={handleRedo} disabled={redoStack.length === 0} className={`p-2 rounded ${redoStack.length === 0 ? 'text-text-secondary/30 cursor-not-allowed' : 'text-text-secondary hover:text-text-main hover:bg-card'}`} title="Redo (Ctrl+Y)">
            <Redo2 size={18} />
          </button>
          <div className="w-px h-6 bg-border mx-1"></div>
          {/* FIX #2: Help icon in editor */}
          <button onClick={() => setShowEditorHelp(true)} className="p-2 hover:bg-card rounded text-text-secondary hover:text-text-main" title="Pattern Reference">
            <HelpCircle size={18} />
          </button>
          <button 
            onClick={() => {
              const tToSave = { ...template };
              // Auto-extract variables from the tree before saving
              tToSave.variables = extractVariablesFromTree(tToSave.root);
              if (builtinTemplates.find(b => b.id === tToSave.id)) {
                tToSave.id = 'custom_' + Math.random().toString(36).substr(2, 9);
              }
              onSave(tToSave);
            }}
            className="flex items-center gap-2 bg-accent text-bg font-bold px-4 py-1.5 rounded hover:bg-accent-dim transition-colors"
          >
            <Save size={16} /> Save Template
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Properties */}
        <div className="w-80 border-r border-border bg-surface flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Template Info</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1 text-text-secondary">Icon (Emoji)</label>
                <input 
                  type="text" 
                  value={template.icon}
                  onChange={e => setTemplate({...template, icon: e.target.value})}
                  className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs mb-1 text-text-secondary">Description</label>
                <textarea 
                  value={template.description}
                  onChange={e => setTemplate({...template, description: e.target.value})}
                  className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent h-20 resize-none"
                />
              </div>

            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Node Properties</h3>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs mb-1 text-text-secondary">Name / Pattern</label>
                  <input 
                    type="text" 
                    value={selectedNode.name}
                    onChange={e => updateNode(selectedNode.id, { name: e.target.value })}
                    className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent font-mono"
                  />
                  <p className="text-[10px] text-text-secondary mt-1">Supports {'{var}'} and {'{1..5}'} patterns</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="opt"
                    checked={selectedNode.optional || false}
                    onChange={e => updateNode(selectedNode.id, { optional: e.target.checked })}
                    className="w-4 h-4 accent-accent"
                  />
                  <label htmlFor="opt" className="text-sm">Optional (can be unchecked)</label>
                </div>

                {selectedNode.type === 'file' && (
                  <>
                    {selectedNode.sourceFilePath ? (
                      <div>
                        <label className="block text-xs mb-1 text-text-secondary">Source File</label>
                        <div className="bg-bg border border-border rounded px-3 py-1.5 text-sm font-mono text-accent truncate">
                          {selectedNode.sourceFilePath}
                        </div>
                        <p className="text-[10px] text-text-secondary mt-1">This file will be copied when creating the structure.</p>
                      </div>
                    ) : (() => {
                      const ext = selectedNode.name.split('.').pop()?.toLowerCase() || '';
                      const binaryExts = ['xlsx', 'docx', 'csv'];
                      if (binaryExts.includes(ext)) return null;
                      return (
                        <div>
                          <label className="block text-xs mb-1 text-text-secondary">File Content (Optional)</label>
                          <textarea 
                            value={selectedNode.content || ''}
                            onChange={e => updateNode(selectedNode.id, { content: e.target.value })}
                            className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent h-32 font-mono resize-none"
                            placeholder="Initial file content..."
                          />
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-text-secondary italic">Select a node to edit properties</div>
            )}
          </div>
        </div>

        {/* Center Canvas: Tree Editor */}
        <div className="flex-1 bg-bg p-8 overflow-auto relative" style={{ backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          <div className="bg-surface border border-border rounded-xl p-6 min-w-[400px] inline-block shadow-xl">
            <BuilderNode 
              node={template.root} 
              selectedId={selectedNodeId} 
              onSelect={setSelectedNodeId}
              onAdd={addNode}
              onDelete={deleteNode}
              onUpdateNode={updateNode}
              isRoot={true}
              dragOverId={dragOverId}
              dragPosition={dragPosition}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onAddFileClick={(parentId: string) => setFilePrompt({ parentId })}
            />
          </div>
        </div>
      </div>

      {/* FIX #5: File type picker with more types, smaller cards, custom file picks from disk */}
      {filePrompt && (
        <Modal title="Select File Type" onClose={() => setFilePrompt(null)}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'Text File', ext: 'document.txt', icon: '📄' },
              { name: 'Markdown', ext: 'README.md', icon: '📝' },
              { name: 'JSON File', ext: 'data.json', icon: '📋' },
              { name: 'CSV File', ext: 'data.csv', icon: '📊' },
              { name: '.gitignore', ext: '.gitignore', icon: '🚫' },
              { name: 'License', ext: 'LICENSE', icon: '📃' },
              { name: 'Word Doc', ext: 'document.docx', icon: '📘' },
              { name: 'Excel', ext: 'spreadsheet.xlsx', icon: '📗' },
            ].map(type => (
              <button
                key={type.name}
                onClick={() => {
                  addNode(filePrompt.parentId, 'file', type.ext);
                  setFilePrompt(null);
                }}
                className="flex flex-col items-center gap-1.5 p-3 bg-bg border border-border rounded-lg hover:border-accent hover:bg-card transition-colors"
              >
                <span className="text-2xl">{type.icon}</span>
                <span className="font-medium text-xs">{type.name}</span>
              </button>
            ))}
            {/* FIX #5: Custom File picks from disk */}
            <button
              onClick={async () => {
                const api = (window as any).electronAPI;
                const filePath = await api.openFile();
                if (filePath) {
                  const fileName = filePath.split(/[/\\]/).pop() || 'custom_file';
                  addNode(filePrompt.parentId, 'file', fileName, filePath);
                  setFilePrompt(null);
                }
              }}
              className="flex flex-col items-center gap-1.5 p-3 bg-bg border-2 border-dashed border-accent/40 rounded-lg hover:border-accent hover:bg-card transition-colors"
            >
              <span className="text-2xl">📂</span>
              <span className="font-medium text-xs text-accent">Pick File</span>
            </button>
          </div>
        </Modal>
      )}

      {/* FIX #2: Help modal in editor */}
      {showEditorHelp && <HelpModal onClose={() => setShowEditorHelp(false)} />}
      
      {/* FIX #4: Scan modal in editor */}
      {showEditorScan && <ScanModal onClose={() => setShowEditorScan(false)} onSave={(scannedTemplate) => {
        const newTemplate = JSON.parse(JSON.stringify(template));
        if (newTemplate.root.children) {
          newTemplate.root.children.push(...(scannedTemplate.root.children || []));
        } else {
          newTemplate.root.children = scannedTemplate.root.children || [];
        }
        setTemplate(newTemplate);
        setShowEditorScan(false);
        showToast('Scanned structure added to template', 'success');
      }} />}

      {/* Unsaved changes confirmation */}
      {showConfirmExit && (
        <Modal title="Unsaved Changes" onClose={() => setShowConfirmExit(false)}>
          <div className="text-center py-4 space-y-6">
            <p className="text-text-secondary">You have unsaved changes. Are you sure you want to go back? All progress will be lost.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowConfirmExit(false)}
                className="px-6 py-2 bg-surface border border-border rounded hover:bg-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirmExit(false); onClose(); }}
                className="px-6 py-2 bg-danger text-white font-bold rounded hover:bg-danger/80 transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// FIX #6: Inline rename component
function InlineRename({ value, onSave, className }: { value: string, onSave: (v: string) => void, className?: string }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={() => { onSave(editValue); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(editValue); setEditing(false); }
          if (e.key === 'Escape') { setEditValue(value); setEditing(false); }
        }}
        className={`bg-bg border border-accent rounded px-1 py-0 text-sm focus:outline-none font-mono ${className || ''}`}
        style={{ width: Math.max(editValue.length * 8, 60) + 'px' }}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`cursor-text ${className || ''}`}
      title="Double-click to rename"
    >
      {value}
    </span>
  );
}

function BuilderNode({ node, selectedId, onSelect, onAdd, onDelete, onUpdateNode, isRoot = false, dragOverId, dragPosition, onDragStart, onDragOver, onDragLeave, onDrop, onAddFileClick }: any) {
  const isSelected = selectedId === node.id;
  const [expanded, setExpanded] = useState(true);

  // FIX #7: Visual drop indicators
  const isDragTarget = dragOverId === node.id;
  const showAboveLine = isDragTarget && dragPosition === 'above';
  const showBelowLine = isDragTarget && dragPosition === 'below';
  const showInsideHighlight = isDragTarget && dragPosition === 'inside';

  return (
    <div className="ml-4 relative">
      {!isRoot && (
        <div className="absolute -left-4 top-4 w-4 h-px bg-border"></div>
      )}
      {!isRoot && (
        <div className="absolute -left-4 -top-2 bottom-0 w-px bg-border last:bottom-auto last:h-6"></div>
      )}

      {/* FIX #7: Drop indicator line above */}
      {showAboveLine && !isRoot && (
        <div className="absolute -left-4 right-0 top-0 h-0.5 bg-accent z-10 rounded-full shadow-[0_0_6px_var(--color-accent)]"></div>
      )}
      
      <div 
        draggable={!isRoot}
        onDragStart={(e) => !isRoot && onDragStart(e, node.id)}
        onDragOver={(e) => onDragOver(e, node.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node.id)}
        className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer group transition-colors ${
          isSelected ? 'bg-card border border-accent shadow-[0_0_8px_var(--color-accent-glow)]' : 'border border-transparent hover:bg-surface'
        } ${showInsideHighlight ? 'ring-2 ring-accent bg-accent/20' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      >
        {node.type === 'folder' && node.children && node.children.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-text-secondary hover:text-text-main">
            <ChevronDown size={14} className={`transform transition-transform ${expanded ? '' : '-rotate-90'}`} />
          </button>
        ) : (
          <div className="w-3.5"></div>
        )}
        
        {node.type === 'folder' ? <Folder size={16} className="text-accent" /> : <File size={16} className="text-text-secondary" />}
        
        {/* FIX #6: Double-click to rename inline */}
        <InlineRename
          value={node.name}
          onSave={(newName) => onUpdateNode(node.id, { name: newName })}
          className={`font-mono text-sm ${node.type === 'folder' ? 'font-bold' : ''}`}
        />
        
        {node.optional && <span className="text-[10px] bg-card px-1.5 py-0.5 rounded text-text-secondary border border-border">OPT</span>}
        {node.name.includes('{') && node.name.includes('..') && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/30">BULK</span>}

        <div className={`ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100' : ''}`}>
          {node.type === 'folder' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onAdd(node.id, 'folder'); }} className="p-1 hover:bg-surface rounded text-text-secondary hover:text-accent" title="Add Folder"><FolderPlus size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); onAddFileClick(node.id); }} className="p-1 hover:bg-surface rounded text-text-secondary hover:text-accent" title="Add File"><FilePlus size={14} /></button>
            </>
          )}
          {!isRoot && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="p-1 hover:bg-surface rounded text-text-secondary hover:text-danger" title="Delete"><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      {/* FIX #7: Drop indicator line below */}
      {showBelowLine && !isRoot && (
        <div className="absolute -left-4 right-0 bottom-0 h-0.5 bg-accent z-10 rounded-full shadow-[0_0_6px_var(--color-accent)]"></div>
      )}

      {node.type === 'folder' && expanded && node.children && (
        <div className="mt-1">
          {node.children.map((child: any) => (
            <BuilderNode 
              key={child.id} 
              node={child} 
              selectedId={selectedId} 
              onSelect={onSelect}
              onAdd={onAdd}
              onDelete={onDelete}
              onUpdateNode={onUpdateNode}
              dragOverId={dragOverId}
              dragPosition={dragPosition}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onAddFileClick={onAddFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Modals ---
function Modal({ title, onClose, children }: any) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-[600px] max-w-[90vw] max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-card rounded text-text-secondary hover:text-text-main">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ onClose }: any) {
  const [history, setHistory] = useState<any[]>([]);
  
  useEffect(() => {
    const api = (window as any).electronAPI;
    api.loadHistory().then(setHistory);
  }, []);

  return (
    <Modal title="Creation History" onClose={onClose}>
      {history.length === 0 ? (
        <div className="text-center text-text-secondary py-8">No history yet.</div>
      ) : (
        <div className="space-y-3">
          {history.map((h, i) => (
            <div key={i} className="bg-card border border-border p-3 rounded-lg flex justify-between items-center">
              <div>
                <div className="font-bold">{h.templateName}</div>
                <div className="text-xs text-text-secondary font-mono mt-1">{h.path}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-accent">{h.created} items</div>
                <div className="text-xs text-text-secondary">{new Date(h.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function HelpModal({ onClose }: any) {
  return (
    <Modal title="Pattern Reference" onClose={onClose}>
      <div className="space-y-6 text-sm">
        <div>
          <h3 className="font-bold text-accent mb-2">Variables</h3>
          <p className="text-text-secondary mb-2">Use curly braces to insert variables. Built-in variables are always available.</p>
          <ul className="list-disc pl-5 space-y-1 text-text-secondary bg-card p-3 rounded border border-border font-mono">
            <li>{'{date}'} → 2026-03-17</li>
            <li>{'{year}'} → 2026</li>
            <li>{'{month}'} → 03</li>
            <li>{'{project_name}'} → Custom user input</li>
          </ul>
        </div>
        
        <div>
          <h3 className="font-bold text-accent mb-2">Numeric Ranges</h3>
          <p className="text-text-secondary mb-2">Generate multiple folders sequentially.</p>
          <ul className="list-disc pl-5 space-y-1 text-text-secondary bg-card p-3 rounded border border-border font-mono">
            <li>{'{1..5}'} → 1, 2, 3, 4, 5</li>
            <li>{'{01..12}'} → 01, 02, ... 12 (Zero-padded)</li>
            <li>{'Sprint_{1..3}'} → Sprint_1, Sprint_2, Sprint_3</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-accent mb-2">Comma Lists</h3>
          <p className="text-text-secondary mb-2">Generate specific named folders.</p>
          <ul className="list-disc pl-5 space-y-1 text-text-secondary bg-card p-3 rounded border border-border font-mono">
            <li>{'{Mon,Tue,Wed}'} → Mon, Tue, Wed</li>
            <li>{'Asset_{UI,Audio,3D}'} → Asset_UI, Asset_Audio, Asset_3D</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function ScanModal({ onClose, onSave }: any) {
  const [scanning, setScanning] = useState(false);
  
  const handleScan = async () => {
    setScanning(true);
    const api = (window as any).electronAPI;
    const path = await api.openDirectory();
    if (path) {
      const rootNode = await api.scanDirectory(path, 3, true);
      const newTemplate: Template = {
        id: 'custom_' + Math.random().toString(36).substr(2, 9),
        name: 'Scanned Template',
        category: 'custom',
        icon: '📁',
        description: `Scanned from ${path}`,
        variables: [],
        root: rootNode
      };
      onSave(newTemplate);
    } else {
      setScanning(false);
    }
  };

  return (
    <Modal title="Scan Directory" onClose={onClose}>
      <div className="text-center py-8 space-y-6">
        <Folder size={48} className="mx-auto text-accent opacity-50" />
        <p className="text-text-secondary">
          Select an existing folder on your computer. FolderForge will scan its structure and convert it into a reusable template.
        </p>
        <button 
          onClick={handleScan}
          disabled={scanning}
          className="bg-accent text-bg font-bold px-6 py-2 rounded hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          {scanning ? 'Scanning...' : 'Select Folder to Scan'}
        </button>
      </div>
    </Modal>
  );
}
