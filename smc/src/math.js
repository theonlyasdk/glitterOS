/**
 * SMC Math Builtins
 */

const MATH_BUILTINS = {
    random: (args) => {
        const isFloat = (v) => v && typeof v === 'object' && v.__tag === 'float';
        const getVal = (v) => isFloat(v) ? v.value : v;
        const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });

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
        const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
        return Math.floor(parseFloat(getVal(args[0]) || 0));
    },
    ceil: (args) => {
        const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
        return Math.ceil(parseFloat(getVal(args[0]) || 0));
    },
    sin: (args) => {
        const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
        const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });
        return makeFloat(Math.sin(parseFloat(getVal(args[0]) || 0)));
    },
    cos: (args) => {
        const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
        const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });
        return makeFloat(Math.cos(parseFloat(getVal(args[0]) || 0)));
    },
    abs: (args) => {
        const isFloat = (v) => v && typeof v === 'object' && v.__tag === 'float';
        const getVal = (v) => isFloat(v) ? v.value : v;
        const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });
        
        const v = getVal(args[0]);
        const r = Math.abs(parseFloat(v || 0));
        return isFloat(args[0]) ? makeFloat(r) : r;
    },
    round: (args) => {
        const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
        return Math.round(parseFloat(getVal(args[0]) || 0));
    },
    sqrt: (args) => {
        const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
        const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });
        const r = Math.sqrt(parseFloat(getVal(args[0]) || 0));
        return (r % 1 === 0) ? r : makeFloat(r);
    },
    pow: (args) => {
        const getVal = (v) => (v && typeof v === 'object' && v.__tag === 'float') ? v.value : v;
        const makeFloat = (v) => ({ __tag: 'float', value: Number(v) });
        const r = Math.pow(parseFloat(getVal(args[0]) || 0), parseFloat(getVal(args[1]) || 0));
        return (r % 1 === 0) ? r : makeFloat(r);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MATH_BUILTINS };
}
