/**
 * SMC Interpreter Core
 */

const findInScopes = (name, scope, ctx) => {
    const searchName = name.startsWith('$') ? name : '$' + name;
    let curr = scope;
    while (curr) {
        if (curr.variables && curr.variables[searchName] !== undefined) return { scope: curr, value: curr.variables[searchName] };
        curr = curr.parent;
    }
    if (ctx.globalScope && ctx.globalScope[searchName] !== undefined) return { scope: 'global', value: ctx.globalScope[searchName] };
    return null;
};

const getAllVariables = (scope, ctx) => {
    let vars = {};
    const fixKey = (k) => k.startsWith('$') ? k : '$' + k;
    Object.keys(ctx.globalScope).forEach(k => vars[fixKey(k)] = ctx.globalScope[k]);
    let chain = [];
    let curr = scope;
    while (curr) { chain.push(curr.variables || {}); curr = curr.parent; }
    for (let i = chain.length - 1; i >= 0; i--) {
        Object.keys(chain[i]).forEach(k => vars[fixKey(k)] = chain[i][k]);
    }
    return vars;
};

const evaluateExpression = async (exprRaw, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename) => {
    const { tokenize } = hooks;
    let expr = expandVariables(String(exprRaw).trim(), scope, ctx, getAllVariables);
    
    if (expr.startsWith('try?')) {
        const res = await evaluateExpression(expr.slice(4).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
        if (res && typeof res === 'object') {
            if (res.__tag === 'error') throw { type: 'bubble_error', value: res };
            if (res.__tag === 'ok') return res.value;
        }
        return res;
    }
    if (expr.startsWith('!')) {
        const val = await evaluateExpression(expr.slice(1).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
        return !val;
    }

    let tokens = [];
    let i = 0;
    while (i < expr.length) {
        let c = expr[i];
        if (c === '"' || c === "'") {
            let q = c, j = i + 1, str = '';
            while (j < expr.length) {
                if (expr[j] === '\\') { str += expr[j + 1] || ''; j += 2; }
                else if (expr[j] === q) { j++; break; }
                else { str += expr[j]; j++; }
            }
            str = str.replace(/%\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => {
                const vars = getAllVariables(scope, ctx);
                return vars[k] !== undefined ? String(vars[k]) : m;
            });
            tokens.push({ type: 'val', value: str });
            i = j;
        } else if (c === '[') {
            let count = 1, j = i + 1;
            while (j < expr.length && count > 0) {
                if (expr[j] === '[') count++;
                else if (expr[j] === ']') count--;
                j++;
            }
            const inner = expr.slice(i + 1, j - 1).trim();
            if (inner.startsWith('@') || inner.match(/^[A-Za-z_]/)) {
                const result = await callFunctionOrProcedure(inner, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                tokens.push({ type: 'val', value: result });
            } else if (inner.startsWith(':ok')) {
                const val = await evaluateExpression(inner.slice(3).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                tokens.push({ type: 'val', value: { __tag: 'ok', value: val } });
            } else if (inner.startsWith(':error')) {
                const val = await evaluateExpression(inner.slice(6).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                tokens.push({ type: 'val', value: { __tag: 'error', value: val } });
            }
            i = j;
        } else if (c === '$') {
            let j = i + 1, vName = '';
            while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) { vName += expr[j]; j++; }
            const currentVars = getAllVariables(scope, ctx);
            tokens.push({ type: 'val', value: currentVars[vName] !== undefined ? currentVars[vName] : null });
            i = j;
        } else if (['==', '!=', '<=', '>=', '<', '>', '..', '+', '-', '*', '/'].some(op => expr.startsWith(op, i))) {
            const op = ['==', '!=', '<=', '>=', '<', '>', '..', '+', '-', '*', '/'].find(o => expr.startsWith(o, i));
            tokens.push({ type: 'op', value: op });
            i += op.length;
        } else if (/[0-9]/.test(c)) {
            let j = i;
            while (j < expr.length && (/[0-9]/.test(expr[j]) || (expr[j] === '.' && expr[j + 1] !== '.'))) j++;
            tokens.push({ type: 'val', value: parseFloat(expr.slice(i, j)) });
            i = j;
        } else if (/\s/.test(c)) {
            i++;
        } else {
            let j = i;
            while (j < expr.length && !/\s|['"+\-*/\[\]]/.test(expr[j])) j++;
            let w = expr.slice(i, j);
            if (w.toLowerCase() === 'none') tokens.push({ type: 'val', value: null });
            else if (w.toLowerCase() === 'true') tokens.push({ type: 'val', value: true });
            else if (w.toLowerCase() === 'false') tokens.push({ type: 'val', value: false });
            else if (w === '[:ok') tokens.push({ type: 'val', value: '[:ok' });
            else if (w === '[:error') tokens.push({ type: 'val', value: '[:error' });
            else tokens.push({ type: 'val', value: w });
            i = j;
        }
    }

    if (tokens.length === 0) return null;
    if (tokens[0].value === '[:ok' && tokens.length >= 2) return { __tag: 'ok', value: tokens[1].value };
    if (tokens[0].value === '[:error' && tokens.length >= 2) return { __tag: 'error', value: tokens[1].value };

    let res = tokens[0].value;
    for (let k = 1; k < tokens.length; k += 2) {
        if (k + 1 >= tokens.length) break;
        let op = tokens[k].value;
        let next = tokens[k + 1].value;

        if (op === '==') {
            if (res && typeof res === 'object' && res.__tag === 'range' && next && typeof next === 'object' && next.__tag === 'range') {
                res = (res.start === next.start && res.end === next.end);
            } else res = (res === next);
        }
        else if (op === '!=') {
            if (res && typeof res === 'object' && res.__tag === 'range' && next && typeof next === 'object' && next.__tag === 'range') {
                res = (res.start !== next.start || res.end !== next.end);
            } else res = (res !== next);
        }
        else if (op === '<') res = (res < next);
        else if (op === '>') res = (res > next);
        else if (op === '<=') res = (res <= next);
        else if (op === '>=') res = (res >= next);
        else if (op === '..') res = { __tag: 'range', start: Number(res), end: Number(next) };
        else if (typeof res === 'number' && typeof next === 'number') {
            if (op === '+') res += next;
            else if (op === '-') res -= next;
            else if (op === '*') res *= next;
            else if (op === '/') res /= next;
        } else if (op === '+') {
            if (res && res.__tag === 'range') throw new Error("Cannot add a range to another value.");
            if (next && next.__tag === 'range') throw new Error("Cannot add a value to a range.");
            res = String(res ?? '') + String(next ?? '');
        } else if (op === '/') {
            let sRes = String(res ?? ''), sNext = String(next ?? '');
            res = sRes.endsWith('\\') || sRes.endsWith('/') ? sRes + (sNext.startsWith('\\') || sNext.startsWith('/') ? sNext.slice(1) : sNext) : sRes + '\\' + (sNext.startsWith('\\') || sNext.startsWith('/') ? sNext.slice(1) : sNext);
            res = res.replace(/\//g, '\\');
        }
    }
    return res;
};

const callFunctionOrProcedure = async (inner, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename) => {
    const { tokenize } = hooks;
    const tokens = tokenize(inner);
    if (!tokens.length) return null;
    const name = tokens[0].toLowerCase();
    const argText = inner.slice(tokens[0].length).trim();
    const rawArgs = parseProcedureCallArgs(argText, tokenize);
    const callArgs = [];
    for (const arg of rawArgs) {
        callArgs.push(await evaluateExpression(arg, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename));
    }

    const proc = procedures.get(name);
    if (proc) {
        const procScope = { variables: {}, parent: scope };
        proc.argNames.forEach((arg, idx) => procScope.variables[arg.startsWith('$') ? arg.slice(1) : arg] = callArgs[idx] ?? null);
        ctx.callStack.push({ name: proc.name, args: callArgs, filename, lineNum: lineNum });
        const res = await runNodes(proc.body, procScope, depth + 1, ctx, selfInstance, hooks, procedures, filename);
        ctx.callStack.pop();
        if (res.signal === SIGNAL_RETURN) return res.value;
        return null;
    }
    const builtinName = name.startsWith('@') ? name.slice(1) : name;
    if (ctx.builtins[builtinName]) {
        return await ctx.builtins[builtinName](callArgs, { scope, lineNum, depth, type: 'expression', filename, interpreter: selfInstance });
    }
    throw new Error(`Function or procedure ${name} not found.`);
};

const evaluateConditionAsync = async (conditionExpr, scope, depth, ctx, selfInstance, hooks, procedures, filename) => {
    const trimmed = conditionExpr.trim();
    const lower = trimmed.toLowerCase();
    if (trimmed.startsWith('!') || trimmed.startsWith('[') || trimmed.startsWith('$') ||
        lower === 'none' || lower === 'true' || lower === 'false' ||
        trimmed.includes('==') || trimmed.includes('!=') || trimmed.includes('<') || trimmed.includes('>')) {
        return !!(await evaluateExpression(conditionExpr, scope, 0, depth, ctx, selfInstance, hooks, procedures, filename));
    }
    return hooks.evaluateCondition(expandVariables(conditionExpr, scope, ctx, getAllVariables));
};

const handleCommandExecution = async (line, lineNum, scope, ctx, selfInstance, hooks, procedures, filename, skipExpansion = false) => {
    const { onCommand, onError, executeCommand, tokenize } = hooks;
    const expanded = skipExpansion ? line : expandVariables(line, scope, ctx, getAllVariables);
    if (onCommand && !ctx.flags.silent && !ctx.flags.noEcho) onCommand(expanded);

    const tokens = tokenize(expanded);
    if (tokens.length > 0) {
        const cmdName = tokens[0].toLowerCase();
        const builtinName = cmdName.startsWith('@') ? cmdName.slice(1) : cmdName;
        if (ctx.builtins[builtinName]) {
            const result = await ctx.builtins[builtinName](tokens.slice(1), { line: expanded, scope, lineNum, type: 'command', filename, interpreter: selfInstance });
            if (result && result.ok === false) {
                if (onError && !result.suppressMsg) onError(ctx.formatError(result.error || 'Builtin failed', lineNum));
                return result;
            }
            return result || { ok: true };
        }
    }

    const result = await executeCommand(expanded, lineNum) || { ok: true };
    if (!result.ok) {
        if (result.haltScript) return result;
        if (ctx.ignoreNextCommand || ctx.flags.ignoreErrors) { ctx.ignoreNextCommand = false; return { ok: true }; }
        if (onError && !result.suppressMsg) onError(ctx.formatError(result.error || 'Command failed', lineNum));
        return result;
    }
    ctx.ignoreNextCommand = false;
    return { ok: true };
};

const runNodes = async (nodes, scope, depth, ctx, selfInstance, hooks, procedures, filename) => {
    const { onError, onFlags, recursionLimit, tokenize } = hooks;
    if (depth > recursionLimit) { if (onError) onError(ctx.formatError('Recursion limit exceeded.')); return { ok: false }; }
    for (const node of nodes) {
        try {
            if (node.type === 'directive') {
                if (node.name === 'ignore_subcmd_errors') ctx.ignoreNextCommand = true;
                if (node.name === 'no_echo') { ctx.flags.noEcho = true; if (onFlags) onFlags(ctx.flags); }
                if (node.name === 'echo_on') { ctx.flags.noEcho = false; if (onFlags) onFlags(ctx.flags); }
                if (node.name === 'silent') { ctx.flags.silent = true; if (onFlags) onFlags(ctx.flags); }
                if (node.name === 'silent_off') { ctx.flags.silent = false; if (onFlags) onFlags(ctx.flags); }
                continue;
            }
            if (node.type === 'break') return { signal: SIGNAL_BREAK, ok: true };
            if (node.type === 'continue') return { signal: SIGNAL_CONTINUE, ok: true };
            if (node.type === 'return') { return { signal: SIGNAL_RETURN, value: await evaluateExpression(node.value, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename), ok: true }; }
            if (node.type === 'wait') {
                const ms = parseInt(await evaluateExpression(node.value, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename));
                await new Promise(r => setTimeout(r, isNaN(ms) ? 0 : ms)); continue;
            }
            if (node.type === 'try_catch' || node.type === 'try_catch_inline') {
                let res;
                try {
                    res = await evaluateExpression(node.expression, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                    if (res && typeof res === 'object' && res.__tag === 'error') throw { type: 'explicit_error', value: res.value };
                    if (res && typeof res === 'object' && res.__tag === 'ok') res = res.value;
                } catch (e) {
                    const errVal = (e.type === 'bubble_error' || e.type === 'explicit_error') ? e.value : e.message;
                    const catchScope = { variables: { [node.errVar]: errVal }, parent: scope };
                    if (node.type === 'try_catch') {
                        const catchRes = await runNodes(node.catchBody, catchScope, depth, ctx, selfInstance, hooks, procedures, filename);
                        if (catchRes.signal) {
                            if (catchRes.signal === SIGNAL_RETURN) res = catchRes.value;
                            else return catchRes;
                        } else if (!catchRes.ok) return catchRes;
                        else if (node.varName) {
                            const v = findInScopes(node.varName, catchScope, ctx);
                            if (v) res = v.value;
                        }
                    } else {
                        const expanded = expandVariables(node.thenCmd, catchScope, ctx, getAllVariables);
                        if (expanded.toLowerCase().startsWith('return ')) {
                            const retVal = await evaluateExpression(expanded.slice(7), catchScope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                            return { signal: SIGNAL_RETURN, value: retVal, ok: true };
                        }
                        const cmdRes = await handleCommandExecution(expanded, node.lineNum, catchScope, ctx, selfInstance, hooks, procedures, filename, true);
                        if (!cmdRes.ok) return cmdRes;
                    }
                }
                if (node.varName) {
                    const varName = node.varName.startsWith('$') ? node.varName : '$' + node.varName;
                    if (node.assignType === 'global') ctx.globalScope[varName] = res;
                    else {
                        const existing = findInScopes(varName, scope, ctx);
                        if (existing && existing.scope === 'global') ctx.globalScope[varName] = res;
                        else if (existing && existing.scope !== 'global') existing.scope.variables[varName] = res;
                        else scope.variables[varName] = res;
                    }
                }
                continue;
            }
            if (node.type === 'for') {
                const rangeObj = await evaluateExpression(node.rangeExpr, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                if (!rangeObj || typeof rangeObj !== 'object' || rangeObj.__tag !== 'range') {
                    if (onError) onError(ctx.formatError(`Expression does not evaluate to a range: ${node.rangeExpr}`, node.lineNum));
                    return { ok: false };
                }
                const { start, end } = rangeObj;
                for (let val = start; val <= end; val++) {
                    const loopRes = await runNodes(node.body, { variables: { [node.varName]: val }, parent: scope }, depth, ctx, selfInstance, hooks, procedures, filename);
                    if (loopRes.signal === SIGNAL_BREAK) break;
                    if (loopRes.signal === SIGNAL_RETURN || !loopRes.ok) return loopRes;
                }
                continue;
            }
            if (node.type === 'var_echo') {
                const existing = findInScopes(node.name, scope, ctx);
                if (existing) { if (ctx.flags.echoVarValues && hooks.onCommand) hooks.onCommand(String(existing.value)); }
                else if (onError) { onError(ctx.formatError(`Variable $${node.name} not defined.`, node.lineNum)); return { ok: false }; }
                continue;
            }
            if (node.type === 'assign') {
                const newVal = await evaluateExpression(node.value, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                const varName = node.name.startsWith('$') ? node.name : '$' + node.name;
                if (node.assignType === 'global') ctx.globalScope[varName] = newVal;
                else if (node.assignType === 'reassign') {
                    const existing = findInScopes(varName, scope, ctx);
                    if (existing) {
                        if (!ctx.flags.allowCasting && existing.value !== null && typeof existing.value !== typeof newVal) { if (onError) onError(ctx.formatError(`Type mismatch for ${varName}.`, node.lineNum)); return { ok: false }; }
                        if (existing.scope === 'global') ctx.globalScope[varName] = newVal; else existing.scope.variables[varName] = newVal;
                    } else scope.variables[varName] = newVal;
                } else { if (scope.variables[varName] !== undefined) { if (onError) onError(ctx.formatError(`Variable ${varName} already declared.`, node.lineNum)); return { ok: false }; } scope.variables[varName] = newVal; }
                continue;
            }
            if (node.type === 'while') {
                while (true) {
                    if (!(await evaluateConditionAsync(node.condition, scope, depth, ctx, selfInstance, hooks, procedures, filename))) break;
                    const res = await runNodes(node.body, { variables: {}, parent: scope }, depth, ctx, selfInstance, hooks, procedures, filename);
                    if (res.signal === SIGNAL_BREAK) break;
                    if (res.signal === SIGNAL_RETURN || !res.ok) return res;
                }
                continue;
            }
            if (node.type === 'import') {
                const resolved = resolveImportPath(expandVariables(node.path, scope, ctx, getAllVariables), ctx, hooks.fs);
                if (!resolved || !hooks.fs.exists(resolved)) { if (onError) onError(ctx.formatError(`Import failed: ${node.path} not found.`, node.lineNum)); return { ok: false }; }
                if (ctx.importStack.includes(resolved)) continue;
                ctx.importStack.push(resolved);
                const fileRes = hooks.fs.cat(resolved);
                const previousCwd = ctx.cwd; ctx.cwd = resolved.substring(0, resolved.lastIndexOf('\\')) || 'C:\\';
                const res = await SmcInterpreter.runScript(fileRes.content, { ...hooks, filename: node.path }, ctx);
                ctx.cwd = previousCwd; ctx.importStack.pop();
                if (!res.ok) return res; continue;
            }
            if (node.type === 'if') {
                const chosen = (await evaluateConditionAsync(node.condition, scope, depth, ctx, selfInstance, hooks, procedures, filename)) ? node.thenNodes : node.elseNodes;
                const res = await runNodes(chosen, { variables: {}, parent: scope }, depth, ctx, selfInstance, hooks, procedures, filename);
                if (res.signal || !res.ok) return res; continue;
            }
            if (node.type === 'proc') { procedures.set(node.name.toLowerCase(), node); continue; }
            if (node.type === 'cmd') {
                const expandedLine = expandVariables(node.line, scope, ctx, getAllVariables);
                const tokens = tokenize(expandedLine);
                if (!tokens.length) continue;
                if (expandedLine.trim().startsWith('[') && expandedLine.trim().endsWith(']')) {
                    const inner = expandedLine.trim().slice(1, -1).trim();
                    await callFunctionOrProcedure(inner, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename);
                    continue;
                }
                const proc = procedures.get(tokens[0].toLowerCase());
                if (proc) {
                    const callArgs = parseProcedureCallArgs(expandedLine.slice(tokens[0].length).trim(), tokenize);
                    const procScope = { variables: {}, parent: scope };
                    proc.argNames.forEach((arg, idx) => procScope.variables[arg.startsWith('$') ? arg.slice(1) : arg] = callArgs[idx] ?? null);
                    ctx.callStack.push({ name: proc.name, args: callArgs, filename, lineNum: node.lineNum });
                    const res = await runNodes(proc.body, procScope, depth + 1, ctx, selfInstance, hooks, procedures, filename);
                    ctx.callStack.pop();
                    if (res.signal === SIGNAL_RETURN || res.ok) continue;
                    return res;
                }
                const res = await handleCommandExecution(expandedLine, node.lineNum, scope, ctx, selfInstance, hooks, procedures, filename, true);
                if (!res.ok) return res;
            }
        } catch (e) {
            if (e.type === 'bubble_error') return { signal: SIGNAL_RETURN, value: e.value, ok: true };
            if (onError) onError(ctx.formatError(e.message, node.lineNum));
            return { ok: false };
        }
    }
    return { ok: true };
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { findInScopes, getAllVariables, evaluateExpression, callFunctionOrProcedure, evaluateConditionAsync, handleCommandExecution, runNodes };
}
