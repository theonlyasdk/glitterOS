/**
 * Standalone SMC Node.js Runner
 * Usage: node node_runner.js <script.smc>
 */
const fs = require('fs');
const path = require('path');
const SmcInterpreter = require('../../../../core/services/smcInterpreter.js');

const scriptPath = process.argv[2];
if (!scriptPath) {
    console.error("Usage: node node_runner.js <script.smc>");
    process.exit(1);
}

const content = fs.readFileSync(scriptPath, 'utf8');

const mockFs = {
    pwd: () => process.cwd(),
    exists: (p) => fs.existsSync(p),
    cat: (p) => {
        try {
            return { content: fs.readFileSync(p, 'utf8') };
        } catch (e) {
            return { error: e.message };
        }
    }
};

const builtins = {
    echo: (args) => {
        console.log(args.join(' '));
        return { ok: true };
    },
    wait: async (args) => {
        const ms = parseInt(args[0]);
        await new Promise(r => setTimeout(r, isNaN(ms) ? 0 : ms));
        return { ok: true };
    },
    notify: (args) => {
        console.log(`[NOTIFICATION] ${args[0]}: ${args[1]}`);
        return { ok: true };
    }
};

(async () => {
    try {
        const result = await SmcInterpreter.runScript(content, {
            tokenize: (s) => s.match(/(?:[^\s"]+|"[^"]*")+/g).map(t => t.startsWith('"') ? t.slice(1, -1) : t),
            executeCommand: (line) => {
                // For standalone, most things should be builtins.
                // If it hits here, it's an unrecognized command.
                return { ok: false, error: `Command not found: ${line.split(' ')[0]}` };
            },
            fs: mockFs,
            builtins,
            onError: (err) => console.error(err),
            onWarning: (msg) => console.warn(msg),
            filename: path.basename(scriptPath)
        });

        if (result.ok) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (e) {
        console.error("Runner Crash:", e);
        process.exit(1);
    }
})();
