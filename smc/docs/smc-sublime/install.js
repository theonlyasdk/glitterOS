/**
 * SMC Sublime Text Syntax Installer
 * Automatically installs the SMC syntax highlighting to Sublime Text.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function getSublimePackagesPath() {
    const home = os.homedir();
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.APPDATA, 'Sublime Text', 'Packages');
        case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Sublime Text', 'Packages');
        case 'linux':
            const paths = [
                path.join(home, '.config', 'sublime-text', 'Packages'),
                path.join(home, '.config', 'sublime-text-3', 'Packages')
            ];
            for (const p of paths) {
                if (fs.existsSync(p)) return p;
            }
            return paths[0];
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

const sourceFile = path.join(__dirname, 'SMC.sublime-syntax');
const sourceCompletions = path.join(__dirname, 'SMC.sublime-completions');
const packagesPath = getSublimePackagesPath();
const targetDir = path.join(packagesPath, 'SMC');
const targetFile = path.join(targetDir, 'SMC.sublime-syntax');
const targetCompletions = path.join(targetDir, 'SMC.sublime-completions');

console.log(`Sublime Packages detected at: ${packagesPath}`);

try {
    if (!fs.existsSync(targetDir)) {
        console.log(`Creating directory: ${targetDir}`);
        fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`Installing syntax to: ${targetFile}`);
    fs.copyFileSync(sourceFile, targetFile);

    if (fs.existsSync(sourceCompletions)) {
        console.log(`Installing completions to: ${targetCompletions}`);
        fs.copyFileSync(sourceCompletions, targetCompletions);
    }

    console.log('\nSUCCESS: SMC Syntax and Completions installed successfully!');
    console.log('Restart Sublime Text if the changes do not appear automatically.');
} catch (err) {
    console.error('\nERROR: Installation failed.');
    console.error(err.message);
    process.exit(1);
}
