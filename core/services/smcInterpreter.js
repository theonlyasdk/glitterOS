const SmcInterpreter = (() => {
    function normalize(content) {
        return String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    function parseScriptLines(content) {
        return normalize(content)
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#') && !l.startsWith('//') && !l.toLowerCase().startsWith('rem '));
    }

    function parseScriptBlock(lines, startIdx = 0, terminators = []) {
        const nodes = [];
        const terms = new Set(terminators.map(t => t.toLowerCase()));
        let i = startIdx;

        while (i < lines.length) {
            const line = lines[i];
            const lower = line.toLowerCase();
            if (terms.has(lower)) return { nodes, nextIdx: i + 1, terminator: lower };

            const ifMatch = line.match(/^if\s+(.+)\s+then$/i);
            if (ifMatch) {
                const thenBlock = parseScriptBlock(lines, i + 1, ['else', 'end']);
                if (thenBlock.error) return thenBlock;
                let elseNodes = [];
                if (thenBlock.terminator === 'else') {
                    const elseBlock = parseScriptBlock(lines, thenBlock.nextIdx, ['end']);
                    if (elseBlock.error) return elseBlock;
                    if (elseBlock.terminator !== 'end') return { error: 'Missing END for IF/ELSE block.' };
                    elseNodes = elseBlock.nodes;
                    i = elseBlock.nextIdx;
                } else if (thenBlock.terminator === 'end') {
                    i = thenBlock.nextIdx;
                } else {
                    return { error: 'Missing END for IF block.' };
                }
                nodes.push({ type: 'if', condition: ifMatch[1].trim(), thenNodes: thenBlock.nodes, elseNodes });
                continue;
            }

            const procMatch = line.match(/^proc\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*?)\s+do$/i);
            if (procMatch) {
                const bodyBlock = parseScriptBlock(lines, i + 1, ['end']);
                if (bodyBlock.error) return bodyBlock;
                if (bodyBlock.terminator !== 'end') return { error: `Missing END for procedure ${procMatch[1]}.` };
                const argNames = procMatch[2]
                    ? procMatch[2].split(',').map(a => a.trim()).filter(Boolean)
                    : [];
                nodes.push({ type: 'proc', name: procMatch[1], argNames, body: bodyBlock.nodes });
                i = bodyBlock.nextIdx;
                continue;
            }

            nodes.push({ type: 'cmd', line });
            i++;
        }

        return { nodes, nextIdx: i, terminator: null };
    }

    function parseProcedureCallArgs(argText, tokenize) {
        const raw = (argText || '').trim();
        if (!raw) return [];
        if (raw.includes(',')) return raw.split(',').map(s => s.trim());
        return tokenize(raw);
    }

    function applyProcedureArgs(line, procDef, values) {
        let out = line;
        procDef.argNames.forEach((argName, idx) => {
            const val = values[idx] ?? '';
            const safeArg = argName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            out = out.replace(new RegExp(`%${safeArg}%`, 'gi'), val);
            out = out.replace(new RegExp(`\\$\\{${safeArg}\\}`, 'gi'), val);
        });
        values.forEach((val, idx) => {
            out = out.replace(new RegExp(`%${idx + 1}%`, 'g'), val);
        });
        return out;
    }

    function runScript(content, hooks = {}) {
        const {
            tokenize = (s) => String(s).trim() ? String(s).trim().split(/\s+/) : [],
            evaluateCondition = () => false,
            executeCommand = () => ({ ok: true }),
            onCommand = null,
            onError = null,
            recursionLimit = 32
        } = hooks;

        const lines = parseScriptLines(content);
        const parsed = parseScriptBlock(lines, 0, []);
        if (parsed.error) {
            if (onError) onError(parsed.error);
            return { ok: false };
        }

        const procedures = new Map();

        function runNodes(nodes, depth = 0) {
            if (depth > recursionLimit) {
                if (onError) onError('Procedure recursion limit exceeded.');
                return { ok: false };
            }
            let last = { ok: true };
            for (const node of nodes) {
                if (node.type === 'proc') {
                    procedures.set(node.name.toLowerCase(), node);
                    continue;
                }

                if (node.type === 'if') {
                    const chosen = evaluateCondition(node.condition) ? node.thenNodes : node.elseNodes;
                    last = runNodes(chosen, depth);
                    if (!last.ok) return last;
                    continue;
                }

                if (node.type === 'cmd') {
                    const tokens = tokenize(node.line);
                    if (!tokens.length) continue;
                    const proc = procedures.get(tokens[0].toLowerCase());
                    if (proc) {
                        const callArgsRaw = node.line.slice(tokens[0].length).trim();
                        const callArgs = parseProcedureCallArgs(callArgsRaw, tokenize);
                        const expanded = proc.body.map(n => {
                            if (n.type !== 'cmd') return n;
                            return { ...n, line: applyProcedureArgs(n.line, proc, callArgs) };
                        });
                        last = runNodes(expanded, depth + 1);
                        if (!last.ok) return last;
                        continue;
                    }
                    if (onCommand) onCommand(node.line);
                    last = executeCommand(node.line);
                    if (!last || typeof last.ok !== 'boolean') last = { ok: true };
                    if (!last.ok) return last;
                }
            }
            return last;
        }

        return runNodes(parsed.nodes, 0);
    }

    return {
        parseScriptLines,
        parseScriptBlock,
        runScript
    };
})();

window.SmcInterpreter = SmcInterpreter;
