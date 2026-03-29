# Contributing to FolderForge

Thank you for your interest in contributing to FolderForge! This guide will help you get started.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/) 9+
- [Git](https://git-scm.com/)

### Getting Started

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/folderforge.git
cd folderforge

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev

# 5. In another terminal, start Electron
npm run electron:dev
```

### Project Structure

```
folderforge/
├── electron/          # Electron main process & preload
│   ├── main.cjs       # Main process (IPC handlers, file system)
│   └── preload.cjs    # Context bridge (renderer API)
├── src/               # React frontend (renderer process)
│   ├── App.tsx        # Main application UI
│   ├── core.ts        # Template types, built-in templates, path builder
│   ├── index.css      # Global styles and design tokens
│   └── main.tsx       # React entry point
├── build/             # App icon and images
├── build-installer.js # Windows installer packaging script
└── package.json
```

## How to Contribute

### Reporting Bugs

1. Check the [existing issues](https://github.com/CyberWasDreaming0/folderforge/issues) to see if the bug has already been reported
2. If not, [open a new issue](https://github.com/CyberWasDreaming0/folderforge/issues/new?template=bug_report.md) using the bug report template
3. Include steps to reproduce, expected behavior, and screenshots if possible

### Suggesting Features

1. Check [existing feature requests](https://github.com/CyberWasDreaming0/folderforge/issues?q=label%3Aenhancement)
2. [Open a new issue](https://github.com/CyberWasDreaming0/folderforge/issues/new?template=feature_request.md) using the feature request template
3. Describe the problem your feature solves and how it should work

### Submitting Code

1. **Fork** the repository
2. **Create a branch** from `main` (`git checkout -b feature/my-feature`)
3. **Make your changes** — keep commits focused and well-described
4. **Run the linter** before committing: `npm run lint`
5. **Push** to your fork and **open a Pull Request** against `main`

### Code Style

- TypeScript for all source files
- Use existing patterns from the codebase
- Keep components focused and reusable
- Use the existing CSS custom properties (design tokens) for styling

## License

By contributing to FolderForge, you agree that your contributions will be licensed under the [MIT License](LICENSE).
