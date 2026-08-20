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
| `pyHoverBody.delayMs` | `300` | Delay before returning the implementation (ms). VS Code merges hover providers' contents in promise-resolution order, so the delay keeps our content below Pylance's; `0` disables the delay |

## How it works

1. On hover, resolve the symbol under the cursor via `vscode.executeDefinitionProvider` (Pylance).
2. Open the definition document, locate the `def` line and extract the whole block
   (decorators + signature + body) by indentation.
3. VS Code merges hover providers' contents in promise-resolution order (see
   `getHover.ts: fromPromisesResolveOrder`), so the implementation is delayed by
   `delayMs` to land below the default hover.
4. Return a Hover whose markdown is `**Implementation:**` followed by the extracted
   source as a highlighted code block.

## Rebuild the VSIX

```bash
python build_vsix.py
```

## Development

- `test_extract.js` / `test_hover.js` — unit tests (run with `node test_extract.js`, `node test_hover.js`)
- `vscode-mock.cjs` — mocked `vscode` module used by the tests
