/**
 * SMC String Builtins
 */

const isFloat = (v) => v && typeof v === 'object' && v.__tag === 'float';
const getVal = (v) => isFloat(v) ? v.value : v;

const STRING_BUILTINS = {
    len: (args) => {
        return String(getVal(args[0]) || "").length;
    },
    upper: (args) => {
        return String(getVal(args[0]) || "").toUpperCase();
    },
    lower: (args) => {
        return String(getVal(args[0]) || "").toLowerCase();
    },
    trim: (args) => {
        return String(getVal(args[0]) || "").trim();
    },
    replace: (args) => {
        const str = String(getVal(args[0]) || "");
        const search = String(getVal(args[1]) || "");
        const replacement = String(getVal(args[2]) || "");
        return str.split(search).join(replacement);
    },
    substr: (args) => {
        const str = String(getVal(args[0]) || "");
        const start = parseInt(getVal(args[1]) || 0);
        const len = args[2] !== undefined ? parseInt(getVal(args[2])) : undefined;
        return str.substring(start, len !== undefined ? start + len : undefined);
    },
    index_of: (args) => {
        const str = String(getVal(args[0]) || "");
        const search = String(getVal(args[1]) || "");
        return str.indexOf(search);
    },
    char_at: (args) => {
        const str = String(getVal(args[0]) || "");
        const index = parseInt(getVal(args[1]) || 0);
        return str.charAt(index);
    },
    concat: (args) => {
        return args.map(a => String(getVal(a) ?? "")).join("");
    },
    append: (args) => {
        return args.map(a => String(getVal(a) ?? "")).join("");
    },
    typeof: (args) => {
        const val = args[0];
        if (val === null) return "none";
        if (typeof val === 'object' && val.__tag) return val.__tag;
        if (typeof val === 'number') return "int";
        return typeof val;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STRING_BUILTINS };
}
