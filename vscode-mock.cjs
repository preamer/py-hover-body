// Mock of the vscode API - used only for unit-testing extension.js.
'use strict';
module.exports = {
    workspace: {
        openTextDocument: async () => global.__TEST_DOC,
        getConfiguration: () => ({
            get: (key, def) => {
                if (key === 'maxLines') return global.__TEST_MAXLINES ?? def;
                return def; // 'enabled', 'pylanceWaitMs', etc. — use defaults
            },
        }),
    },
    commands: {
        executeCommand: async (cmd) => {
            if (cmd === 'vscode.executeDefinitionProvider') return global.__TEST_DEFS || [];
            return [];
        },
    },
    languages: {
        registerHoverProvider: (lang, provider) => {
            global.__LAST_PROVIDER = provider;
            global.__REGISTRATION_COUNT = (global.__REGISTRATION_COUNT || 0) + 1;
            return { dispose() {} };
        },
    },
    Hover: class { constructor(md, range) { this.md = md; this.range = range; } },
    MarkdownString: class {
        constructor() { this.value = ''; this.lang = ''; }
        appendMarkdown(md) { this.value += md; }
        appendCodeblock(code, lang) { this.value += code; this.lang = lang; }
    },
};
