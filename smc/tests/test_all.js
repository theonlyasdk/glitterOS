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

// Mock SmcBuiltins
global.SmcBuiltins = (() => {
    const _metadata = new Map();
    function setMeta(name, meta) { _metadata.set(name.toLowerCase(), meta); }
    function getMeta(name) { return _metadata.get(name.toLowerCase()) || {}; }
    function register() {} // not needed for tests
    return { setMeta, getMeta, register };
})();

global.SmcConstants = { SIGNAL_CONTINUE, SIGNAL_BREAK, SIGNAL_RETURN, INTERPRETER_ONLY_FLAGS };

const utils = require('../src/utils.js');
global.SmcUtils = utils;
Object.assign(global, utils);

const parser = require('../src/parser.js');
global.SmcParser = parser;
Object.assign(global, parser);

const math = require('../src/math.js');
global.SmcMathBuiltins = math;
Object.assign(global, math);

const string = require('../src/string.js');
global.SmcStringBuiltins = string;
Object.assign(global, string);

const interpreter = require('../src/interpreter.js');
global.SmcInterpreterCore = interpreter;
Object.assign(global, interpreter);

// Load real SMC source
const SmcInterpreter = require('../src/main.js');

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

// Robust tokenize that DOES NOT unquote strings
function robustTokenize(line) {
    const tokens = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
            if (inQuotes && char === quoteChar) {
                inQuotes = false;
            } else if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else {
                current += char;
            }
        } else if (char === ' ' && !inQuotes) {
            if (current) {
                tokens.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }
    if (current) tokens.push(current);
    return tokens;
}

async function runTestFile(filePath, expectError = false) {
    const filename = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    let lastError = null;

    const result = await SmcInterpreter.runScript(content, {
        tokenize: (s) => SmcParser.tokenizeSmc(s),
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
