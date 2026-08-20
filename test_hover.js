// Tests for provideHover behavior:
//   1) Hovering the definition itself -> null (default hover kept)
//   2) Hovering a call site -> Hover containing the implementation with the
//      "**Implementation:**" label
//   3) No definition -> null (default hover kept)
'use strict';
const path = require('path');
const Module = require('module');

const SRC = `def parse_config(general: str) -> dict:
    cfg = re.search(r'x', general).group()
    return cfg

result = parse_config('a')
`;

global.__TEST_DOC = { getText: () => SRC };
global.__TEST_DELAYMS = 0; // no artificial delay in tests

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
    if (request === 'vscode') return path.join(__dirname, 'vscode-mock.cjs');
    return origResolve.apply(this, [request, ...args]);
};

const { activate } = require('./extension.js');

const URI = { toString: () => 'file:///mock.py' };
const defRange = (contains) => ({ start: { line: 0 }, end: { line: 2 }, contains });
const position = { line: 0, character: 0 };
const document = {
    uri: URI,
    getWordRangeAtPosition: () => ({ start: position, end: position }),
};

function assert(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else { console.log('OK  :', msg); }
}

(async () => {
    activate({ subscriptions: [] });
    const provider = global.__LAST_PROVIDER;
    assert(provider !== undefined, 'hover provider registered');

    // 1) Hovering the definition itself: contains=true -> null
    global.__TEST_DEFS = [{ uri: URI, range: defRange(() => true) }];
    const r1 = await provider.provideHover(document, position);
    assert(r1 === null, 'hover on definition itself -> null (default hover kept)');

    // 2) Hovering a call site: contains=false -> Hover with implementation
    global.__TEST_DEFS = [{ uri: URI, range: defRange(() => false) }];
    const r2 = await provider.provideHover(document, position);
    assert(r2 !== null, 'hover on call site -> custom Hover returned');
    assert(r2.md.value.includes('**Implementation:**'), 'hover has the Implementation label');
    assert(r2.md.value.includes('def parse_config'), 'hover contains implementation');
    assert(r2.md.value.includes('return cfg'), 'hover contains body');
    assert(r2.md.lang === 'python', 'code block is python');

    // 3) No definition (built-ins etc.) -> null
    global.__TEST_DEFS = [];
    const r3 = await provider.provideHover(document, position);
    assert(r3 === null, 'no definition -> null (default hover kept)');

    console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL HOVER TESTS PASSED');
})();
