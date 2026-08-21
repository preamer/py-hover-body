# Python Hover Body

Shows the full function/method implementation in the hover tooltip, below the
original Pylance hover (signature + docstring). No navigation happens.

## Preview

```
# Hover over `foo` anywhere (including call sites)
│ def foo(a, b):          ← original Pylance hover (signature + docstring)
│     ...
│ **Implementation:**     ← implementation block, labeled, below
│ def foo(a, b):
│     x = a + b
│     return x * 2
└─────────────────────────────
```

- Resolves symbols across files and imported modules (via Pylance's symbol resolution)
- Supports `async def`, decorators and multi-line signatures
- Long functions are truncated at 200 lines by default (configurable)
- Hovering the definition itself keeps only the default hover (no duplicate implementation)
- Hovering a function parameter (even when used inside the body) keeps only the
  default hover — a parameter resolves to its slot in the signature, not to the function

## Install

### Option 1: Install from VSIX

```bash
code --install-extension py-hover-body-0.1.0.vsix
```

or in VS Code: Extensions panel (`Ctrl+Shift+X`) → `...` menu → **Install from VSIX...**

### Option 2: Development (F5)

1. Open this folder in VS Code
2. Press `F5` (requires the Python extension for Pylance)

### Option 3: Manual

Copy the whole `py-hover-body` folder to:

```
%USERPROFILE%\.vscode\extensions\
```

and restart VS Code.

## Settings

| Setting | Default | Description |
|---|---|---|
| `pyHoverBody.enabled` | `true` | Enable showing implementations on hover |
| `pyHoverBody.maxLines` | `200` | Max body lines shown (long functions are truncated) |
| `pyHoverBody.pylanceWaitMs` | `300` | Milliseconds to wait before returning the implementation block, giving Pylance's hover time to resolve first so our block appears below it (set to `0` to disable) |

## How it works

1. On hover, resolve the symbol under the cursor via `vscode.executeDefinitionProvider` (Pylance).
2. Open the definition document, locate the `def` line and extract the whole block
   (decorators + signature + body) by indentation.
3. VS Code merges hover results in **promise-resolution order** (`AsyncIterableProducer.fromPromisesResolveOrder`
   in `getHover.ts`) — registration order is irrelevant. Because this extension
   completes quickly (definition lookup + local file read), it would normally
   resolve before Pylance's heavier hover computation, causing the implementation
   block to appear *above* Pylance's output. To avoid this, the extension
   intentionally waits `pyHoverBody.pylanceWaitMs` milliseconds (default 300 ms)
   after computing the body before returning, giving Pylance's hover time to
   resolve first.
4. Return a Hover whose markdown is `**Implementation:**` followed by the extracted
   source as a highlighted code block.

## Rebuild the VSIX

```bash
python build_vsix.py
```

## Development

- `test_extract.js` / `test_hover.js` — unit tests (run with `node test_extract.js`, `node test_hover.js`)
- `vscode-mock.cjs` — mocked `vscode` module used by the tests
