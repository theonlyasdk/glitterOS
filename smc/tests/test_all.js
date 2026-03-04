/**
 * Comprehensive SMC Test Runner
 * Runs feature tests, malformed tests, and import tests.
 */
const fs = require('fs');
const path = require('path');

// Mock environment for source files
global.SIGNAL_CONTINUE = Symbol('continue');
global.SIGNAL_BREAK = Symbol('break');
global.SIGNAL_RETURN = Symbol('return');
global.INTERPRETER_ONLY_FLAGS = new Set(['ignore_errors', 'no_echo', 'silent', 'allow_casting', 'echo_var_values']);

const utils = require('../src/utils.js');
Object.assign(global, utils);
const math = require('../src/math.js');
Object.assign(global, math);
const string = require('../src/string.js');
Object.assign(global, string);
const parser = require('../src/parser.js');
Object.assign(global, parser);
const interpreter = require('../src/interpreter.js');
Object.assign(global, interpreter);

// Minimal main.js logic for runner
const SmcInterpreter = {
    runScript: async (content, hooks = {}, state = null) => {
        hooks.tokenize = hooks.tokenize || ((s) => String(s).trim() ? String(s).trim().split(/\s+/) : []);
        hooks.evaluateCondition = hooks.evaluateCondition || (() => false);
        hooks.executeCommand = hooks.executeCommand || (() => ({ ok: true }));
        hooks.fs = hooks.fs || { exists: (p) => fs.existsSync(p), cat: (p) => ({ content: fs.readFileSync(p, 'utf8') }), pwd: () => process.cwd() };
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
            builtins: Object.assign({}, MATH_BUILTINS, STRING_BUILTINS, hooks.builtins),
            flags: {},
            procedures: new Map()
        };

        const formatError = (msg, lineNum) => {
            const loc = lineNum ? ` at line ${lineNum}` : '';
            return `Error: ${filename}${loc}: ${msg}`;
        };
        ctx.formatError = formatError;

        const selfInstance = { 
            evaluateExpression: (expr, scope, lineNum, depth) => evaluateExpression(expr, scope, lineNum, depth, ctx, selfInstance, hooks, ctx.procedures, filename),
            runScript: (c, h, s) => SmcInterpreter.runScript(c, h, s)
        };

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

            const runResult = await runNodes(parsed.nodes, { variables: {}, parent: null }, 0, ctx, selfInstance, hooks, ctx.procedures, filename);
            runResult.flags = ctx.flags;
            return runResult;
        } catch (e) {
            const msg = formatError(e.message);
            if (onError) onError(msg);
            return { ok: false, error: msg };
        }
    }
};

const BASE_DIR = __dirname;
const FEATURES_DIR = path.join(BASE_DIR, 'features');
const MALFORMED_DIR = path.join(BASE_DIR, 'malformed');
const IMPORTS_DIR = path.join(BASE_DIR, 'imports');

const mockFs = {
    pwd: () => process.cwd(),
    exists: (p) => {
        const normalized = p.replace(/\\/g, '/');
        return fs.existsSync(normalized);
    },
    cat: (p) => {
        const normalized = p.replace(/\\/g, '/');
        try {
            const content = fs.readFileSync(normalized, 'utf8');
            return { content };
        } catch (e) {
            return { error: e.message };
        }
    }
};

const builtins = {
    echo: (args) => {
        console.log('    >', args.join(' '));
        return { ok: true };
    },
    wait: async (args) => {
        const ms = parseInt(args[0]);
        await new Promise(r => setTimeout(r, isNaN(ms) ? 0 : ms));
        return { ok: true };
    },
    notify: (args) => {
        return { ok: true };
    }
};

async function runTestFile(filePath, expectError = false) {
    const filename = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    let lastError = null;

    const result = await SmcInterpreter.runScript(content, {
        tokenize: (s) => {
            const matches = s.match(/(?:[^\s"]+|"[^"]*")+/g);
            return matches ? matches.map(t => t.startsWith('"') ? t.slice(1, -1) : t) : [];
        },
        executeCommand: (line) => ({ ok: true }),
        fs: mockFs,
        builtins,
        onError: (err) => {
            lastError = err;
        },
        filename
    });

    if (expectError) {
        if (lastError || !result.ok) {
            console.log(`  PASS: ${filename} (Caught expected error: ${String(lastError || result.error).split('\n')[0]})`);
            return true;
        } else {
            console.log(`  FAIL: ${filename} (Expected error but script succeeded)`);
            return false;
        }
    } else {
        if (result.ok && !lastError) {
            console.log(`  PASS: ${filename}`);
            return true;
        } else {
            console.log(`  FAIL: ${filename} (${lastError || result.error || 'Unknown error'})`);
            return false;
        }
    }
}

async function runAll() {
    let total = 0;
    let passed = 0;

    console.log('--- Running Feature Tests ---');
    if (fs.existsSync(FEATURES_DIR)) {
        const featureFiles = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.smc'));
        for (const f of featureFiles) {
            total++;
            if (await runTestFile(path.join(FEATURES_DIR, f))) passed++;
        }
    }

    console.log('\n--- Running Malformed Syntax Tests ---');
    if (fs.existsSync(MALFORMED_DIR)) {
        const malformedFiles = fs.readdirSync(MALFORMED_DIR).filter(f => f.endsWith('.smc'));
        for (const f of malformedFiles) {
            total++;
            if (await runTestFile(path.join(MALFORMED_DIR, f), true)) passed++;
        }
    }

    console.log('\n--- Running Rigid Import Tests ---');
    if (fs.existsSync(IMPORTS_DIR)) {
        const oldCwd = process.cwd();
        process.chdir(IMPORTS_DIR);
        const mainPath = path.join(IMPORTS_DIR, 'main.smc');
        if (fs.existsSync(mainPath)) {
            total++;
            if (await runTestFile(mainPath)) passed++;
        }
        process.chdir(oldCwd);
    }

    console.log(`\nTest Summary: ${passed}/${total} passed`);
    if (passed < total) process.exit(1);
}

runAll();
