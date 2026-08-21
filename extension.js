/**
 * Python Hover Body
 *
 * Shows the full function/method implementation in the hover tooltip below
 * the original Pylance hover (signature + docstring). No navigation happens.
 *
 * Behavior:
 *   - Hovering a call site or any reference shows the implementation labeled
 *     "Implementation:" BELOW the Pylance hover.
 *   - Hovering the definition itself keeps only the default hover.
 *   - Hovering a function parameter (even when used inside the body) keeps
 *     only the default hover, since the definition provider resolves it to
 *     the parameter slot in the signature, not to the function itself.
 *
 * How it works:
 *   1. On hover, resolve the symbol under the cursor via Pylance's
 *      `vscode.executeDefinitionProvider` (handles imports and cross-file defs).
 *   2. Open the definition document, locate the `def` line and extract the
 *      whole block (decorators + signature + body) by indentation.
 *   3. VS Code merges hover results in PROMISE RESOLUTION ORDER
 *      (`AsyncIterableProducer.fromPromisesResolveOrder` in getHover.ts) —
 *      registration order is irrelevant. Because our provider completes
 *      quickly (definition lookup + local file read), it would normally
 *      resolve before Pylance's heavier hover computation, causing our block
 *      to appear ABOVE Pylance's. We therefore intentionally delay our
 *      response by `pyHoverBody.pylanceWaitMs` milliseconds so that Pylance's
 *      hover resolves first and our implementation lands below it.
 *   4. Return a Hover whose markdown is "**Implementation:**" followed by the
 *      extracted source as a highlighted code block.
 */

const vscode = require('vscode');



/** Extract `def` + body (plus decorators above) from a definition location. */
async function extractImplementation(location) {
    const doc = await vscode.workspace.openTextDocument(location.uri);
    const lines = doc.getText().split(/\r?\n/);
    const defIndex = location.range.start.line; // 0-based

    // Start at the `def` line and collect decorator lines above it.
    let start = defIndex;
    while (start > 0 && lines[start - 1].trim().startsWith('@')) {
        start--;
    }

    const defLine = lines[defIndex];
    const defMatch = defLine.match(/^\s*(async\s+)?def\s+([A-Za-z_]\w*)/);
    if (!defMatch) {
        return null; // not a function definition (e.g. variable, class)
    }

    // The definition provider resolves a parameter used inside the body to
    // its slot in the signature (a range on the `def` line that starts after
    // the function name). Only treat the target as "the function" when its
    // range points at the function name itself; otherwise keep the default
    // hover instead of dumping the whole implementation.
    const startChar = location.range.start.character;
    if (typeof startChar === 'number') {
        const nameStart = defMatch.index + defMatch[0].indexOf(defMatch[2]);
        const nameEnd = nameStart + defMatch[2].length;
        if (startChar > nameEnd) {
            return null; // definition points into the parameter list
        }
    }

    // Base indent = the `def` line's indent; the body ends at the first
    // non-empty line that is not indented deeper than the `def` line.
    const baseIndent = (defLine.match(/^(\s*)/) || ['', ''])[1];
    let end = lines.length;
    for (let i = defIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
            continue;
        }
        const indent = (line.match(/^(\s*)/) || ['', ''])[1];
        if (indent.length <= baseIndent.length) {
            end = i;
            break;
        }
    }

    const maxLines = vscode.workspace.getConfiguration('pyHoverBody').get('maxLines', 200);
    let slice = lines.slice(start, end);
    if (slice.length > maxLines) {
        slice = slice.slice(0, maxLines).concat([`    # ... (${slice.length - maxLines} more lines)`]);
    }
    return slice.join('\n');
}

function createHoverProvider() {
    return vscode.languages.registerHoverProvider('python', {
        async provideHover(document, position) {
            const cfg = vscode.workspace.getConfiguration('pyHoverBody');
            if (!cfg.get('enabled', true)) {
                return null;
            }

            const wordRange = document.getWordRangeAtPosition(position, /[\w\.]+/);
            if (!wordRange) {
                return null;
            }

            // Resolve the symbol under the cursor via Pylance.
            const defs = await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                document.uri,
                position,
            );
            if (!defs || defs.length === 0) {
                return null; // built-ins etc. have no definition: keep the default hover
            }

            // Prefer the definition in the current document, otherwise the first one.
            const target = defs.find((d) => d.uri.toString() === document.uri.toString()) || defs[0];

            // Hovering the definition itself: keep only the default hover.
            if (target.uri.toString() === document.uri.toString() && target.range.contains(position)) {
                return null;
            }

            const body = await extractImplementation(target);
            if (!body) {
                return null;
            }

            // VS Code renders hover results in promise-resolution order. Our
            // provider finishes quickly (definition lookup + local file read)
            // and would appear ABOVE Pylance's heavier hover computation.
            // Waiting here gives Pylance's hover time to resolve first so our
            // implementation block lands below it.
            const waitMs = typeof global.__TEST_DELAYMS === 'number'
                ? global.__TEST_DELAYMS
                : vscode.workspace.getConfiguration('pyHoverBody').get('pylanceWaitMs', 300);
            if (waitMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }

            const md = new vscode.MarkdownString();
            md.appendMarkdown('**Implementation:**\n\n');
            md.appendCodeblock(body, 'python');
            return new vscode.Hover(md, wordRange);
        },
    });
}

function activate(context) {
    context.subscriptions.push(createHoverProvider());
}

function deactivate() {}

module.exports = { activate, deactivate, extractImplementation };
