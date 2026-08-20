// Mock of the vscode API - used only for unit-testing extension.js.
'use strict';
module.exports = {
    workspace: {
        openTextDocument: async () => global.__TEST_DOC,
        getConfiguration: () => ({
            get: (key, def) => {
                if (key === 'maxLines') return global.__TEST_MAXLINES ?? def;
                if (key === 'delayMs') return global.__TEST_DELAYMS ?? def;
                return def; // 'enabled' etc.
            },
        }),
    },
    commands: { executeCommand: async () => global.__TEST_DEFS || [] },
    languages: {
        registerHoverProvider: (lang, provider) => {
            global.__LAST_PROVIDER = provider;
            return { dispose() {} };
        },
    },
    extensions: {
        getExtension: () => ({ isActive: true }), // assume Pylance already active
        onDidChange: () => ({ dispose() {} }),
    },
    Hover: class { constructor(md, range) { this.md = md; this.range = range; } },
    MarkdownString: class {
        constructor() { this.value = ''; this.lang = ''; }
        appendMarkdown(md) { this.value += md; }
        appendCodeblock(code, lang) { this.value += code; this.lang = lang; }
    },
};
