const SmcInterpreter = (() => {
    function normalize(content) {
        return String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    function stripInlineComments(line) {
        let inQuotes = false;
        let qChar = null;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"' || line[i] === "'") {
                if (!inQuotes) { inQuotes = true; qChar = line[i]; }
                else if (qChar === line[i]) inQuotes = false;
            }
            if (line[i] === '#' && !inQuotes) {
                return line.substring(0, i).trim();
            }
        }
        return line.trim();
    }

    function parseScriptLines(content) {
        return normalize(content)
            .split('\n')
            .map((l, i) => ({ text: l.trim(), num: i + 1 }))
            .map(obj => ({ text: stripInlineComments(obj.text), num: obj.num }))
            .filter(obj => obj.text && !obj.text.startsWith('//') && !obj.text.toLowerCase().startsWith('rem '));
    }

    const INTERPRETER_ONLY_FLAGS = new Set(['ignore_errors', 'no_echo', 'silent', 'allow_casting', 'echo_var_values']);

    function parseDirective(line) {
        const match = line.match(/^\!\[\s*([^\]]+)\s*\]$/i);
        if (!match) return null;
        const parts = match[1]
            .split('|')
            .map(p => p.trim().toLowerCase())
            .filter(Boolean);
        return parts.length ? parts : null;
    }

    function extractInterpreterFlags(linesObj) {
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
    }

    function parseAssignment(line) {
        // Enforce $ prefix for declarations
        const declMatch = line.match(/^(global|let|set|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
        if (declMatch) return { error: `Variable declaration '${declMatch[2]}' must start with '$' prefix.` };

        const match = line.match(/^(global|let|set|var)\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
        if (match) return { type: match[1].toLowerCase(), name: match[2], value: match[3] };
        
        const reassignMatch = line.match(/^\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
        if (reassignMatch) return { type: 'reassign', name: reassignMatch[1], value: reassignMatch[2] };
        return null;
    }

    function parseWhile(line) {
        const match = line.match(/^while\s+(.+)\s+do$/i);
        return match ? match[1] : null;
    }

    function parseImport(line) {
        const match = line.match(/^import\s+(.+\.smc)$/i);
        return match ? match[1] : null;
    }

    function parseScriptBlock(linesObj, startIdx = 0, terminators = []) {
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
                i++;
                continue;
            }

            const assign = parseAssignment(line);
            if (assign) {
                if (assign.error) return { error: `${assign.error} at Line ${lineNum}` };
                nodes.push({ type: 'assign', assignType: assign.type, name: assign.name, value: assign.value, lineNum });
                i++;
                continue;
            }

            // Detect stand-alone variable reference
            const varEchoMatch = line.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
            if (varEchoMatch) {
                nodes.push({ type: 'var_echo', name: varEchoMatch[1], lineNum });
                i++;
                continue;
            }

            const whileExpr = parseWhile(line);
            if (whileExpr) {
                const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
                if (bodyBlock.error) return bodyBlock;
                if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
                nodes.push({ type: 'while', condition: whileExpr, body: bodyBlock.nodes, lineNum });
                i = bodyBlock.nextIdx;
                continue;
            }

            const importPath = parseImport(line);
            if (importPath) {
                nodes.push({ type: 'import', path: importPath, lineNum });
                i++;
                continue;
            }

            const ifMatch = line.match(/^if\s+(.+)\s+then$/i);
            if (ifMatch) {
                const thenBlock = parseScriptBlock(linesObj, i + 1, ['else', 'end']);
                if (thenBlock.error) return thenBlock;
                let elseNodes = [];
                if (thenBlock.terminator === 'else') {
                    const elseBlock = parseScriptBlock(linesObj, thenBlock.nextIdx, ['end']);
                    if (elseBlock.error) return elseBlock;
                    if (elseBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
                    elseNodes = elseBlock.nodes;
                    i = elseBlock.nextIdx;
                } else if (thenBlock.terminator === 'end') {
                    i = thenBlock.nextIdx;
                } else {
                    return { error: `Missing END for block at Line ${lineNum}` };
                }
                nodes.push({ type: 'if', condition: ifMatch[1].trim(), thenNodes: thenBlock.nodes, elseNodes, lineNum });
                continue;
            }

            const procMatch = line.match(/^proc\s+([@A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*?)\s+do$/i);
            if (procMatch) {
                const bodyBlock = parseScriptBlock(linesObj, i + 1, ['end']);
                if (bodyBlock.error) return bodyBlock;
                if (bodyBlock.terminator !== 'end') return { error: `Missing END for block at Line ${lineNum}` };
                const argNames = procMatch[2]
                    ? procMatch[2].split(',').map(a => a.trim()).filter(Boolean)
                    : [];
                nodes.push({ type: 'proc', name: procMatch[1], argNames, body: bodyBlock.nodes, lineNum });
                i = bodyBlock.nextIdx;
                continue;
            }

            nodes.push({ type: 'cmd', line, lineNum });
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
            const baseArg = argName.startsWith('$') ? argName.substring(1) : argName;
            const safeArg = baseArg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            out = out.replace(new RegExp(`%${safeArg}%`, 'gi'), val);
            out = out.replace(new RegExp(`\\$\\{${safeArg}\\}`, 'gi'), val);
            out = out.replace(new RegExp(`%\\{${safeArg}\\}`, 'gi'), val);
            out = out.replace(new RegExp(`\\$${safeArg}(?![A-Za-z0-9_])`, 'gi'), val);
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
            onWarning = null,
            recursionLimit = 32,
            cwd = fs.pwd(),
            filename = 'script.smc'
        } = hooks;

        const ctx = state || {
            globalScope: {},
            importStack: [],
            callStack: [],
            ignoreNextCommand: false,
            cwd
        };

        const formatError = (msg, lineNum) => {
            const loc = lineNum ? ` at line ${lineNum}` : '';
            let out = `Error: ${filename}${loc}: ${msg}`;
            if (ctx.callStack && ctx.callStack.length > 0) {
                out += '\nCall Stack:';
                for (let i = ctx.callStack.length - 1; i >= 0; i--) {
                    const frame = ctx.callStack[i];
                    const args = frame.args.map(a => typeof a === 'string' ? `"${a}"` : a).join(', ');
                    const fName = frame.name.startsWith('@') ? frame.name : '@' + frame.name;
                    out += `\n  at ${fName} : ${args} (${frame.filename} at line ${frame.lineNum})`;
                }
            }
            return out;
        };

        const formatWarning = (msg, lineNum) => {
            const loc = lineNum ? ` at line ${lineNum}` : '';
            let out = `Warning: ${filename}${loc}: ${msg}`;
            if (ctx.callStack && ctx.callStack.length > 0) {
                out += '\nCall Stack:';
                for (let i = ctx.callStack.length - 1; i >= 0; i--) {
                    const frame = ctx.callStack[i];
                    const args = frame.args.map(a => typeof a === 'string' ? `"${a}"` : a).join(', ');
                    const fName = frame.name.startsWith('@') ? frame.name : '@' + frame.name;
                    out += `\n  at ${fName} : ${args} (${frame.filename} at line ${frame.lineNum})`;
                }
            }
            return out;
        };

        const findInScopes = (name, scope) => {
            let curr = scope;
            while (curr) {
                if (curr.variables && curr.variables[name] !== undefined) return { scope: curr, value: curr.variables[name] };
                curr = curr.parent;
            }
            if (ctx.globalScope && ctx.globalScope[name] !== undefined) return { scope: 'global', value: ctx.globalScope[name] };
            return null;
        };

        const getAllVariables = (scope) => {
            let vars = { ...ctx.globalScope };
            let chain = [];
            let curr = scope;
            while (curr) {
                chain.push(curr.variables || {});
                curr = curr.parent;
            }
            for (let i = chain.length - 1; i >= 0; i--) {
                vars = { ...vars, ...chain[i] };
            }
            return vars;
        };

        const evaluateExpression = (exprRaw, scope, lineNum) => {
            let expr = String(exprRaw);
            let tokens = [];
            let i = 0;
            const vars = getAllVariables(scope);
            while (i < expr.length) {
                let c = expr[i];
                if (c === '"' || c === "'") {
                    let q = c;
                    let j = i + 1;
                    let str = '';
                    while (j < expr.length) {
                        if (expr[j] === '\\') { str += expr[j+1] || ''; j += 2; }
                        else if (expr[j] === q) { j++; break; }
                        else { str += expr[j]; j++; }
                    }
                    str = str.replace(/%\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => vars[k] !== undefined ? String(vars[k]) : m);
                    tokens.push({ type: 'val', value: str });
                    i = j;
                } else if (c === '$') {
                    let j = i + 1;
                    let vName = '';
                    while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) {
                        vName += expr[j]; j++;
                    }
                    tokens.push({ type: 'val', value: vars[vName] !== undefined ? vars[vName] : '' });
                    i = j;
                } else if (['+', '-', '*', '/'].includes(c)) {
                    tokens.push({ type: 'op', value: c });
                    i++;
                } else if (/[0-9]/.test(c)) {
                    let j = i;
                    while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
                    tokens.push({ type: 'val', value: parseFloat(expr.slice(i, j)) });
                    i = j;
                } else if (/\s/.test(c)) {
                    i++;
                } else {
                    let j = i;
                    while (j < expr.length && !/\s|['"+\-*/]/.test(expr[j])) j++;
                    let w = expr.slice(i, j);
                    tokens.push({ type: 'val', value: w });
                    i = j;
                }
            }

            if (tokens.length === 0) return '';
            let res = tokens[0].value;
            for (let k = 1; k < tokens.length; k += 2) {
                if (k + 1 >= tokens.length) break;
                let op = tokens[k].value;
                let next = tokens[k+1].value;
                
                if (typeof res === 'number') {
                    if (typeof next === 'number') {
                        if (op === '+') res += next;
                        else if (op === '-') res -= next;
                        else if (op === '*') res *= next;
                        else if (op === '/') res /= next;
                    } else {
                        if (op === '+') res = String(res) + String(next);
                        else throw new Error("Type error: cannot " + op + " number and string");
                    }
                } else {
                    if (typeof next === 'number') {
                        if (op === '*') {
                            if (next < 0) next = 0;
                            res = String(res).repeat(next);
                        }
                        else if (op === '+') res = String(res) + String(next);
                        else throw new Error("Type error: cannot " + op + " string and number");
                    } else {
                        if (op === '+') res = String(res) + String(next);
                        else if (op === '/') {
                            let sRes = String(res);
                            let sNext = String(next);
                            res = sRes.endsWith('\\') || sRes.endsWith('/') ? sRes + (sNext.startsWith('\\')||sNext.startsWith('/') ? sNext.slice(1) : sNext) : sRes + '\\' + (sNext.startsWith('\\')||sNext.startsWith('/') ? sNext.slice(1) : sNext);
                            res = res.replace(/\//g, '\\');
                        } else throw new Error("Type error: cannot " + op + " string and string");
                    }
                }
            }
            return res;
        };

        const lines = parseScriptLines(content);
        const extracted = extractInterpreterFlags(lines);
        if (extracted.error) {
            if (onError) onError(formatError(extracted.error));
            return { ok: false };
        }
        const parsed = parseScriptBlock(extracted.lines, 0, []);
        if (parsed.error) {
            if (onError) onError(formatError(parsed.error));
            return { ok: false };
        }

        const procedures = new Map();

        ctx.flags = ctx.flags || {};
        const flagSet = new Set((extracted.flags || []).map(f => f.toLowerCase()));
        ctx.flags.ignoreErrors = flagSet.has('ignore_errors');
        ctx.flags.noEcho = flagSet.has('no_echo');
        ctx.flags.silent = flagSet.has('silent');
        ctx.flags.allowCasting = flagSet.has('allow_casting');
        ctx.flags.echoVarValues = flagSet.has('echo_var_values');
        if (hooks.onFlags) hooks.onFlags(ctx.flags);

        const expandVariables = (str, scope) => {
            let out = String(str);
            const vars = getAllVariables(scope);
            const sortedKeys = Object.keys(vars).sort((a,b)=>b.length-a.length);
            sortedKeys.forEach((key) => {
                const val = vars[key] ?? '';
                const baseKey = key.startsWith('$') ? key.substring(1) : key;
                out = out.replace(new RegExp(`%${baseKey}%`, 'g'), val);
                out = out.replace(new RegExp(`\\$\\{${baseKey}\\}`, 'g'), val);
                out = out.replace(new RegExp(`%\\{${baseKey}\\}`, 'g'), val);
                out = out.replace(new RegExp(`\\$${baseKey}(?![A-Za-z0-9_])`, 'g'), val);
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

        function handleCommandExecution(line, lineNum, scope) {
            const expanded = expandVariables(line, scope);
            if (onCommand) onCommand(expanded);
            const result = executeCommand(expanded) || { ok: true };
            if (!result.ok) {
                if (result.haltScript) {
                    return result; // explicitly return and don't suppress
                }
                if (ctx.ignoreNextCommand) {
                    ctx.ignoreNextCommand = false;
                    return { ok: true };
                }
                if (ctx.flags.ignoreErrors) {
                    ctx.ignoreNextCommand = false;
                    return { ok: true };
                }
                
                if (onError && !result.suppressMsg) {
                    onError(formatError(result.error || 'Command failed', lineNum));
                }
                return result;
            }
            ctx.ignoreNextCommand = false;
            return { ok: true };
        }

        function runNodes(nodes, scope = { variables: {}, parent: null }, depth = 0) {
            if (depth > recursionLimit) {
                if (onError) onError(formatError('Procedure recursion limit exceeded.'));
                return { ok: false };
            }
            for (const node of nodes) {
                if (node.type === 'directive') {
                    if (node.name === 'ignore_subcmd_errors') {
                        ctx.ignoreNextCommand = true;
                    }
                    continue;
                }
                if (node.type === 'var_echo') {
                    const existing = findInScopes(node.name, scope);
                    if (existing) {
                        if (ctx.flags.echoVarValues) {
                            if (onCommand) onCommand(String(existing.value));
                        } else {
                            if (onWarning) onWarning(formatWarning(`unused value of variable: $${node.name}`, node.lineNum));
                        }
                    } else {
                        if (onError) onError(formatError(`Variable $${node.name} is not defined.`, node.lineNum));
                        return { ok: false };
                    }
                    continue;
                }
                if (node.type === 'assign') {
                    let newVal;
                    try {
                        newVal = evaluateExpression(node.value, scope, node.lineNum);
                    } catch (e) {
                        if (onError) onError(formatError(`Assignment error for ${node.name}: ${e.message}`, node.lineNum));
                        return { ok: false };
                    }

                    if (node.assignType === 'global') {
                        ctx.globalScope[node.name] = newVal;
                    } else if (node.assignType === 'reassign') {
                        const existing = findInScopes(node.name, scope);
                        if (existing) {
                            if (!ctx.flags.allowCasting && typeof existing.value !== typeof newVal) {
                                if (onError) onError(formatError(`Type mismatch: cannot assign ${typeof newVal} to ${typeof existing.value} variable ${node.name}. Use ![allow_casting]`, node.lineNum));
                                return { ok: false };
                            }
                            if (existing.scope === 'global') ctx.globalScope[node.name] = newVal;
                            else existing.scope.variables[node.name] = newVal;
                        } else {
                            // Default to local if not found
                            scope.variables[node.name] = newVal;
                        }
                    } else {
                        // var, let, set
                        if (scope.variables[node.name] !== undefined) {
                            if (onError) onError(formatError(`Variable ${node.name} is already declared in this scope.`, node.lineNum));
                            return { ok: false };
                        }
                        scope.variables[node.name] = newVal;
                    }
                    continue;
                }
                if (node.type === 'while') {
                    while (true) {
                        const condition = expandVariables(node.condition, scope);
                        const condOk = evaluateCondition(condition);
                        if (!condOk) break;
                        const res = runNodes(node.body, { variables: {}, parent: scope }, depth);
                        if (!res.ok) return res;
                        if (ctx.ignoreNextCommand) ctx.ignoreNextCommand = false;
                    }
                    continue;
                }
                if (node.type === 'import') {
                    const importPath = expandVariables(node.path, scope);
                    const resolved = resolveImportPath(importPath);
                    if (!resolved || !fs.exists(resolved)) {
                        if (onError) onError(formatError(`Import failed: ${importPath} not found.`, node.lineNum));
                        return { ok: false };
                    }
                    if (ctx.importStack.includes(resolved)) continue;
                    ctx.importStack.push(resolved);
                    const fileRes = fs.cat(resolved);
                    if (fileRes.error) {
                        if (onError) onError(formatError(`Import failed: ${fileRes.error}`, node.lineNum));
                        ctx.importStack.pop();
                        return { ok: false };
                    }
                    const previousCwd = ctx.cwd;
                    ctx.cwd = resolved.includes('\\') ? resolved.substring(0, resolved.lastIndexOf('\\')) || 'C:\\' : 'C:\\';
                    // Imports share the same global scope but start with a fresh local scope
                    const res = runScript(fileRes.content, { ...hooks, filename: importPath }, ctx);
                    ctx.cwd = previousCwd;
                    ctx.importStack.pop();
                    if (!res.ok) return res;
                    continue;
                }
                if (node.type === 'if') {
                    const condition = expandVariables(node.condition, scope);
                    const chosen = evaluateCondition(condition) ? node.thenNodes : node.elseNodes;
                    const res = runNodes(chosen, { variables: {}, parent: scope }, depth);
                    if (!res.ok) return res;
                    continue;
                }
                if (node.type === 'proc') {
                    procedures.set(node.name.toLowerCase(), node);
                    continue;
                }
                if (node.type === 'cmd') {
                    const expandedLine = expandVariables(node.line, scope);
                    const tokens = tokenize(expandedLine);
                    if (!tokens.length) continue;
                    const proc = procedures.get(tokens[0].toLowerCase());
                    if (proc) {
                        const callArgsRaw = expandedLine.slice(tokens[0].length).trim();
                        const callArgs = parseProcedureCallArgs(callArgsRaw, tokenize);
                        // Procedures get their own scope, with arguments mapped to variables
                        const procScope = { variables: {}, parent: scope };
                        proc.argNames.forEach((argName, idx) => {
                            const val = callArgs[idx] ?? '';
                            const name = argName.startsWith('$') ? argName.substring(1) : argName;
                            procScope.variables[name] = val;
                        });

                        ctx.callStack.push({
                            name: proc.name,
                            args: callArgs,
                            filename: filename,
                            lineNum: node.lineNum
                        });

                        const res = runNodes(proc.body, procScope, depth + 1);
                        
                        ctx.callStack.pop();

                        if (!res.ok) return res;
                        continue;
                    }
                    const res = handleCommandExecution(expandedLine, node.lineNum, scope);
                    if (!res.ok) return res;
                }
            }
            return { ok: true };
        }

        const runResult = runNodes(parsed.nodes, { variables: {}, parent: null }, 0);
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
