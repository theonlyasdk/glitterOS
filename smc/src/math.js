/**
 * SMC Math Builtins
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SmcMathBuiltins = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
    const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });
    const isFloat = (v) => v && typeof v === 'object' && v.__tag === 'float';

    const MATH_BUILTINS = {
        random: (args) => {
            let r;
            if (args.length === 2) {
                const min = parseFloat(getVal(args[0]));
                const max = parseFloat(getVal(args[1]));
                r = Math.random() * (max - min) + min;
            } else if (args.length === 1) {
                r = Math.random() * parseFloat(getVal(args[0]));
            } else {
                r = Math.random();
            }
            return makeFloat(r);
        },
        floor: (args) => {
            return Math.floor(parseFloat(getVal(args[0]) || 0));
        },
        ceil: (args) => {
            return Math.ceil(parseFloat(getVal(args[0]) || 0));
        },
        sin: (args) => {
            return makeFloat(Math.sin(parseFloat(getVal(args[0]) || 0)));
        },
        cos: (args) => {
            return makeFloat(Math.cos(parseFloat(getVal(args[0]) || 0)));
        },
        abs: (args) => {
            const v = getVal(args[0]);
            const r = Math.abs(parseFloat(v || 0));
            return isFloat(args[0]) ? makeFloat(r) : r;
        },
        round: (args) => {
            return Math.round(parseFloat(getVal(args[0]) || 0));
        },
        sqrt: (args) => {
            const r = Math.sqrt(parseFloat(getVal(args[0]) || 0));
            return (r % 1 === 0) ? r : makeFloat(r);
        },
        pow: (args) => {
            const r = Math.pow(parseFloat(getVal(args[0]) || 0), parseFloat(getVal(args[1]) || 0));
            return (r % 1 === 0) ? r : makeFloat(r);
        }
    };

    if (typeof SmcBuiltins !== 'undefined') {
        SmcBuiltins.setMeta('random', { args: [{ name: 'min', type: 'number' }, { name: 'max', type: 'number' }] });
        SmcBuiltins.setMeta('floor', { args: [{ name: 'val', required: true, type: 'number' }] });
        SmcBuiltins.setMeta('ceil', { args: [{ name: 'val', required: true, type: 'number' }] });
        SmcBuiltins.setMeta('sin', { args: [{ name: 'val', required: true, type: 'number' }] });
        SmcBuiltins.setMeta('cos', { args: [{ name: 'val', required: true, type: 'number' }] });
        SmcBuiltins.setMeta('abs', { args: [{ name: 'val', required: true, type: 'number' }] });
        SmcBuiltins.setMeta('round', { args: [{ name: 'val', required: true, type: 'number' }] });
        SmcBuiltins.setMeta('sqrt', { args: [{ name: 'val', required: true, type: 'number' }] });
        SmcBuiltins.setMeta('pow', { args: [{ name: 'base', required: true, type: 'number' }, { name: 'exp', required: true, type: 'number' }] });
    }

    return { MATH_BUILTINS };
}));
