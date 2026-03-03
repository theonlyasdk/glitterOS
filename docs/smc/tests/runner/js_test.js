/**
 * SMC Interpreter JavaScript API Test
 */
const SmcInterpreter = require('../../../../core/services/smcInterpreter.js');

(async () => {
    console.log("Starting SMC JS API tests...");

    const builtins = {
        echo: (args) => {
            console.log("  [SMC-ECHO]", args.join(' '));
            return { ok: true };
        },
        add: (args) => {
            return parseFloat(args[0]) + parseFloat(args[1]);
        }
    };

    const script = `
        var $A = 10
        var $B = 20
        var $C = [@add $A, $B]
        echo "Sum of A and B is: %C%"
        
        proc @test : $x do
            return $x * 10
        end
        
        var $D = [@test $C]
        echo "Result D: %D%"
    `;

    try {
        const result = await SmcInterpreter.runScript(script, {
            builtins,
            onError: (err) => console.error("  [SMC-ERROR]", err),
            onCommand: (cmd) => console.log("  [SMC-CMD]", cmd)
        });

        if (result.ok) {
            console.log("SMC JS API tests PASSED");
        } else {
            console.error("SMC JS API tests FAILED");
            process.exit(1);
        }
    } catch (e) {
        console.error("SMC JS API tests CRASHED", e);
        process.exit(1);
    }
})();
