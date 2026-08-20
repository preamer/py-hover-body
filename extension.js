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
 *
 * How it works:
 *   1. On hover, resolve the symbol under the cursor via Pylance's
 *      `vscode.executeDefinitionProvider` (handles imports and cross-file defs).
 *   2. Open the definition document, locate the `def` line and extract the
 *      whole block (decorators + signature + body) by indentation.
 *   3. VS Code merges hover providers' contents in promise-resolution order
 *      (see getHover.ts: fromPromisesResolveOrder), NOT registration order.
 *      Our extraction resolves faster than Pylance's hover, so we delay our
 *      own resolution (pyHoverBody.delayMs) to guarantee the implementation
 *      lands BELOW the default hover.
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
    if (!/^\s*(async\s+)?def\s/.test(defLine)) {
        return null; // not a function definition (e.g. variable, class)
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

function activate(context) {
    const provider = vscode.languages.registerHoverProvider('python', {
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

            // Hover contents are merged in promise-resolution order; wait a bit so
            // Pylance's content (resolved earlier) stays above ours.
            const delayMs = cfg.get('delayMs', 500);
            if (delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            const md = new vscode.MarkdownString();
            md.appendMarkdown('**Implementation:**\n\n');
            md.appendCodeblock(body, 'python');
            return new vscode.Hover(md, wordRange);
        },
    });
    context.subscriptions.push(provider);
}

function deactivate() {}

module.exports = { activate, deactivate, extractImplementation };
