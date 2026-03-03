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
        
        async function runScript(content, hooks = {}, state = null) {
            // Apply defaults to hooks
            hooks.tokenize = hooks.tokenize || ((s) => String(s).trim() ? String(s).trim().split(/\s+/) : []);
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
                builtins: hooks.builtins,
                flags: {}
            };

            const procedures = new Map();

            const formatError = (msg, lineNum) => {
                const loc = lineNum ? ` at line ${lineNum}` : '';
                let out = `Error: ${filename}${loc}: ${msg}`;
                if (ctx.callStack && ctx.callStack.length > 0) {
                    out += '\nCall Stack:';
                    for (let i = ctx.callStack.length - 1; i >= 0; i--) {
                        const frame = ctx.callStack[i];
                        const args = frame.args.map(a => typeof a === 'string' ? `"${a}"` : a).join(', ');
                        out += `\n  at ${frame.name} : ${args} (${frame.filename} at line ${frame.lineNum})`;
                    }
                }
                return out;
            };
            ctx.formatError = formatError;

            const formatWarning = (msg, lineNum) => {
                const loc = lineNum ? ` at line ${lineNum}` : '';
                return `Warning: ${filename}${loc}: ${msg}`;
            };
            ctx.formatWarning = formatWarning;

            const selfInstance = { evaluateExpression: (expr, scope, lineNum, depth) => evaluateExpression(expr, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename) };

            const lines = parseScriptLines(content);
            const extracted = extractInterpreterFlags(lines);
            if (extracted.error) { if (onError) onError(formatError(extracted.error)); return { ok: false, error: extracted.error }; }
            const parsed = parseScriptBlock(extracted.lines, 0, []);
            if (parsed.error) { if (onError) onError(formatError(parsed.error)); return { ok: false, error: parsed.error }; }

            ctx.flags = ctx.flags || {};
            const flagSet = new Set((extracted.flags || []).map(f => f.toLowerCase()));
            const initialFlags = {
                ignoreErrors: flagSet.has('ignore_errors'),
                noEcho: flagSet.has('no_echo'),
                silent: flagSet.has('silent'),
                allowCasting: flagSet.has('allow_casting'),
                echoVarValues: flagSet.has('echo_var_values')
            };
            Object.assign(ctx.flags, initialFlags);
            
            if (onFlags) onFlags(ctx.flags);

            const runResult = await runNodes(parsed.nodes, { variables: {}, parent: null }, 0, ctx, selfInstance, hooks, procedures, filename);
            runResult.flags = ctx.flags;
            return runResult;
        }

        return { 
            runScript,
            utils: { normalize, stripInlineComments, resolveImportPath, expandVariables },
            parser: { parseScriptLines, parseDirective, extractInterpreterFlags, parseAssignment, parseWhile, parseImport, parseScriptBlock, parseProcedureCallArgs },
            interpreter: { findInScopes, getAllVariables, evaluateExpression, callFunctionOrProcedure, evaluateConditionAsync, handleCommandExecution, runNodes }
        };
    })();

    return SmcInterpreter;
}));
