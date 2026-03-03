/**
 * SMC Quick-Start Demo
 * Demonstrates how to use the SMC interpreter and transpiler in your own JS app.
 */

const Smc = require('../src/main');

/**
 * SMC Code to run
 */
const myScript = `
$name = "Developer"
echo "Hello, " + $name
$val = [@sqrt 100]
echo "Square root of 100 is: " + $val
if $val == 10 then
    echo "Logic works!"
end
`;

/**
 * Main Demo Function
 */
async function main() {
    console.log('--- 1. Interpreting SMC ---');
    
    // Minimal configuration: just provide an echo implementation
    await Smc.runScript(myScript, {
        builtins: {
            echo: (args) => console.log('SMC >', args.join(' '))
        },
        onError: (err) => console.error('SMC Error:', err)
    });

    console.log('\n--- 2. Compiling SMC to C ---');
    
    try {
        // High-level one-liner to get C code
        const cCode = Smc.compileToC(myScript);
        
        console.log('Generated C Code:');
        console.log('-----------------------------------');
        console.log(cCode);
        console.log('-----------------------------------');
        
    } catch (e) {
        console.error('Compilation Failed:', e.message);
    }
}

// Run the demo
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { Smc };
