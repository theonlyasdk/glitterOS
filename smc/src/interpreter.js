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

const isFloat = (v) => v && typeof v === 'object' && v.__tag === 'float';
const getVal = (v) => isFloat(v) ? v.value : v;
const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });

const getSmcType = (val) => {
    if (val === null) return "none";
    if (typeof val === 'object' && val.__tag) return val.__tag;
    if (typeof val === 'number') return "int";
    return typeof val;
};

const evaluateExpression = async (exprRaw, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col = 0) => {
    const { tokenize } = hooks;
    let expr = String(exprRaw || "").trim();
    if (!expr) return null;

    // 1. Pre-checks (try?, !)
    if (expr.startsWith('try?')) {
        const res = await evaluateExpression(expr.slice(4).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
        if (res && typeof res === 'object') {
            if (res.__tag === 'error') throw { type: 'bubble_error', value: res };
            if (res.__tag === 'ok') return res.value;
        }
        return res;
    }
    if (expr.startsWith('!')) {
        const val = await evaluateExpression(expr.slice(1).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
        return !getVal(val);
    }

    // 2. Recursive Splitting for Precedence
    const splitByOp = (s, op) => {
        let d = 0, br = 0, inQ = false;
        for (let i = s.length - 1; i >= 0; i--) {
            const c = s[i];
            if (c === '"' || c === "'") {
                if (i === 0 || s[i-1] !== '\\') inQ = !inQ;
            }
            if (!inQ) {
                if (c === ']') br++; if (c === '[') br--;
                if (c === ')') d++; if (c === '(') d--;
                if (d === 0 && br === 0 && s.substring(i - op.length + 1, i + 1) === op) {
                    return [s.substring(0, i - op.length + 1), s.substring(i + 1)];
                }
            }
        }
        return null;
    };

    const ops = [['==', 'eq'], ['!=', 'neq'], ['<=', 'le'], ['>=', 'ge'], ['<', 'lt'], ['>', 'gt'], ['..', 'range'], ['+', 'add'], ['-', 'sub'], ['*', 'mul'], ['/', 'dv']];
    for (const [op, name] of ops) {
        const parts = splitByOp(expr, op);
        if (parts) {
            const left = await evaluateExpression(parts[0].trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
            const right = await evaluateExpression(parts[1].trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
            const v1 = getVal(left);
            const v2 = getVal(right);

            if (op === '==') {
                if (left && left.__tag === 'range' && right && right.__tag === 'range') return left.start === right.start && left.end === right.end;
                return v1 === v2;
            }
            if (op === '!=') {
                if (left && left.__tag === 'range' && right && right.__tag === 'range') return left.start !== right.start || left.end !== right.end;
                return v1 !== v2;
            }
            if (op === '<') return v1 < v2;
            if (op === '>') return v1 > v2;
            if (op === '<=') return v1 <= v2;
            if (op === '>=') return v1 >= v2;
            if (op === '..') return { __tag: 'range', start: Number(v1), end: Number(v2) };

            const isAnyFloat = isFloat(left) || isFloat(right);
            if (typeof v1 === 'number' && typeof v2 === 'number') {
                let r;
                if (op === '+') r = v1 + v2;
                else if (op === '-') r = v1 - v2;
                else if (op === '*') r = v1 * v2;
                else if (op === '/') {
                    if (v2 === 0) throw new Error("Division by zero.");
                    r = v1 / v2;
                }
                return (isAnyFloat || (r % 1 !== 0)) ? makeFloat(r) : r;
            } else if (op === '+') {
                return String(v1 ?? '') + String(v2 ?? '');
            } else if (op === '/') {
                // Path joining logic
                let sRes = String(v1 ?? ''), sNext = String(v2 ?? '');
                let res = sRes.endsWith('\\') || sRes.endsWith('/') ? sRes + (sNext.startsWith('\\') || sNext.startsWith('/') ? sNext.slice(1) : sNext) : sRes + '\\' + (sNext.startsWith('\\') || sNext.startsWith('/') ? sNext.slice(1) : sNext);
                return res.replace(/\//g, '\\');
            }
            throw new Error(`Invalid operation ${op} on types ${getSmcType(left)} and ${getSmcType(right)}`);
        }
    }

    // 3. Leaf Nodes
    if (expr.startsWith('(') && expr.endsWith(')')) {
        return await evaluateExpression(expr.slice(1, -1), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
    }

    if (expr.startsWith('[') && expr.endsWith(']')) {
        const inner = expr.slice(1, -1).trim();
        if (inner.startsWith('?')) {
            const metaContent = inner.slice(1).trim();
            const metaTokens = tokenize(metaContent);
            const metaName = metaTokens[0].toLowerCase();
            const metaArgs = metaTokens.slice(1);
            if (metaName === 'typeof') {
                const val = await evaluateExpression(metaArgs.join(' '), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
                return getSmcType(val);
            }
            throw new Error(`Unknown metafunction: ?${metaName}`);
        } else if (inner.startsWith(':ok')) {
            const val = await evaluateExpression(inner.slice(3).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
            return { __tag: 'ok', value: val };
        } else if (inner.startsWith(':error')) {
            const val = await evaluateExpression(inner.slice(6).trim(), scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
            return { __tag: 'error', value: val };
        } else {
            return await callFunctionOrProcedure(inner, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col);
        }
    }

    if (expr.startsWith('$')) {
        const vName = expr.startsWith('$') ? expr : '$' + expr;
        const currentVars = getAllVariables(scope, ctx);
        if (currentVars[vName] !== undefined) return currentVars[vName];
        throw new Error(`Variable ${vName} not defined.`);
    }

    if (expr.startsWith('"') || expr.startsWith("'")) {
        let q = expr[0], str = '';
        for (let j = 1; j < expr.length; j++) {
            if (expr[j] === '\\') { str += expr[j + 1] || ''; j++; }
            else if (expr[j] === q) break;
            else str += expr[j];
        }
        // Handle interpolation
        return str.replace(/%\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => {
            const vars = getAllVariables(scope, ctx);
            const key = k.startsWith('$') ? k : '$' + k;
            let v = vars[key];
            return v !== undefined ? String(getVal(v)) : m;
        });
    }

    if (/^-?[0-9]/.test(expr)) {
        const num = parseFloat(expr);
        return expr.includes('.') ? makeFloat(num) : num;
    }

    if (expr.toLowerCase() === 'none') return null;
    if (expr.toLowerCase() === 'true') return true;
    if (expr.toLowerCase() === 'false') return false;

    return expr; // raw word
};

const callFunctionOrProcedure = async (inner, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col = 0) => {
    const { tokenize } = hooks;
    const tokens = tokenize(inner);
    if (!tokens.length) return null;
    const name = tokens[0].toLowerCase();
    
    // Use parseProcedureCallArgs to correctly split arguments by comma or robust tokenization
    const argText = inner.slice(tokens[0].length).trim();
    const rawArgs = parseProcedureCallArgs(argText, tokenize);
    const callArgs = [];
    for (const arg of rawArgs) {
        callArgs.push(await evaluateExpression(arg, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col));
    }

    const proc = procedures.get(name);
    if (proc) {
        const procScope = { variables: {}, parent: scope };
        proc.argNames.forEach((arg, idx) => procScope.variables[arg.startsWith('$') ? arg.slice(1) : '$' + arg] = callArgs[idx] ?? null);
        ctx.callStack.push({ name: proc.name, args: callArgs, filename, lineNum: lineNum, col: col });
        const res = await runNodes(proc.body, procScope, depth + 1, ctx, selfInstance, hooks, procedures, filename);
        ctx.callStack.pop();
        if (res.signal === SIGNAL_RETURN) return res.value;
        if (res.ok === false) throw { type: 'bubble_internal_error', res };
        return null;
    }
    const builtinName = name.startsWith('@') ? name.slice(1) : name;
    if (ctx.builtins[builtinName]) {
        return await ctx.builtins[builtinName](callArgs, { scope, lineNum, depth, col, type: 'expression', filename, interpreter: selfInstance });
    }
    throw new Error(`Function or procedure ${name} not found.`);
};

const evaluateConditionAsync = async (conditionExpr, scope, depth, ctx, selfInstance, hooks, procedures, filename, col = 0) => {
    const trimmed = conditionExpr.trim();
    const lower = trimmed.toLowerCase();
    // In new engine, we always evaluate as expression
    return !!getVal(await evaluateExpression(conditionExpr, scope, 0, depth, ctx, selfInstance, hooks, procedures, filename, col));
};

const handleCommandExecution = async (line, lineNum, scope, ctx, selfInstance, hooks, procedures, filename, skipExpansion = false, col = 0) => {
    const { onCommand, executeCommand, tokenize } = hooks;
    // Command execution still uses expandVariables for the WHOLE line if it's a raw system command
    // but builtins will use evaluateExpression on their arguments.
    
    const expanded = skipExpansion ? line : expandVariables(line, scope, ctx, getAllVariables);
    if (onCommand && !ctx.flags.silent && !ctx.flags.noEcho) onCommand(expanded);

    const tokens = tokenize(line); // Use raw line for builtin tokenization to preserve types
    if (tokens.length > 0) {
        const cmdName = tokens[0].toLowerCase();
        const builtinName = cmdName.startsWith('@') ? cmdName.slice(1) : cmdName;
        if (ctx.builtins[builtinName]) {
            const callArgs = [];
            for (let i = 1; i < tokens.length; i++) {
                callArgs.push(await evaluateExpression(tokens[i], scope, lineNum, 0, ctx, selfInstance, hooks, procedures, filename, col));
            }
            const result = await ctx.builtins[builtinName](callArgs.map(getVal), { line: expanded, scope, lineNum, col, type: 'command', filename, interpreter: selfInstance });
            if (result && result.ok === false) {
                throw new Error(result.error || 'Builtin failed');
            }
            return result || { ok: true };
        }
    }

    const result = await executeCommand(expanded, lineNum) || { ok: true };
    if (!result.ok) {
        if (result.haltScript) return result;
        if (ctx.ignoreNextCommand || ctx.flags.ignoreErrors) { ctx.ignoreNextCommand = false; return { ok: true }; }
        throw new Error(result.error || 'Command failed');
    }
    ctx.ignoreNextCommand = false;
    return { ok: true };
};

const runNodes = async (nodes, scope, depth, ctx, selfInstance, hooks, procedures, filename) => {
    const { onCommand, onError, onFlags, recursionLimit, tokenize } = hooks;
    if (depth > recursionLimit) { throw new Error('Recursion limit exceeded.'); }
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
            if (node.type === 'return') { return { signal: SIGNAL_RETURN, value: await evaluateExpression(node.value, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename, node.col), ok: true }; }
            if (node.type === 'wait') {
                const ms = parseInt(getVal(await evaluateExpression(node.value, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename, node.col)));
                await new Promise(r => setTimeout(r, isNaN(ms) ? 0 : ms)); continue;
            }
            if (node.type === 'try_catch' || node.type === 'try_catch_inline') {
                let res;
                try {
                    res = await (async () => {
                        const r = await evaluateExpression(node.expression, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename, node.col);
                        if (r && typeof r === 'object' && r.__tag === 'error') throw { type: 'explicit_error', value: r.value };
                        if (r && typeof r === 'object' && r.__tag === 'ok') return r.value;
                        return r;
                    })();
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
                        // Inline catch
                        const expanded = expandVariables(node.thenCmd, catchScope, ctx, getAllVariables);
                        if (expanded.toLowerCase().startsWith('return ')) {
                            const retVal = await evaluateExpression(expanded.slice(7), catchScope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename, node.col);
                            return { signal: SIGNAL_RETURN, value: retVal, ok: true };
                        }
                        const cmdRes = await handleCommandExecution(expanded, node.lineNum, catchScope, ctx, selfInstance, hooks, procedures, filename, true, node.col);
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
                const rangeObj = await evaluateExpression(node.rangeExpr, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename, node.col);
                if (!rangeObj || typeof rangeObj !== 'object' || rangeObj.__tag !== 'range') {
                    throw new Error(`Expression does not evaluate to a range: ${node.rangeExpr}`);
                }
                const { start, end } = rangeObj;
                for (let val = start; val <= end; val++) {
                    const loopRes = await runNodes(node.body, { variables: { [node.varName.startsWith('$') ? node.varName : '$' + node.varName]: val }, parent: scope }, depth, ctx, selfInstance, hooks, procedures, filename);
                    if (loopRes.signal === SIGNAL_BREAK) break;
                    if (loopRes.signal === SIGNAL_RETURN || !loopRes.ok) return loopRes;
                }
                continue;
            }
            if (node.type === 'var_echo') {
                const existing = findInScopes(node.name, scope, ctx);
                if (existing) { if (onCommand) onCommand(String(getVal(existing.value))); }
                else throw new Error(`Variable $${node.name} not defined.`);
                continue;
            }
            if (node.type === 'assign') {
                const newVal = await evaluateExpression(node.value, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename, node.col);
                const varName = node.name.startsWith('$') ? node.name : '$' + node.name;
                
                const existing = findInScopes(varName, scope, ctx);
                if (existing) {
                    const oldType = getSmcType(existing.value);
                    const newType = getSmcType(newVal);
                    
                    let finalizedVal = newVal;
                    let typeError = false;

                    if (!ctx.flags.allowCasting && existing.value !== null) {
                        if (oldType === "float" && newType === "int") {
                            finalizedVal = makeFloat(getVal(newVal));
                        } else if (oldType !== newType) {
                            typeError = true;
                        }
                    }

                    if (typeError) {
                        throw new Error(`Type mismatch for ${varName}: cannot assign ${newType} to ${oldType}.`);
                    }

                    if (existing.scope === 'global') ctx.globalScope[varName] = finalizedVal;
                    else existing.scope.variables[varName] = finalizedVal;
                } else {
                    if (node.assignType === 'global') ctx.globalScope[varName] = newVal;
                    else {
                        if (scope.variables[varName] !== undefined) { 
                            throw new Error(`Variable ${varName} already declared.`);
                        }
                        scope.variables[varName] = newVal;
                    }
                }
                continue;
            }
            if (node.type === 'while') {
                while (true) {
                    if (!(await evaluateConditionAsync(node.condition, scope, depth, ctx, selfInstance, hooks, procedures, filename, node.col))) break;
                    const res = await runNodes(node.body, { variables: {}, parent: scope }, depth, ctx, selfInstance, hooks, procedures, filename);
                    if (res.signal === SIGNAL_BREAK) break;
                    if (res.signal === SIGNAL_RETURN || !res.ok) return res;
                }
                continue;
            }
            if (node.type === 'import') {
                const resolved = resolveImportPath(expandVariables(node.path, scope, ctx, getAllVariables), ctx, hooks.fs);
                if (!resolved || !hooks.fs.exists(resolved)) { throw new Error(`Import failed: ${node.path} not found.`); }
                if (ctx.importStack.includes(resolved)) continue;
                ctx.importStack.push(resolved);
                const fileRes = hooks.fs.cat(resolved);
                const previousCwd = ctx.cwd; 
                ctx.cwd = resolved.substring(0, Math.max(resolved.lastIndexOf('/'), resolved.lastIndexOf('\\'))) || (resolved.includes('/') ? '/' : 'C:\\');
                const res = await selfInstance.runScript(fileRes.content, { ...hooks, filename: node.path }, ctx);
                ctx.cwd = previousCwd; 
                ctx.importStack.pop();
                if (!res.ok) return res; continue;
            }
            if (node.type === 'if') {
                const chosen = (await evaluateConditionAsync(node.condition, scope, depth, ctx, selfInstance, hooks, procedures, filename, node.col)) ? node.thenNodes : node.elseNodes;
                const res = await runNodes(chosen, { variables: {}, parent: scope }, depth, ctx, selfInstance, hooks, procedures, filename);
                if (res.signal || !res.ok) return res; continue;
            }
            if (node.type === 'proc') { 
                procedures.set(node.name.toLowerCase(), node); 
                continue; 
            }
            if (node.type === 'cmd') {
                const expandedLine = expandVariables(node.line, scope, ctx, getAllVariables);
                const tokens = tokenize(node.line);
                if (!tokens.length) continue;
                if (node.line.trim().startsWith('[') && node.line.trim().endsWith(']')) {
                    const inner = node.line.trim().slice(1, -1).trim();
                    await callFunctionOrProcedure(inner, scope, node.lineNum, depth, ctx, selfInstance, hooks, procedures, filename, node.col);
                    continue;
                }
                const proc = procedures.get(tokens[0].toLowerCase());
                if (proc) {
                    const callArgs = parseProcedureCallArgs(node.line.slice(tokens[0].length).trim(), tokenize);
                    const procScope = { variables: {}, parent: scope };
                    proc.argNames.forEach((arg, idx) => procScope.variables[arg.startsWith('$') ? arg.slice(1) : '$' + arg] = callArgs[idx] ?? null);
                    ctx.callStack.push({ name: proc.name, args: callArgs, filename, lineNum: node.lineNum, col: node.col });
                    const res = await runNodes(proc.body, procScope, depth + 1, ctx, selfInstance, hooks, procedures, filename);
                    ctx.callStack.pop();
                    if (res.signal === SIGNAL_RETURN || res.ok) continue;
                    return res;
                }
                const res = await handleCommandExecution(node.line, node.lineNum, scope, ctx, selfInstance, hooks, procedures, filename, false, node.col);
                if (!res.ok) return res;
            }
        } catch (e) {
            if (e.type === 'bubble_error') return { signal: SIGNAL_RETURN, value: e.value, ok: true };
            if (e.type === 'bubble_internal_error') return e.res;
            if (onError) onError(ctx.formatError(e.message, node.lineNum, node.col));
            return { ok: false };
        }
    }
    return { ok: true };
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { findInScopes, getAllVariables, evaluateExpression, callFunctionOrProcedure, evaluateConditionAsync, handleCommandExecution, runNodes };
}
