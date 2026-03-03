/**
 * SMC Parser
 */

const parseScriptLines = (content) => {
    return normalize(content)
        .split('\n')
        .map((l, i) => ({ text: l.trim(), num: i + 1 }))
        .map(obj => ({ text: stripInlineComments(obj.text), num: obj.num }))
        .filter(obj => obj.text && !obj.text.startsWith('//') && !obj.text.toLowerCase().startsWith('rem '));
};

const parseDirective = (line) => {
    const match = line.match(/^\!\[\s*([^\]]+)\s*\]$/i);
    if (!match) return null;
    const parts = match[1]
        .split('|')
        .map(p => p.trim().toLowerCase())
        .filter(Boolean);
    return parts.length ? parts : null;
};

const extractInterpreterFlags = (linesObj) => {
    const interpreterFlags = [];
    const mask = new Array(linesObj.length).fill(false);
    let seenNonInterpreterLine = false;
    for (let i = 0; i < linesObj.length; i++) {
        const line = linesObj[i].text;
        const directive = parseDirective(line);
        if (!directive) {
            seenNonInterpreterLine = true;
            continue;
        }
        const isInterpreterOnly = directive.every(f => INTERPRETER_ONLY_FLAGS.has(f));
        if (!isInterpreterOnly) {
            seenNonInterpreterLine = true;
            continue;
        }
        if (seenNonInterpreterLine) {
            return { error: `Interpreter directives must appear before any other statements (Line ${linesObj[i].num}).` };
        }
        interpreterFlags.push(...directive);
        mask[i] = true;
    }
    const filtered = linesObj.filter((_, idx) => !mask[idx]);
    return { lines: filtered, flags: interpreterFlags };
};

const parseAssignment = (line) => {
    const declMatch = line.match(/^(global|let|set|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(=.*)?$/i);
    if (declMatch && !declMatch[2].startsWith('$')) {
        return { error: `Variable declaration '${declMatch[2]}' must start with '$' prefix.` };
    }

    const illegalMatch = line.match(/^(global|let|set|var)\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
    if (illegalMatch) return { error: `Strict Initialization: variable '${illegalMatch[2]}' must be initialized.` };

    const match = line.match(/^(global|let|set|var)\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
    if (match) return { type: match[1].toLowerCase(), name: match[2], value: match[3] };

    const reassignMatch = line.match(/^\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
    if (reassignMatch) return { type: 'reassign', name: reassignMatch[1], value: reassignMatch[2] };
    return null;
};

const parseWhile = (line) => {
    const match = line.match(/^while\s+(.+)\s+do$/i);
    return match ? match[1] : null;
};

const parseImport = (line) => {
    const match = line.match(/^import\s+(.+\.smc)$/i);
    return match ? match[1] : null;
};

const parseScriptBlock = (linesObj, startIdx = 0, terminators = []) => {
    const nodes = [];
    const terms = new Set(terminators.map(t => t.toLowerCase()));
    let i = startIdx;

    while (i < linesObj.length) {
        const obj = linesObj[i];
        const line = obj.text;
        const lineNum = obj.num;
        const lower = line.toLowerCase();
        if (terms.has(lower)) return { nodes, nextIdx: i + 1, terminator: lower };

        const directive = parseDirective(line);
        if (directive) {
            directive.forEach(flag => nodes.push({ type: 'directive', name: flag, lineNum }));
            i++; continue;
        }

        const waitMatch = line.match(/^wait\s+(.+)$/i);
        if (waitMatch) {
            nodes.push({ type: 'wait', value: waitMatch[1], lineNum });
            i++; continue;
        }

        if (lower === 'break') { nodes.push({ type: 'break', lineNum }); i++; continue; }
        if (lower === 'continue') { nodes.push({ type: 'continue', lineNum }); i++; continue; }
        const returnMatch = line.match(/^return\s+(.*)$/i);
        if (returnMatch) { nodes.push({ type: 'return', value: returnMatch[1].trim(), lineNum }); i++; continue; }

        const tryCatchMatch = line.match(/^(?:(var|global|let|set)\s+(\$?[A-Za-z_][A-Za-z0-9_]*)\s*=\s*)?try\s+(.+?)\s+catch\s+\$([A-Za-z_][A-Za-z0-9_]*)\s+(do|then)\s*(.*)$/i);
        if (tryCatchMatch) {
            const [_, type, name, expr, errVar, mode, thenCmd] = tryCatchMatch;
            if (mode.toLowerCase() === 'do') {
                const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
                if (bodyBlock.error) return bodyBlock;
                if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
                nodes.push({ type: 'try_catch', assignType: type ? type.toLowerCase() : null, varName: name, expression: expr, errVar, catchBody: bodyBlock.nodes, lineNum });
                i = bodyBlock.nextIdx;
            } else {
                nodes.push({ type: 'try_catch_inline', assignType: type ? type.toLowerCase() : null, varName: name, expression: expr, errVar, thenCmd, lineNum });
                i++;
            }
            continue;
        }

        const forMatch = line.match(/^for\s+\$([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+)\s+do$/i);
        if (forMatch) {
            const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
            if (bodyBlock.error) return bodyBlock;
            if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
            nodes.push({ type: 'for', varName: forMatch[1], rangeExpr: forMatch[2], body: bodyBlock.nodes, lineNum });
            i = bodyBlock.nextIdx; continue;
        }

        const assign = parseAssignment(line);
        if (assign) {
            if (assign.error) return { error: `${assign.error} at Line ${lineNum}` };
            nodes.push({ type: 'assign', assignType: assign.type, name: assign.name, value: assign.value, lineNum });
            i++; continue;
        }

        const varEchoMatch = line.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
        if (varEchoMatch) { nodes.push({ type: 'var_echo', name: varEchoMatch[1], lineNum }); i++; continue; }

        const whileExpr = parseWhile(line);
        if (whileExpr) {
            const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
            if (bodyBlock.error) return bodyBlock;
            if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
            nodes.push({ type: 'while', condition: whileExpr, body: bodyBlock.nodes, lineNum });
            i = bodyBlock.nextIdx; continue;
        }

        const importPath = parseImport(line);
        if (importPath) { nodes.push({ type: 'import', path: importPath, lineNum }); i++; continue; }

        const ifMatch = line.match(/^if\s+(.+)\s+then$/i);
        if (ifMatch) {
            const thenBlock = parseScriptBlock(linesObj, i + 1, ['else', 'end']);
            if (thenBlock.error) return thenBlock;
            if (thenBlock.terminator !== 'else' && thenBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
            let elseNodes = [];
            if (thenBlock.terminator === 'else') {
                const elseBlock = parseScriptBlock(linesObj, thenBlock.nextIdx, ['end']);
                if (elseBlock.error) return elseBlock;
                if (elseBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
                elseNodes = elseBlock.nodes;
                i = elseBlock.nextIdx;
            } else { i = thenBlock.nextIdx; }
            nodes.push({ type: 'if', condition: ifMatch[1].trim(), thenNodes: thenBlock.nodes, elseNodes, lineNum });
            continue;
        }

        const procMatch = line.match(/^proc\s+([@A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*(.*?))?\s+do$/i);
        if (procMatch) {
            const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
            if (bodyBlock.error) return bodyBlock;
            if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
            const argNames = procMatch[2] ? procMatch[2].split(',').map(a => a.trim()).filter(Boolean) : [];
            nodes.push({ type: 'proc', name: procMatch[1], argNames, body: bodyBlock.nodes, lineNum });
            i = bodyBlock.nextIdx; continue;
        }

        nodes.push({ type: 'cmd', line, lineNum });
        i++;
    }
    return { nodes, nextIdx: i, terminator: null };
};

const parseProcedureCallArgs = (argText, tokenize) => {
    const raw = (argText || '').trim();
    if (!raw) return [];

    const args = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if ((c === '"' || c === "'") && (i === 0 || raw[i - 1] !== '\\')) {
            if (!inQuotes) { inQuotes = true; quoteChar = c; }
            else if (c === quoteChar) { inQuotes = false; }
        }
        if (!inQuotes) {
            if (c === '[') depth++;
            else if (c === ']') depth--;
            else if (c === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
                continue;
            }
        }
        current += c;
    }
    if (current.trim()) args.push(current.trim());
    return args.length > 0 ? args : tokenize(raw);
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseScriptLines, parseDirective, extractInterpreterFlags, parseAssignment, parseWhile, parseImport, parseScriptBlock, parseProcedureCallArgs };
}
