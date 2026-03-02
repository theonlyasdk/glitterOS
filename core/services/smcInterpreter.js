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

    const INTERPRETER_ONLY_FLAGS = new Set(['ignore_errors', 'no_echo', 'silent']);

    function parseDirective(line) {
        const match = line.match(/^\!\[\s*([^\]]+)\s*\]$/i);
        if (!match) return null;
        const parts = match[1]
            .split('|')
            .map(p => p.trim().toLowerCase())
            .filter(Boolean);
        return parts.length ? parts : null;
    }

    function extractInterpreterFlags(lines) {
        const interpreterFlags = [];
        const mask = new Array(lines.length).fill(false);
        let seenNonInterpreterLine = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
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
                return { error: 'Interpreter directives must appear before any other statements.' };
            }
            interpreterFlags.push(...directive);
            mask[i] = true;
        }
        const filtered = lines.filter((_, idx) => !mask[idx]);
        return { lines: filtered, flags: interpreterFlags };
    }

    function parseAssignment(line) {
            const match = line.match(/^(?:let|set|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
        return match ? { name: match[1], value: match[2] } : null;
    }

    function parseWhile(line) {
        const match = line.match(/^while\s+(.+)\s+do$/i);
        return match ? match[1] : null;
    }

    function parseImport(line) {
        const match = line.match(/^import\s+(.+\.smc)$/i);
        return match ? match[1] : null;
    }

    function parseScriptBlock(lines, startIdx = 0, terminators = []) {
        const nodes = [];
        const terms = new Set(terminators.map(t => t.toLowerCase()));
        let i = startIdx;

        while (i < lines.length) {
            const line = lines[i];
            const lower = line.toLowerCase();
            if (terms.has(lower)) return { nodes, nextIdx: i + 1, terminator: lower };

            const directive = parseDirective(line);
            if (directive) {
                directive.forEach(flag => nodes.push({ type: 'directive', name: flag }));
                i++;
                continue;
            }

            const assign = parseAssignment(line);
            if (assign) {
                nodes.push({ type: 'assign', name: assign.name, value: assign.value });
                i++;
                continue;
            }

            const whileExpr = parseWhile(line);
            if (whileExpr) {
                const bodyBlock = parseScriptBlock(lines, i + 1, ['end']);
                if (bodyBlock.error) return bodyBlock;
                if (bodyBlock.terminator !== 'end') return { error: 'Missing END for WHILE block.' };
                nodes.push({ type: 'while', condition: whileExpr, body: bodyBlock.nodes });
                i = bodyBlock.nextIdx;
                continue;
            }

            const importPath = parseImport(line);
            if (importPath) {
                nodes.push({ type: 'import', path: importPath });
                i++;
                continue;
            }

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

    function runScript(content, hooks = {}, state = null) {
        const {
            tokenize = (s) => String(s).trim() ? String(s).trim().split(/\s+/) : [],
            evaluateCondition = () => false,
            executeCommand = () => ({ ok: true }),
            onCommand = null,
            onError = null,
            recursionLimit = 32,
            cwd = fs.pwd()
        } = hooks;

        const ctx = state || {
            variables: {},
            importStack: [],
            ignoreNextCommand: false,
            cwd
        };

        const evaluateExpression = (expr) => {
            const sanitized = String(expr).replace(/[^0-9+\-/*(). ]/g, '').trim();
            if (!sanitized) return String(expr).trim();
            try {
                // eslint-disable-next-line no-new-func
                const result = new Function(`"use strict";return(${sanitized})`)();
                return String(result);
            } catch {
                return String(expr).trim();
            }
        };

        const lines = parseScriptLines(content);
        const extracted = extractInterpreterFlags(lines);
        if (extracted.error) {
            if (onError) onError(extracted.error);
            return { ok: false };
        }
        const parsed = parseScriptBlock(extracted.lines, 0, []);
        if (parsed.error) {
            if (onError) onError(parsed.error);
            return { ok: false };
        }

        const procedures = new Map();

        ctx.flags = ctx.flags || {};
        const flagSet = new Set((extracted.flags || []).map(f => f.toLowerCase()));
        ctx.flags.ignoreErrors = flagSet.has('ignore_errors');
        ctx.flags.noEcho = flagSet.has('no_echo');
        ctx.flags.silent = flagSet.has('silent');
        if (hooks.onFlags) hooks.onFlags(ctx.flags);

        const expandVariables = (str) => {
            let out = String(str);
            ctx.variables && Object.keys(ctx.variables).forEach((key) => {
                const val = ctx.variables[key] ?? '';
                out = out.replace(new RegExp(`%${key}%`, 'g'), val);
                out = out.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), val);
                out = out.replace(new RegExp(`%\\{${key}\\}`, 'g'), val);
            });
            return out;
        };

        const resolveImportPath = (rawPath) => {
            if (!rawPath) return null;
            const cleaned = rawPath.replace(/\//g, '\\');
            if (/^[A-Za-z]:\\/.test(cleaned) || cleaned.startsWith('\\')) return cleaned;
            const base = ctx.cwd || 'C:\\';
            return base.endsWith('\\') ? base + cleaned : `${base}\\${cleaned}`;
        };

        function handleCommandExecution(line) {
            const expanded = expandVariables(line);
            if (onCommand) onCommand(expanded);
            const result = executeCommand(expanded) || { ok: true };
            if (!result.ok) {
                if (ctx.ignoreNextCommand) {
                    ctx.ignoreNextCommand = false;
                    return { ok: true };
                }
                if (ctx.flags.ignoreErrors) {
                    ctx.ignoreNextCommand = false;
                    return { ok: true };
                }
                return result;
            }
            ctx.ignoreNextCommand = false;
            return result;
        }

        function runNodes(nodes, depth = 0) {
            if (depth > recursionLimit) {
                if (onError) onError('Procedure recursion limit exceeded.');
                return { ok: false };
            }
            for (const node of nodes) {
                if (node.type === 'directive') {
                    if (node.name === 'ignore_subcmd_errors') {
                        ctx.ignoreNextCommand = true;
                    }
                    continue;
                }
                if (node.type === 'assign') {
                    ctx.variables = ctx.variables || {};
                    const value = expandVariables(node.value);
                    ctx.variables[node.name] = evaluateExpression(value);
                    continue;
                }
                if (node.type === 'while') {
                    while (true) {
                        const condition = expandVariables(node.condition);
                        const condOk = evaluateCondition(condition);
                        if (!condOk) break;
                        const res = runNodes(node.body, depth);
                        if (!res.ok) return res;
                        if (ctx.ignoreNextCommand) ctx.ignoreNextCommand = false;
                    }
                    continue;
                }
                if (node.type === 'import') {
                    const importPath = expandVariables(node.path);
                    const resolved = resolveImportPath(importPath);
                    if (!resolved || !fs.exists(resolved)) {
                        if (onError) onError(`Import failed: ${importPath} not found.`);
                        return { ok: false };
                    }
                    if (ctx.importStack.includes(resolved)) continue;
                    ctx.importStack.push(resolved);
                    const fileRes = fs.cat(resolved);
                    if (fileRes.error) {
                        if (onError) onError(`Import failed: ${fileRes.error}`);
                        ctx.importStack.pop();
                        return { ok: false };
                    }
                    const previousCwd = ctx.cwd;
                    ctx.cwd = resolved.includes('\\') ? resolved.substring(0, resolved.lastIndexOf('\\')) || 'C:\\' : 'C:\\';
                    const res = runScript(fileRes.content, hooks, ctx);
                    ctx.cwd = previousCwd;
                    ctx.importStack.pop();
                    if (!res.ok) return res;
                    continue;
                }
                if (node.type === 'if') {
                    const condition = expandVariables(node.condition);
                    const chosen = evaluateCondition(condition) ? node.thenNodes : node.elseNodes;
                    const res = runNodes(chosen, depth);
                    if (!res.ok) return res;
                    continue;
                }
                if (node.type === 'proc') {
                    procedures.set(node.name.toLowerCase(), node);
                    continue;
                }
                if (node.type === 'cmd') {
                    const expandedLine = expandVariables(node.line);
                    const tokens = tokenize(expandedLine);
                    if (!tokens.length) continue;
                    const proc = procedures.get(tokens[0].toLowerCase());
                    if (proc) {
                        const callArgsRaw = expandedLine.slice(tokens[0].length).trim();
                        const callArgs = parseProcedureCallArgs(callArgsRaw, tokenize);
                        const expanded = proc.body.map(n => {
                            if (n.type !== 'cmd') return n;
                            return { ...n, line: applyProcedureArgs(n.line, proc, callArgs) };
                        });
                        const res = runNodes(expanded, depth + 1);
                        if (!res.ok) return res;
                        continue;
                    }
                    const res = handleCommandExecution(expandedLine);
                    if (!res.ok) return res;
                }
            }
            return { ok: true };
        }

        const runResult = runNodes(parsed.nodes, 0);
        runResult.flags = ctx.flags;
        return runResult;
    }

    return {
        parseScriptLines,
        parseScriptBlock,
        runScript
    };
})();

window.SmcInterpreter = SmcInterpreter;
