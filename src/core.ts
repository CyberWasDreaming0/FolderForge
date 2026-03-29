export type TreeNode = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  optional?: boolean;
  children?: TreeNode[];
  content?: string;
  sourceFilePath?: string; // path to a file on disk to copy when creating
};

export type Template = {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  variables: string[];
  root: TreeNode;
};

export const builtinTemplates: Template[] = [
  {
    id: 'premiere-pro',
    name: 'Premiere Pro Project',
    category: 'creative',
    icon: '🎬',
    description: 'Standard folder structure for video editing projects.',
    variables: ['project_name'],
    root: {
      id: 'root',
      name: '{project_name}',
      type: 'folder',
      children: [
        { id: '1', name: '01_Project_Files', type: 'folder' },
        { id: '2', name: '02_Footage', type: 'folder', children: [
          { id: '21', name: 'Cam_A', type: 'folder' },
          { id: '22', name: 'Cam_B', type: 'folder' },
          { id: '23', name: 'Audio', type: 'folder' }
        ]},
        { id: '3', name: '03_Assets', type: 'folder', children: [
          { id: '31', name: 'Graphics', type: 'folder' },
          { id: '32', name: 'Music', type: 'folder' },
          { id: '33', name: 'SFX', type: 'folder' }
        ]},
        { id: '4', name: '04_Exports', type: 'folder' }
      ]
    }
  },
  {
    id: 'downloads-org',
    name: 'Downloads (Organized)',
    category: 'personal',
    icon: '📥',
    description: 'Organize your downloads folder by file type.',
    variables: [],
    root: {
      id: 'root',
      name: 'Downloads_Organized',
      type: 'folder',
      children: [
        { id: '1', name: 'Images', type: 'folder' },
        { id: '2', name: 'Documents', type: 'folder' },
        { id: '3', name: 'Software', type: 'folder' },
        { id: '4', name: 'Archives', type: 'folder' },
        { id: '5', name: 'Media', type: 'folder' }
      ]
    }
  },
  {
    id: 'software-dev',
    name: 'Software Dev Project',
    category: 'development',
    icon: '💻',
    description: 'Basic structure for a software development project.',
    variables: ['project_name'],
    root: {
      id: 'root',
      name: '{project_name}',
      type: 'folder',
      children: [
        { id: '1', name: 'src', type: 'folder', children: [
          { id: '11', name: 'components', type: 'folder' },
          { id: '12', name: 'utils', type: 'folder' }
        ]},
        { id: '2', name: 'docs', type: 'folder' },
        { id: '3', name: 'tests', type: 'folder' },
        { id: '4', name: '.gitignore', type: 'file', content: 'node_modules/\ndist/\n.env' },
        { id: '5', name: 'README.md', type: 'file', content: '# {project_name}\n\nProject description goes here.' }
      ]
    }
  },
  {
    id: 'unity-game',
    name: 'Unity Game Project',
    category: 'creative',
    icon: '🎮',
    description: 'Standard Unity project asset structure.',
    variables: ['project_name'],
    root: {
      id: 'root',
      name: '{project_name}',
      type: 'folder',
      children: [
        { id: '1', name: 'Assets', type: 'folder', children: [
          { id: '11', name: 'Scripts', type: 'folder' },
          { id: '12', name: 'Scenes', type: 'folder' },
          { id: '13', name: 'Prefabs', type: 'folder' },
          { id: '14', name: 'Materials', type: 'folder' },
          { id: '15', name: 'Models', type: 'folder' },
          { id: '16', name: 'Audio', type: 'folder' },
          { id: '17', name: 'Textures', type: 'folder' }
        ]}
      ]
    }
  },
  {
    id: 'freelance-client',
    name: 'Freelance Client',
    category: 'business',
    icon: '💼',
    description: 'Folder structure for a new freelance client and project.',
    variables: ['client_name', 'project_name'],
    root: {
      id: 'root',
      name: '{client_name}',
      type: 'folder',
      children: [
        { id: '1', name: '01_Contracts_Invoices', type: 'folder' },
        { id: '2', name: '02_Provided_Assets', type: 'folder' },
        { id: '3', name: '03_Workspace', type: 'folder', children: [
          { id: '31', name: '{project_name}', type: 'folder', children: [
            { id: '311', name: 'Drafts', type: 'folder' },
            { id: '312', name: 'Final', type: 'folder' }
          ]}
        ]},
        { id: '4', name: '04_Deliverables', type: 'folder' }
      ]
    }
  }
];

export function resolveVariables(name: string, vars: Record<string, string>): string {
  let resolved = name;
  const date = new Date();
  const builtins: Record<string, string> = {
    date: date.toISOString().split('T')[0],
    year: date.getFullYear().toString(),
    month: (date.getMonth() + 1).toString().padStart(2, '0')
  };
  
  const allVars = { ...builtins, ...vars };
  for (const [key, value] of Object.entries(allVars)) {
    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value || `{${key}}`);
  }
  return resolved;
}

export function expandPattern(name: string): string[] {
  const rangeMatch = name.match(/\{(\d+)\.\.(\d+)\}/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    const pad = rangeMatch[1].startsWith('0') ? rangeMatch[1].length : 0;
    const results: string[] = [];
    for (let i = start; i <= end; i++) {
      let numStr = i.toString();
      if (pad > 0) numStr = numStr.padStart(pad, '0');
      results.push(name.replace(rangeMatch[0], numStr));
    }
    return results.flatMap(res => expandPattern(res));
  }

  const listMatch = name.match(/\{([^}]+,[^}]+)\}/);
  if (listMatch) {
    const items = listMatch[1].split(',');
    const results: string[] = [];
    for (const item of items) {
      results.push(name.replace(listMatch[0], item.trim()));
    }
    return results.flatMap(res => expandPattern(res));
  }

  return [name];
}

export type GeneratedPath = {
  path: string;
  isFile: boolean;
  content?: string;
  sourceFilePath?: string;
};

export function buildPaths(
  node: TreeNode, 
  basePath: string, 
  vars: Record<string, string>, 
  disabledNodes: Set<string>
): GeneratedPath[] {
  if (disabledNodes.has(node.id)) return [];

  const resolvedName = resolveVariables(node.name, vars);
  const expandedNames = expandPattern(resolvedName);
  
  let paths: GeneratedPath[] = [];

  for (const expName of expandedNames) {
    const currentPath = basePath ? `${basePath}/${expName}` : expName;
    
    paths.push({
      path: currentPath,
      isFile: node.type === 'file',
      content: node.content ? resolveVariables(node.content, vars) : undefined,
      sourceFilePath: node.sourceFilePath
    });

    if (node.type === 'folder' && node.children) {
      for (const child of node.children) {
        paths.push(...buildPaths(child, currentPath, vars, disabledNodes));
      }
    }
  }

  return paths;
}

// Built-in variables that don't need user input
const BUILTIN_VARIABLES = new Set(['date', 'year', 'month']);

/**
 * Recursively extract variable names from {varname} patterns in all node names.
 * Excludes range patterns like {1..5} and list patterns like {a,b,c}.
 */
export function extractVariablesFromTree(node: TreeNode): string[] {
  const vars = new Set<string>();

  function walk(n: TreeNode) {
    // Match all {something} patterns in the node name
    const matches = n.name.matchAll(/\{([^}]+)\}/g);
    for (const match of matches) {
      const inner = match[1];
      // Skip range patterns like 1..5
      if (/^\d+\.\.\d+$/.test(inner)) continue;
      // Skip list patterns like a,b,c
      if (inner.includes(',')) continue;
      // Skip built-in variables
      if (BUILTIN_VARIABLES.has(inner)) continue;
      vars.add(inner);
    }
    if (n.children) {
      for (const child of n.children) {
        walk(child);
      }
    }
  }

  walk(node);
  return Array.from(vars);
}
