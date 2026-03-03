const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// The main Smc module handles all environment setup
const Smc = require('../src/main');

async function runInterpreter(content, filename) {
    let output = '';
    const hooks = {
        builtins: {
            echo: (args) => {
                // Handle complex types (floats) by converting them to string
                const formatted = args.map(a => {
                    if (a && typeof a === 'object' && a.__tag === 'float') return String(a.value);
                    if (a === null) return 'none';
                    return String(a);
                }).join(' ');
                output += formatted + '\n';
                return { ok: true };
            }
        },
        fs: {
            exists: (p) => fs.existsSync(p),
            cat: (p) => ({ content: fs.readFileSync(p, 'utf8') }),
            pwd: () => process.cwd()
        },
        filename
    };

    await Smc.runScript(content, hooks);
    return output;
}

async function testFile(smcFile, expectFail = false) {
    const filename = path.basename(smcFile);
    console.log(`\nTesting ${filename}...`);
    const content = fs.readFileSync(smcFile, 'utf8');

    const cFile = smcFile.replace('.smc', '.tmp.c');
    const exeFile = smcFile.replace('.smc', '.exe');

    try {
        // 1. Compile to C
        const cCode = await Smc.compileToC(content, {
            fs: {
                exists: (p) => fs.existsSync(p),
                cat: (p) => ({ content: fs.readFileSync(p, 'utf8') }),
                pwd: () => path.dirname(smcFile)
            },
            cwd: path.dirname(smcFile),
            filename
        });

        if (expectFail) {
            console.log(`FAILURE: ${filename} was expected to fail compilation but succeeded.`);
            return false;
        }

        fs.writeFileSync(cFile, cCode);

        // 2. Run with Interpreter
        const interpreterOutput = await runInterpreter(content, filename);

        // 3. Compile C to Exe
        try {
            execSync(`gcc -O3 "${cFile}" -o "${exeFile}" -lm`);
        } catch (e) {
            console.error('C Compilation Failed:');
            console.error(e.stderr ? e.stderr.toString() : e.message);
            if (fs.existsSync(cFile)) fs.unlinkSync(cFile);
            return false;
        }

        // 4. Run Exe
        const exeOutput = execSync(exeFile).toString();

        // 5. Compare with normalization for float precision
        const normalize = (s) => s.trim().replace(/-?\d+\.\d+/g, (m) => parseFloat(m).toFixed(10));
        if (normalize(interpreterOutput) === normalize(exeOutput)) {
            console.log(`SUCCESS: ${filename} outputs match!`);
            if (fs.existsSync(cFile)) fs.unlinkSync(cFile);
            if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
            return true;
        } else {
            console.log(`FAILURE: ${filename} outputs do not match!`);
            console.log('--- Interpreter ---');
            console.log(interpreterOutput);
            console.log('--- Executable ---');
            console.log(exeOutput);
            if (fs.existsSync(cFile)) fs.unlinkSync(cFile);
            if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
            return false;
        }
    } catch (e) {
        if (expectFail) {
            console.log(`SUCCESS: ${filename} failed as expected: ${e.message}`);
            return true;
        }
        console.error(`ERROR: ${filename} failed unexpectedly: ${e.message}`);
        if (e.stack) console.error(e.stack);
        return false;
    }
}

async function runTests() {
    console.log('--- Testing SMC Compiler ---');
    
    let passed = 0;
    let total = 0;

    const files = [
        { path: path.join(__dirname, 'compiler_smoke.smc'), fail: false },
        { path: path.join(__dirname, 'compiler_complex.smc'), fail: false },
        { path: path.join(__dirname, 'compiler_fail.smc'), fail: true },
        { path: path.join(__dirname, 'fibonacci.smc'), fail: false },
        { path: path.join(__dirname, 'manual_sqrt.smc'), fail: false },
        { path: path.join(__dirname, 'prime_test.smc'), fail: false },
        { path: path.join(__dirname, 'err_syntax.smc'), fail: true },
        { path: path.join(__dirname, 'performance.smc'), fail: false }
    ];

    for (const f of files) {
        total++;
        if (await testFile(f.path, f.fail)) passed++;
    }

    console.log(`\nSummary: ${passed}/${total} passed`);
    if (passed < total) process.exit(1);
}

runTests();
