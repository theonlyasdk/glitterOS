/**
 * SMC Constants and Signals
 */

const SIGNAL_CONTINUE = Symbol('continue');
const SIGNAL_BREAK = Symbol('break');
const SIGNAL_RETURN = Symbol('return');

const INTERPRETER_ONLY_FLAGS = new Set(['ignore_errors', 'no_echo', 'silent', 'allow_casting', 'echo_var_values']);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SIGNAL_CONTINUE, SIGNAL_BREAK, SIGNAL_RETURN, INTERPRETER_ONLY_FLAGS };
}
