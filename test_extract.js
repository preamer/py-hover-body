// Unit tests for the core extraction logic of extension.js (with a mocked vscode module).
'use strict';
const path = require('path');
const Module = require('module');

const SRC = `
import re

@lru_cache
def parse_config(general: str) -> dict:
    """doc"""
    cfg = re.search(r'^\(case-config.*', general, re.M).group()
    return {
        m[0]: m[1]
        for m in re.findall(r'\\(([^()\\s]+)\\s+\\.\\s+([^()\\s]+)\\)', cfg)
    }

def empty():
    pass

async def fetch():
    return 1

class Foo:
    def method(self, a):
        return a + 1
    def other(self):
        pass

x = 42
`;

const DOC = { getText: () => SRC };
global.__TEST_DOC = DOC;
global.__TEST_DELAYMS = 0; // no artificial delay in tests

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
    if (request === 'vscode') return path.join(__dirname, 'vscode-mock.cjs');
    return origResolve.apply(this, [request, ...args]);
};

const { extractImplementation } = require('./extension.js');

function loc(line0, char0) {
    return { uri: { toString: () => 'file:///mock.py' }, range: { start: { line: line0, character: char0 } } };
}

function assert(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else { console.log('OK  :', msg); }
}

(async () => {
    const lines = SRC.split('\n');
    const idxOf = (s) => lines.findIndex((l) => l.includes(s));

    // 1. Decorator + multi-line body
    const body1 = await extractImplementation(loc(idxOf('def parse_config')));
    assert(body1.includes('@lru_cache'), 'decorator included');
    assert(body1.includes('def parse_config(general: str) -> dict:'), 'signature included');
    assert(body1.includes('for m in re.findall'), 'body included');
    assert(!body1.includes('async def fetch'), 'stops before next def');

    // 2. Empty function (pass)
    const body2 = await extractImplementation(loc(idxOf('def empty')));
    assert(body2.trim() === 'def empty():\n    pass', 'empty fn: got [' + body2 + ']');

    // 3. async def
    const body3 = await extractImplementation(loc(idxOf('async def fetch')));
    assert(body3.includes('async def fetch'), 'async fn included');

    // 4. Class method (indent stops at class body)
    const body4 = await extractImplementation(loc(idxOf('def method')));
    assert(body4.includes('def method(self, a):'), 'method signature');
    assert(body4.includes('return a + 1'), 'method body');
    assert(!body4.includes('def other'), 'stops at sibling method');

    // 5. Non-function definition -> null
    const body5 = await extractImplementation(loc(idxOf('x = 42')));
    assert(body5 === null, 'non-function returns null');

    // 6. Definition pointing at a parameter slot in the signature -> null
    //    (this is what Pylance returns when hovering a parameter used in the body)
    const defIdx = idxOf('def parse_config');
    const paramCol = lines[defIdx].indexOf('general');
    const body6 = await extractImplementation(loc(defIdx, paramCol));
    assert(body6 === null, 'parameter slot in signature returns null (not the function)');

    // 7. Definition pointing at the function name -> still extracts
    const nameCol = lines[defIdx].indexOf('parse_config');
    const body7 = await extractImplementation(loc(defIdx, nameCol));
    assert(body7.includes('def parse_config'), 'function name location still extracts');

    console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL EXTRACTION TESTS PASSED');
})();
