/**
 * SMC Parser
 */

const normalize = (content) => {
    if (typeof content !== 'string') return '';
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

const stripInlineComments = (line) => {
    let inQuotes = false;
    let quoteChar = '';
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if ((c === '"' || c === "'") && (i === 0 || line[i - 1] !== '\\')) {
            if (!inQuotes) { inQuotes = true; quoteChar = c; }
            else if (c === quoteChar) { inQuotes = false; }
        }
        if (!inQuotes && c === '#') return line.substring(0, i).trim();
    }
    return line.trim();
};

const parseScriptLines = (content) => {
    const rawLines = normalize(content).split('\n');
    const processed = [];
    for (let i = 0; i < rawLines.length; i++) {
        const raw = rawLines[i];
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.toLowerCase().startsWith('rem ')) continue;
        
        const stripped = stripInlineComments(raw);
        if (!stripped) continue;

        const col = raw.indexOf(stripped) + 1;
        processed.push({ text: stripped, num: i + 1, col, raw });
    }
    return processed;
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

const extractInterpreterFlags = (lines) => {
    const flags = [];
    const filteredLines = [];
    for (const lineObj of lines) {
        const d = parseDirective(lineObj.text);
        if (d) flags.push(...d);
        else filteredLines.push(lineObj);
    }
    return { flags, lines: filteredLines };
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
    const match = line.match(/^import\s+["']?(.+\.smc)["']?$/i);
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
        const col = obj.col;
        const lower = line.toLowerCase();
        if (terms.has(lower)) return { nodes, nextIdx: i + 1, terminator: lower };

        const directive = parseDirective(line);
        if (directive) {
            directive.forEach(flag => nodes.push({ type: 'directive', name: flag, lineNum, col }));
            i++; continue;
        }

        const waitMatch = line.match(/^wait\s+(.+)$/i);
        if (waitMatch) {
            nodes.push({ type: 'wait', value: waitMatch[1], lineNum, col });
            i++; continue;
        }

        if (lower === 'break') { nodes.push({ type: 'break', lineNum, col }); i++; continue; }
        if (lower === 'continue') { nodes.push({ type: 'continue', lineNum, col }); i++; continue; }
        const returnMatch = line.match(/^return\s+(.*)$/i);
        if (returnMatch) { nodes.push({ type: 'return', value: returnMatch[1].trim(), lineNum, col }); i++; continue; }

        const forMatch = line.match(/^for\s+\$([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+)\s+do$/i);
        if (forMatch) {
            const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
            if (bodyBlock.error) return bodyBlock;
            if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
            nodes.push({ type: 'for', varName: forMatch[1], rangeExpr: forMatch[2], body: bodyBlock.nodes, lineNum, col });
            i = bodyBlock.nextIdx; continue;
        }

        const assign = parseAssignment(line);
        if (assign) {
            if (assign.error) return { error: `${assign.error} at Line ${lineNum}` };
            nodes.push({ type: 'assign', assignType: assign.type, name: assign.name, value: assign.value, lineNum, col });
            i++; continue;
        }

        const varEchoMatch = line.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
        if (varEchoMatch) { nodes.push({ type: 'var_echo', name: varEchoMatch[1], lineNum, col }); i++; continue; }

        const whileExpr = parseWhile(line);
        if (whileExpr) {
            const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
            if (bodyBlock.error) return bodyBlock;
            if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
            nodes.push({ type: 'while', condition: whileExpr, body: bodyBlock.nodes, lineNum, col });
            i = bodyBlock.nextIdx; continue;
        }

        const importPath = parseImport(line);
        if (importPath) { nodes.push({ type: 'import', path: importPath, lineNum, col }); i++; continue; }

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
            nodes.push({ type: 'if', condition: ifMatch[1].trim(), thenNodes: thenBlock.nodes, elseNodes, lineNum, col });
            continue;
        }

        const procMatch = line.match(/^proc\s+([@A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*(.*?))?\s+do$/i);
        if (procMatch) {
            const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
            if (bodyBlock.error) return bodyBlock;
            if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
            const argNames = procMatch[2] ? procMatch[2].split(',').map(a => a.trim()).filter(Boolean) : [];
            nodes.push({ type: 'proc', name: procMatch[1], argNames, body: bodyBlock.nodes, lineNum, col });
            i = bodyBlock.nextIdx; continue;
        }

        nodes.push({ type: 'cmd', line, lineNum, col });
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
    let foundComma = false;

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
                foundComma = true;
                continue;
            }
        }
        current += c;
    }
    if (current.trim()) args.push(current.trim());

    if (foundComma) return args;

    // If no commas, we check if it should have had them.
    // If it's a bracketed call like [@func arg1 arg2], tokenize will return more than 1 part (since we stripped func name)
    const tokens = tokenize(raw);
    if (tokens.length > 1) {
        throw new Error(`Syntax Error: Multiple arguments in bracketed call must be separated by commas.`);
    }
    return args;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseScriptLines, parseDirective, extractInterpreterFlags, parseAssignment, parseWhile, parseImport, parseScriptBlock, parseProcedureCallArgs };
}
