#!/usr/bin/env node

/**
 * SMCC - The SMC Script Compiler
 * A command-line tool to compile SMC scripts into native executables via C.
 * 
 * Usage: node smcc.js <input.smc> [-o <output.exe>] [--keep-c] [--debug]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Smc = require('../src/main');

function printUsage() {
    console.log('SMCC - SMC Script Compiler');
    console.log('Usage: node smcc.js <input.smc> [options]');
    console.log('\nOptions:');
    console.log('  -o <file>    Specify the output executable name (default: input name with .exe)');
    console.log('  --keep-c     Do not delete the intermediate C source file');
    console.log('  --debug, -d  Enable runtime debug information (allocations, calls, etc.)');
    console.log('  -h, --help   Display this help message');
    process.exit(0);
}

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage();
}

let inputFile = null;
let outputFile = null;
let keepC = false;
let debugMode = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o') {
        outputFile = args[++i];
    } else if (args[i] === '--keep-c') {
        keepC = true;
    } else if (args[i] === '--debug' || args[i] === '-d') {
        debugMode = true;
    } else if (!inputFile) {
        inputFile = args[i];
    }
}

if (!inputFile) {
    console.error('Error: No input file specified.');
    process.exit(1);
}

if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' not found.`);
    process.exit(1);
}

// Determine paths
const inputBase = path.basename(inputFile, path.extname(inputFile));
outputFile = outputFile || (inputBase + (process.platform === 'win32' ? '.exe' : ''));
const tempCFile = inputBase + '.tmp.c';

console.log('SMCC - SMC Script Compiler');
console.log(`Compiling '${inputFile}' -> '${outputFile}'...`);

try {
    // 1. Read SMC Source
    const smcSource = fs.readFileSync(inputFile, 'utf8');

    // 2. Transpile to C (Async now)
    (async () => {
        try {
            const cCode = await Smc.compileToC(smcSource, {
                fs: {
                    exists: (p) => fs.existsSync(p),
                    cat: (p) => ({ content: fs.readFileSync(p, 'utf8') }),
                    pwd: () => process.cwd()
                },
                cwd: path.dirname(path.resolve(inputFile)),
                filename: path.basename(inputFile),
                debug: debugMode
            });

            // 3. Write intermediate C file
            fs.writeFileSync(tempCFile, cCode);

            // 4. Run C Compiler (gcc)
            // -O3 for optimization, -lm for math library
            const compileCmd = `gcc -O3 "${tempCFile}" -o "${outputFile}" -lm`;
            console.log(`Executing: ${compileCmd}`);
            
            execSync(compileCmd, { stdio: 'inherit' });

            console.log(`\nSUCCESS: Executable created at '${path.resolve(outputFile)}'`);

            // Cleanup
            if (!keepC) {
                fs.unlinkSync(tempCFile);
            } else {
                console.log(`Intermediate C source kept at '${tempCFile}'`);
            }
        } catch (e) {
            console.error('\nCOMPILATION FAILED:');
            console.error(e.message);
            if (fs.existsSync(tempCFile) && !keepC) fs.unlinkSync(tempCFile);
            process.exit(1);
        }
    })();

} catch (err) {
    console.error('\nCOMPILATION FAILED:');
    if (err.message.includes('gcc')) {
        console.error('Check if GCC is installed and in your PATH.');
    } else {
        console.error(err.message);
    }
    
    // Cleanup on failure
    if (fs.existsSync(tempCFile) && !keepC) {
        fs.unlinkSync(tempCFile);
    }
    process.exit(1);
}
