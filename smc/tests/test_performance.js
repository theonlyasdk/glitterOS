const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { performance } = require('perf_hooks');

// Mock environment
global.SIGNAL_CONTINUE = Symbol('continue');
global.SIGNAL_BREAK = Symbol('break');
global.SIGNAL_RETURN = Symbol('return');
global.INTERPRETER_ONLY_FLAGS = new Set(['ignore_errors', 'no_echo', 'silent', 'allow_casting', 'echo_var_values']);

const utils = require('../src/utils.js');
const parser = require('../src/parser.js');
const compiler = require('../src/compiler.js');
const interpreter = require('../src/interpreter.js');
const math = require('../src/math.js');
const string = require('../src/string.js');

Object.assign(global, utils, parser, compiler, interpreter, math, string);

async function runInterpreter(content, filename) {
    let output = '';
    const hooks = {
        tokenize: (s) => {
            const matches = s.match(/(?:[^\s"]+|"[^"]*")+/g);
            return matches ? matches.map(t => t.startsWith('"') ? t.slice(1, -1) : t) : [];
        },
        executeCommand: (line) => ({ ok: true }),
        fs: { exists: (p) => fs.existsSync(p), cat: (p) => ({ content: fs.readFileSync(p, 'utf8') }), pwd: () => process.cwd() },
        builtins: {
            echo: (args) => {
                output += args.join(' ') + '\n';
                return { ok: true };
            }
        },
        recursionLimit: 32,
        filename
    };

    const ctx = {
        globalScope: {},
        importStack: [],
        callStack: [],
        ignoreNextCommand: false,
        cwd: process.cwd(),
        builtins: Object.assign({}, MATH_BUILTINS, STRING_BUILTINS, hooks.builtins),
        flags: {},
        procedures: new Map()
    };

    const selfInstance = { 
        evaluateExpression: (expr, scope, lineNum, depth) => evaluateExpression(expr, scope, lineNum, depth, ctx, selfInstance, hooks, ctx.procedures, filename),
        runScript: (c, h, s) => { }
    };

    const lines = parseScriptLines(content);
    const extracted = extractInterpreterFlags(lines);
    const parsed = parseScriptBlock(extracted.lines, 0, []);
    
    await runNodes(parsed.nodes, { variables: {}, parent: null }, 0, ctx, selfInstance, hooks, ctx.procedures, filename);
    return output;
}

async function benchmark() {
    const smcFile = path.join(__dirname, 'performance.smc');
    const filename = path.basename(smcFile);
    console.log(`
Benchmarking ${filename}...`);
    const content = fs.readFileSync(smcFile, 'utf8');

    const cFile = smcFile.replace('.smc', '.c');
    const exeFile = smcFile.replace('.smc', '.exe');

    // 1. Run with Interpreter
    console.log('Running with Interpreter...');
    const startInterp = performance.now();
    const interpreterOutput = await runInterpreter(content, filename);
    const endInterp = performance.now();
    const interpTime = endInterp - startInterp;
    console.log(`Interpreter took: ${interpTime.toFixed(2)}ms`);
    console.log(`Result: ${interpreterOutput.trim()}`);

    // 2. Compile to C
    console.log('\nCompiling to C...');
    const lines = parseScriptLines(content);
    const extracted = extractInterpreterFlags(lines);
    const parsed = parseScriptBlock(extracted.lines, 0, []);
    const cCode = compiler.generateC(parsed.nodes);
    fs.writeFileSync(cFile, cCode);

    // 3. Compile C to Exe (with optimization)
    console.log('Compiling C to Executable (O3)...');
    try {
        execSync(`gcc -O3 ${cFile} -o ${exeFile} -lm`);
    } catch (e) {
        console.error('C Compilation Failed:');
        console.error(e.stderr ? e.stderr.toString() : e.message);
        return;
    }

    // 4. Run Exe
    console.log('Running Executable...');
    const startExe = performance.now();
    const exeOutput = execSync(exeFile).toString();
    const endExe = performance.now();
    const exeTime = endExe - startExe;
    console.log(`Executable took: ${exeTime.toFixed(2)}ms`);
    console.log(`Result: ${exeOutput.trim()}`);

    // 5. Compare & Report
    console.log('\n--- Performance Report ---');
    console.log(`Interpreter Time: ${interpTime.toFixed(2)}ms`);
    console.log(`Compiled Time:    ${exeTime.toFixed(2)}ms`);
    console.log(`Speedup:          ${(interpTime / exeTime).toFixed(2)}x`);

    if (interpreterOutput.trim() === exeOutput.trim()) {
        console.log('\nOutputs match! Benchmark valid.');
    } else {
        console.log('\nOutputs do NOT match! Benchmark invalid.');
    }

    // Cleanup
    // fs.unlinkSync(cFile);
    fs.unlinkSync(exeFile);
}

benchmark();
