/**
 * SMC Parser
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SmcParser = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const normalize = (content) => (typeof SmcUtils !== 'undefined' ? SmcUtils.normalize(content) : String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
    const stripInlineComments = (line) => (typeof SmcUtils !== 'undefined' ? SmcUtils.stripInlineComments(line) : line.trim());

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
        if (!match) {
            if (line.startsWith('![')) return { error: 'Malformed directive syntax.' };
            return null;
        }
        const rawParts = match[1].split('|');
        const parts = [];
        for (const p of rawParts) {
            const trimmed = p.trim();
            if (!trimmed) return { error: 'Empty flag in directive.' };
            parts.push(trimmed.toLowerCase());
        }
        return parts.length ? parts : { error: 'Empty directive.' };
    };

    const extractInterpreterFlags = (lines) => {
        const flags = [];
        const filteredLines = [];
        let doneWithHeader = false;
        for (const lineObj of lines) {
            const d = parseDirective(lineObj.text);
            if (d && d.error) return { error: `${d.error} at Line ${lineObj.num}` };
            
            if (d && !doneWithHeader) {
                flags.push(...d);
            } else {
                if (d) {
                    // Directive found after code - this should stay in the line stream
                    // and be handled as a runtime directive node (or error if that's the rule)
                    // For now, let's keep it as is, but mark that we are past header.
                    filteredLines.push(lineObj);
                } else {
                    doneWithHeader = true;
                    filteredLines.push(lineObj);
                }
            }
        }
        return { flags, lines: filteredLines };
    };

    const parseAssignment = (line) => {
        // Match declaration: var $name = value
        const declMatch = line.match(/^(global|let|set|var)\s+(\$?[A-Za-z_][A-Za-z0-9_]*)\s*(=.*)?$/i);
        if (declMatch) {
            if (!declMatch[2].startsWith('$')) {
                return { error: `Variable declaration '${declMatch[2]}' must start with '$' prefix.` };
            }
            
            const match = line.match(/^(global|let|set|var)\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
            if (match) return { type: match[1].toLowerCase(), name: match[2], value: match[3] };

            const illegalMatch = line.match(/^(global|let|set|var)\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
            if (illegalMatch) return { error: `Strict Initialization: variable '${illegalMatch[2]}' must be initialized.` };
        }

        // Match reassign: $name = value
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
        const terms = terminators.map(t => t.toLowerCase());
        let i = startIdx;

        while (i < linesObj.length) {
            const obj = linesObj[i];
            const line = obj.text;
            const lineNum = obj.num;
            const col = obj.col;
            const lower = line.toLowerCase();
            
            let matchedTerm = null;
            for (const term of terms) {
                if (lower === term || lower.startsWith(term + ' ')) {
                    matchedTerm = term;
                    break;
                }
            }
            if (matchedTerm) return { nodes, nextIdx: i + 1, terminator: matchedTerm };

            const directive = parseDirective(line);
            if (directive) {
                return { error: `Directives (![...]) must be at the very top of the script. Found at Line ${lineNum}` };
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

            const tryMatch = line.match(/^try$/i);
            if (tryMatch) {
                const tryBlock = parseScriptBlock(linesObj, i + 1, ['catch']);
                if (tryBlock.error) return tryBlock;
                if (tryBlock.terminator !== 'catch') return { error: `Missing CATCH for TRY block at Line ${lineNum}` };
                
                // Expect: catch $err do
                const catchLine = linesObj[tryBlock.nextIdx - 1].raw; // The line that terminated the block
                const catchMatch = catchLine.match(/^catch\s+\$([A-Za-z_][A-Za-z0-9_]*)\s+do$/i);
                if (!catchMatch) return { error: `Malformed CATCH statement at Line ${linesObj[tryBlock.nextIdx - 1].num}. Expected: catch $err do` };
                
                const catchBlock = parseScriptBlock(linesObj, tryBlock.nextIdx, ['end']);
                if (catchBlock.error) return catchBlock;
                if (catchBlock.terminator !== 'end') return { error: `Missing END for CATCH block at Line ${lineNum}` };
                
                nodes.push({ 
                    type: 'try_catch_block', 
                    tryBody: tryBlock.nodes, 
                    catchBody: catchBlock.nodes, 
                    errVar: catchMatch[1],
                    lineNum, col 
                });
                i = catchBlock.nextIdx; continue;
            }

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

        // If no commas found, treat the entire string as one argument (could be a complex expression)
        // evaluateExpression will catch if it contains multiple unseparated values.
        return [raw];
    };

    const tokenizeSmc = (s) => {
        const tokens = [];
        let curr = '';
        let depth = 0;
        let inQuotes = false;
        let quoteChar = '';
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if ((c === '"' || c === "'") && (i === 0 || s[i - 1] !== '\\')) {
                if (!inQuotes) { inQuotes = true; quoteChar = c; }
                else if (c === quoteChar) { inQuotes = false; }
            }
            if (!inQuotes) {
                if (c === '[' || c === '(') depth++;
                if (c === ']' || c === ')') depth--;
                if (c === ' ' && depth === 0) {
                    if (curr) tokens.push(curr);
                    curr = ''; continue;
                }
            }
            curr += c;
        }
        if (curr) tokens.push(curr);
        return tokens;
    };

    const tokenizeForHighlighting = (line) => {
        const tokens = [];
        let i = 0;

        const kws = new Set([
            'if', 'then', 'else', 'end', 'proc', 'do', 'var', 'let', 'set', 'while', 'global', 'wait', 'echo', 'type', 'cd', 'dir', 'md', 'mkdir', 'del', 'rm',
            'rd', 'rmdir', 'ren', 'copy', 'ver', 'help', 'cls', 'exit', 'history', 'runsmc', 'notify', 'msgbox', 'input', 'dialog',
            'pwd', 'ls', 'cat', 'cp', 'mv', 'clear',
            'none', 'return', 'break', 'continue', 'for', 'in', 'try', 'catch', 'exists', 'import'
        ]);
        const ops = ['==', '!=', '<=', '>=', '<', '>', '||', '&&', '|', '=', '+', '-', '*', '/', '..', '!', '?', ':', ','];

        while (i < line.length) {
            const ch = line[i];

            if (/\s/.test(ch)) {
                let j = i + 1;
                while (j < line.length && /\s/.test(line[j])) j++;
                tokens.push({ type: 'text', value: line.slice(i, j) });
                i = j;
                continue;
            }

            if (ch === '#') {
                tokens.push({ type: 'comment', value: line.slice(i) });
                break;
            }

            if (ch === '/' && line[i + 1] === '/') {
                tokens.push({ type: 'comment', value: line.slice(i) });
                break;
            }

            if (ch === '"' || ch === "'") {
                const quote = ch;
                let j = i + 1;
                while (j < line.length) {
                    if (line[j] === '\\') { j += 2; continue; }
                    if (line[j] === quote) { j++; break; }
                    j++;
                }
                tokens.push({ type: 'string', value: line.slice(i, j) });
                i = j;
                continue;
            }

            if (ch === '$') {
                let j = i + 1;
                while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
                tokens.push({ type: 'variable', value: line.slice(i, j) });
                i = j;
                continue;
            }

            if (ch === '@') {
                let j = i + 1;
                while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
                tokens.push({ type: 'procedure', value: line.slice(i, j) });
                i = j;
                continue;
            }

            const op = ops.find(o => line.startsWith(o, i));
            if (op) {
                tokens.push({ type: 'operator', value: op });
                i += op.length;
                continue;
            }

            if (/[0-9]/.test(ch)) {
                let j = i + 1;
                while (j < line.length && /[0-9.]/.test(line[j])) j++;
                tokens.push({ type: 'number', value: line.slice(i, j) });
                i = j;
                continue;
            }

            if (/[A-Za-z_]/.test(ch)) {
                let j = i + 1;
                while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
                const word = line.slice(i, j);
                if (kws.has(word.toLowerCase())) {
                    tokens.push({ type: 'keyword', value: word });
                } else {
                    tokens.push({ type: 'text', value: word });
                }
                i = j;
                continue;
            }

            tokens.push({ type: 'operator', value: ch });
            i++;
        }
        return tokens;
    };

    return { parseScriptLines, parseDirective, extractInterpreterFlags, parseAssignment, parseWhile, parseImport, parseScriptBlock, parseProcedureCallArgs, tokenizeSmc, tokenizeForHighlighting };
}));
