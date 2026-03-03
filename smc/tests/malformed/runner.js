/**
 * Malformed SMC Test Runner
 */
const fs = require('fs');
const path = require('path');

// Mock SmcInterpreter environment
global.SIGNAL_CONTINUE = Symbol('continue');
global.SIGNAL_BREAK = Symbol('break');
global.SIGNAL_RETURN = Symbol('return');
global.INTERPRETER_ONLY_FLAGS = new Set(['ignore_errors', 'no_echo', 'silent', 'allow_casting', 'echo_var_values']);

const utils = require('../../src/utils.js');
Object.assign(global, utils);
const parser = require('../../src/parser.js');
Object.assign(global, parser);
const interpreter = require('../../src/interpreter.js');
Object.assign(global, interpreter);

const SmcInterpreter = {
    runScript: async (content, hooks = {}, state = null) => {
        // Apply defaults to hooks
        hooks.tokenize = hooks.tokenize || ((s) => String(s).trim() ? String(s).trim().split(/\s+/) : []);
        hooks.evaluateCondition = hooks.evaluateCondition || (() => false);
        hooks.executeCommand = hooks.executeCommand || (() => ({ ok: true }));
        hooks.fs = hooks.fs || { exists: () => false, cat: () => ({ error: 'FS not provided' }), pwd: () => 'C:\\' };
        hooks.builtins = hooks.builtins || {};
        hooks.recursionLimit = hooks.recursionLimit || 32;
        hooks.filename = hooks.filename || 'script.smc';

        const {
            onCommand = null,
            onFlags = null,
            onError = null,
            onWarning = null,
            cwd = process.cwd(),
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

        const selfInstance = { evaluateExpression: (expr, scope, lineNum, depth) => evaluateExpression(expr, scope, lineNum, depth, ctx, selfInstance, hooks, procedures, filename) };

        try {
            const lines = parseScriptLines(content);
            const extracted = extractInterpreterFlags(lines);
            if (extracted.error) { if (onError) onError(formatError(extracted.error)); return { ok: false, error: extracted.error }; }
            const parsed = parseScriptBlock(extracted.lines, 0, []);
            if (parsed.error) { if (onError) onError(formatError(parsed.error)); return { ok: false, error: parsed.error }; }

            ctx.flags = ctx.flags || {};
            const flagSet = new Set((extracted.flags || []).map(f => f.toLowerCase()));
            ctx.flags.ignoreErrors = flagSet.has('ignore_errors');
            ctx.flags.noEcho = flagSet.has('no_echo');
            ctx.flags.silent = flagSet.has('silent');
            ctx.flags.allowCasting = flagSet.has('allow_casting');
            ctx.flags.echoVarValues = flagSet.has('echo_var_values');
            
            if (onFlags) onFlags(ctx.flags);

            const runResult = await runNodes(parsed.nodes, { variables: {}, parent: null }, 0, ctx, selfInstance, hooks, procedures, filename);
            runResult.flags = ctx.flags;
            return runResult;
        } catch (e) {
            const msg = formatError(e.message);
            if (onError) onError(msg);
            return { ok: false, error: msg };
        }
    }
};

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.smc'));

async function runTests() {
    console.log('Running Malformed SMC Tests...\n');
    for (const file of files) {
        console.log(`Testing ${file}:`);
        const content = fs.readFileSync(path.join(testDir, file), 'utf8');
        let errorCaught = null;
        
        await SmcInterpreter.runScript(content, {
            filename: file,
            onError: (err) => {
                errorCaught = err;
            }
        });

        if (errorCaught) {
            console.log('  PASS (Caught expected error):');
            console.log(`  > ${errorCaught.split('\n')[0]}`);
        } else {
            console.log('  FAIL (No error caught!)');
        }
        console.log('');
    }
}

runTests();
