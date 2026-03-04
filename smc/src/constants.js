/**
 * SMC Constants and Signals
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SmcConstants = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const SIGNAL_CONTINUE = Symbol('continue');
    const SIGNAL_BREAK = Symbol('break');
    const SIGNAL_RETURN = Symbol('return');

    const INTERPRETER_ONLY_FLAGS = new Set(['ignore_errors', 'no_echo', 'silent', 'allow_casting', 'echo_var_values']);

    return { SIGNAL_CONTINUE, SIGNAL_BREAK, SIGNAL_RETURN, INTERPRETER_ONLY_FLAGS };
}));
