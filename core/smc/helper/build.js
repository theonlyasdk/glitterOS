/**
 * SMC Build Helper (Production-Grade)
 * Combines and safely minifies the SMC source files.
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const files = [
    'constants.js',
    'utils.js',
    'parser.js',
    'interpreter.js',
    'main.js'
];

async function build() {
    console.log('Building SMC Interpreter...');

    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
    }

    let combinedCode = '';

    for (const file of files) {
        console.log(`  Processing ${file}...`);
        const content = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
        combinedCode += content + '\n';
    }

    try {
        const result = await minify(combinedCode, {
            ecma: 2020,
            compress: {
                passes: 2,
                drop_console: false,
                drop_debugger: true,
                pure_getters: true,
                unsafe: false
            },
            mangle: {
                toplevel: true
            },
            format: {
                comments: false
            },
            sourceMap: {
                filename: "smc.min.js",
                url: "smc.min.js.map"
            }
        });

        const targetFile = path.join(DIST_DIR, 'smc.min.js');
        const mapFile = path.join(DIST_DIR, 'smc.min.js.map');

        fs.writeFileSync(targetFile, result.code);
        fs.writeFileSync(mapFile, result.map);

        console.log(`\nSUCCESS: Produced ${targetFile} (${result.code.length} bytes)`);

    } catch (err) {
        console.error('\nERROR: Build failed.');
        console.error(err);
        process.exit(1);
    }
}

build();