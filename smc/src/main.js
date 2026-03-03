/**
 * SMC Interpreter - Main Entry Point
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SmcInterpreter = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const SmcInterpreter = (() => {
        const { SIGNAL_CONTINUE, SIGNAL_BREAK, SIGNAL_RETURN, INTERPRETER_ONLY_FLAGS } = typeof require !== 'undefined' ? require('./constants') : (root.SmcConstants || {});
        const { normalize, stripInlineComments, resolveImportPath, expandVariables } = typeof require !== 'undefined' ? require('./utils') : (root.SmcUtils || {});
        const { MATH_BUILTINS } = typeof require !== 'undefined' ? require('./math') : (root.SmcMathBuiltins || {});
        const { STRING_BUILTINS } = typeof require !== 'undefined' ? require('./string') : (root.SmcStringBuiltins || {});

        // Bind basics to global for cross-module visibility before loading parser/interpreter
        const globals = { 
            SIGNAL_CONTINUE, SIGNAL_BREAK, SIGNAL_RETURN, INTERPRETER_ONLY_FLAGS,
            normalize, stripInlineComments, resolveImportPath, expandVariables, MATH_BUILTINS, STRING_BUILTINS 
        };
        if (typeof global !== 'undefined') Object.assign(global, globals);
        else if (typeof window !== 'undefined') Object.assign(window, globals);

        const parserExports = typeof require !== 'undefined' ? require('./parser') : (root.SmcParser || {});
        if (typeof global !== 'undefined') Object.assign(global, parserExports);
        else if (typeof window !== 'undefined') Object.assign(window, parserExports);

        const interpreterExports = typeof require !== 'undefined' ? require('./interpreter') : (root.SmcInterpreterCore || {});
        if (typeof global !== 'undefined') Object.assign(global, interpreterExports);
        else if (typeof window !== 'undefined') Object.assign(window, interpreterExports);

        const { generateC } = typeof require !== 'undefined' ? require('./compiler') : (root.SmcCompiler || {});

        const { parseScriptLines, parseDirective, extractInterpreterFlags, parseAssignment, parseWhile, parseImport, parseScriptBlock, parseProcedureCallArgs } = parserExports;
        const { findInScopes, getAllVariables, evaluateExpression, callFunctionOrProcedure, evaluateConditionAsync, handleCommandExecution, runNodes } = interpreterExports;

        async function runScript(content, hooks = {}, state = null) {
            // Apply defaults to hooks
            const robustTokenize = (s) => {
                const tokens = [];
                let curr = '';
                let depth = 0;
                let inQuotes = false;
                let quoteChar = '';
                for (let i = 0; i < s.length; i++) {
                    const c = s[i];
                    if ((c === '"' || c === "'") && (i === 0 || s[i - 1] !== '\\\\')) {
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

            hooks.tokenize = hooks.tokenize || robustTokenize;
            hooks.evaluateCondition = hooks.evaluateCondition || (() => false);
            hooks.executeCommand = hooks.executeCommand || (() => ({ ok: true }));
            hooks.fs = hooks.fs || ((typeof window !== 'undefined' && window.fs) ? window.fs : { exists: () => false, cat: () => ({ error: 'FS not provided' }), pwd: () => 'C:\\' });
            hooks.builtins = hooks.builtins || {};
            hooks.recursionLimit = hooks.recursionLimit || 32;
            hooks.filename = hooks.filename || 'script.smc';

            const {
                onCommand = null,
                onFlags = null,
                onError = null,
                onWarning = null,
                cwd = state ? state.cwd : hooks.fs.pwd(),
                filename = hooks.filename
            } = hooks;

            const ctx = state || {
                globalScope: {},
                importStack: [],
                callStack: [],
                ignoreNextCommand: false,
                cwd,
                builtins: Object.assign({}, MATH_BUILTINS, STRING_BUILTINS, hooks.builtins),
                flags: {},
                procedures: new Map()
            };

            const procedures = ctx.procedures;

            const formatError = (msg, lineNum, col) => {
                const loc = lineNum ? ` at ${lineNum}${col ? ':' + col : ''}` : '';
                let out = `Error: In ${filename}${loc}: ${msg}`;
                if (ctx.callStack && ctx.callStack.length > 0) {
                    out += '\nCall Stack:';
                    for (let i = ctx.callStack.length - 1; i >= 0; i--) {
                        const frame = ctx.callStack[i];
                        const args = frame.args.map(a => typeof a === 'string' ? `"${a}"` : a).join(', ');
                        out += `\n  at ${frame.name} : ${args} (${frame.filename} at ${frame.lineNum}${frame.col ? ':' + frame.col : ''})`;
                    }
                }
                return out;
            };
            ctx.formatError = formatError;

            const formatWarning = (msg, lineNum, col) => {
                const loc = lineNum ? ` at ${lineNum}${col ? ':' + col : ''}` : '';
                return `Warning: In ${filename}${loc}: ${msg}`;
            };
            ctx.formatWarning = formatWarning;

            const selfInstance = { 
                evaluateExpression: (expr, scope, lineNum, depth, col) => evaluateExpression(expr, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename, col),
                runScript: (content, hooks, state) => runScript(content, hooks, state)
            };

            const lines = parseScriptLines(content);
            const extracted = extractInterpreterFlags(lines);
            if (extracted.error) { 
                const msg = formatError(extracted.error);
                if (onError) onError(msg); 
                return { ok: false, error: msg }; 
            }
            
            const parsed = parseScriptBlock(extracted.lines, 0, []);
            if (parsed.error) { 
                const msg = formatError(parsed.error);
                if (onError) onError(msg); 
                return { ok: false, error: msg }; 
            }

            ctx.flags = ctx.flags || {};
            const flagSet = new Set((extracted.flags || []).map(f => f.toLowerCase()));
            if (!state) {
                // Only set initial flags if this is the entry script
                ctx.flags.ignoreErrors = flagSet.has('ignore_errors');
                ctx.flags.noEcho = flagSet.has('no_echo');
                ctx.flags.silent = flagSet.has('silent');
                ctx.flags.allowCasting = flagSet.has('allow_casting');
                ctx.flags.echoVarValues = flagSet.has('echo_var_values');
                if (onFlags) onFlags(ctx.flags);
            }

            const runResult = await runNodes(parsed.nodes, { variables: {}, parent: null }, 0, ctx, selfInstance, hooks, procedures, filename);
            runResult.flags = ctx.flags;
            return runResult;
        }

        async function compileToC(content, hooks = {}) {
            const fs = hooks.fs || ((typeof window !== 'undefined' && window.fs) ? window.fs : { exists: () => false, cat: () => ({ error: 'FS not provided' }), pwd: () => 'C:\\' });
            const importStack = [];
            const ctx = { cwd: hooks.cwd || fs.pwd() };
            const filename = hooks.filename || 'script.smc';
            const debug = !!hooks.debug;

            async function resolveNodesRecursively(scriptContent, currentPath) {
                const lines = parseScriptLines(scriptContent);
                const extracted = extractInterpreterFlags(lines);
                if (extracted.error) throw new Error(extracted.error);
                const parsed = parseScriptBlock(extracted.lines, 0, []);
                if (parsed.error) throw new Error(parsed.error);

                let allNodes = [];
                allNodes.push({ type: 'file_marker', action: 'start', path: currentPath });

                for (const node of parsed.nodes) {
                    if (node.type === 'import') {
                        const resolved = resolveImportPath(node.path, ctx, fs);
                        if (!resolved || !fs.exists(resolved)) throw new Error(`Import failed: ${node.path} not found.`);
                        if (importStack.includes(resolved)) continue;
                        
                        importStack.push(resolved);
                        const fileRes = fs.cat(resolved);
                        const previousCwd = ctx.cwd;
                        ctx.cwd = resolved.substring(0, Math.max(resolved.lastIndexOf('/'), resolved.lastIndexOf('\\'))) || (resolved.includes('/') ? '/' : 'C:\\');
                        
                        const importedNodes = await resolveNodesRecursively(fileRes.content, resolved);
                        allNodes.push(...importedNodes);
                        
                        ctx.cwd = previousCwd;
                    } else {
                        allNodes.push(node);
                    }
                }

                allNodes.push({ type: 'file_marker', action: 'end', path: currentPath });
                return allNodes;
            }

            const flattenedNodes = await resolveNodesRecursively(content, filename);
            return generateC(flattenedNodes, filename, debug);
        }

        return { 
            runScript,
            compileToC,
            utils: { normalize, stripInlineComments, resolveImportPath, expandVariables },
            parser: { parseScriptLines, parseDirective, extractInterpreterFlags, parseAssignment, parseWhile, parseImport, parseScriptBlock, parseProcedureCallArgs },
            interpreter: { findInScopes, getAllVariables, evaluateExpression, callFunctionOrProcedure, evaluateConditionAsync, handleCommandExecution, runNodes },
            compiler: { generateC }
        };
    })();

    return SmcInterpreter;
}));
