/**
 * SMC C Transpiler
 */

const generateC = (nodes, filename = 'script.smc', debug = false) => {
    const { SIGNAL_CONTINUE, SIGNAL_BREAK, SIGNAL_RETURN } = typeof require !== 'undefined' ? require('./constants') : (root.SmcConstants || {});
    const { parseProcedureCallArgs } = typeof require !== 'undefined' ? require('./parser') : (root.SmcParser || {});

    const robustTokenize = (s) => {
        const tokens = [];
        let curr = '';
        let depth = 0;
        let inQuotes = false;
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (c === '"') inQuotes = !inQuotes;
            if (!inQuotes) {
                if (c === '[' || c === '(') depth++;
                if (c === ']' || c === ')') depth--;
                if ((c === ' ' || c === ',') && depth === 0) {
                    if (curr) tokens.push(curr);
                    curr = ''; continue;
                }
            }
            curr += c;
        }
        if (curr) tokens.push(curr);
        return tokens;
    };

    const splitByOp = (expr, op) => {
        let depth = 0, inQuotes = false;
        for (let i = expr.length - 1; i >= 0; i--) {
            const c = expr[i];
            if (c === '"') inQuotes = !inQuotes;
            if (!inQuotes) {
                if (c === ']' || c === ')') depth++;
                if (c === '[' || c === '(') depth--;
                if (depth === 0 && expr.substring(i - op.length + 1, i + 1) === op) {
                    return [expr.substring(0, i - op.length + 1), expr.substring(i + 1)];
                }
            }
        }
        return null;
    };

    // Evaluation helper for constant folding
    const tryEvaluate = (expr) => {
        if (typeof evaluateExpression === 'undefined') return null;
        if (expr.includes('$') || expr.includes('[') || expr.includes('(')) return null;
        
        try {
            const mockHooks = {
                tokenize: (s) => String(s).trim() ? String(s).trim().split(/\s+/) : []
            };
            const mockCtx = {
                globalScope: {},
                builtins: {}
            };
            const result = evaluateExpression(expr, { variables: {} }, 0, 0, mockCtx, {}, mockHooks, new Map(), 'compile_time');
            
            if (result === null) return 'make_none()';
            if (typeof result === 'number') return result % 1 === 0 ? `make_int(${result})` : `make_float(${result})`;
            if (typeof result === 'boolean') return result ? 'make_bool(true)' : 'make_bool(false)';
            if (typeof result === 'string') return `make_string("${result.replace(/"/g, '\\\\"')}")`;
            if (typeof result === 'object' && result.__tag === 'float') return `make_float(${result.value})`;
            return null;
        } catch (e) {
            return null;
        }
    };

    let output = '';
    
    // Runtime C Code
    output += `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <math.h>
#include <time.h>
#include <unistd.h>

#define SMC_DEBUG ${debug ? 1 : 0}
#define SMC_DBG_PREFIX "[SMCRuntimeDebug]"

typedef enum {
    VAL_NONE,
    VAL_INT,
    VAL_FLOAT,
    VAL_STRING,
    VAL_BOOL,
    VAL_RANGE,
    VAL_OK,
    VAL_ERROR
} ValueType;

struct Value;

typedef struct Value {
    ValueType type;
    union {
        long i_val;
        double f_val;
        char* s_val;
        bool b_val;
        struct { long start; long end; } r_val;
        struct Value* wrapped_val;
    } data;
} Value;

// Error Tracking & Call Stack
const char* current_file = "${filename}";
int current_line = 0;
int current_col = 0;
const char* current_func = "main";

typedef struct {
    const char* func;
    const char* file;
    int line;
    int col;
} StackFrame;

StackFrame call_stack[256];
int stack_ptr = 0;

void push_frame(const char* func, const char* file, int line, int col) {
    if (stack_ptr < 256) {
        call_stack[stack_ptr].func = current_func;
        call_stack[stack_ptr].file = current_file;
        call_stack[stack_ptr].line = current_line;
        call_stack[stack_ptr].col = current_col;
        stack_ptr++;
    }
#if SMC_DEBUG
    printf("%s CALL: %s in %s at %d:%d\\n", SMC_DBG_PREFIX, func, file, line, col);
#endif
    current_func = func;
    current_file = file;
    current_line = line;
    current_col = col;
}

void pop_frame() {
    if (stack_ptr > 0) {
        stack_ptr--;
#if SMC_DEBUG
        printf("%s RET:  %s from %s\\n", SMC_DBG_PREFIX, current_func, current_file);
#endif
        current_func = call_stack[stack_ptr].func;
        current_file = call_stack[stack_ptr].file;
        current_line = call_stack[stack_ptr].line;
        current_col = call_stack[stack_ptr].col;
    }
}

void runtime_error(const char* msg) {
    fprintf(stderr, "Runtime Error: In %s at %d:%d: %s\\n", current_file, current_line, current_col, msg);
    fprintf(stderr, "Call Stack:\\n");
    fprintf(stderr, "  at %s (%s at %d:%d)\\n", current_func, current_file, current_line, current_col);
    for (int i = stack_ptr - 1; i >= 0; i--) {
        fprintf(stderr, "  at %s (%s at %d:%d)\\n", call_stack[i].func, call_stack[i].file, call_stack[i].line, call_stack[i].col);
    }
    exit(1);
}

// Memory Management & Safety
Value copy_value(Value v) {
    if (v.type == VAL_STRING) {
#if SMC_DEBUG
        printf("%s ALLOC: string copy \\"%s\\"\\n", SMC_DBG_PREFIX, v.data.s_val);
#endif
        v.data.s_val = strdup(v.data.s_val);
    } else if ((v.type == VAL_OK || v.type == VAL_ERROR) && v.data.wrapped_val != NULL) {
        Value* inner = malloc(sizeof(Value));
        *inner = copy_value(*v.data.wrapped_val);
        v.data.wrapped_val = inner;
    }
    return v;
}

void free_value(Value v) {
    if (v.type == VAL_STRING && v.data.s_val != NULL) {
#if SMC_DEBUG
        printf("%s FREE:  string \\"%s\\"\\n", SMC_DBG_PREFIX, v.data.s_val);
#endif
        free(v.data.s_val);
    } else if (v.type == VAL_OK || v.type == VAL_ERROR) {
        if (v.data.wrapped_val != NULL) {
            free_value(*v.data.wrapped_val);
            free(v.data.wrapped_val);
        }
    }
}

Value make_none() { Value v; v.type = VAL_NONE; return v; }
Value make_int(long i) { Value v; v.type = VAL_INT; v.data.i_val = i; return v; }
Value make_float(double f) { Value v; v.type = VAL_FLOAT; v.data.f_val = f; return v; }
Value make_string(const char* s) { 
#if SMC_DEBUG
    printf("%s ALLOC: new string \\"%s\\"\\n", SMC_DBG_PREFIX, s ? s : "");
#endif
    Value v; v.type = VAL_STRING; v.data.s_val = strdup(s ? s : ""); return v; 
}
Value make_bool(bool b) { Value v; v.type = VAL_BOOL; v.data.b_val = b; return v; }

void value_to_string(Value v, char* buf, size_t buf_size) {
    if (v.type == VAL_STRING) {
        strncpy(buf, v.data.s_val, buf_size - 1);
        buf[buf_size - 1] = '\\0';
    } else if (v.type == VAL_INT) {
        snprintf(buf, buf_size, "%ld", v.data.i_val);
    } else if (v.type == VAL_FLOAT) {
        snprintf(buf, buf_size, "%.14g", v.data.f_val);
    } else if (v.type == VAL_BOOL) {
        strncpy(buf, v.data.b_val ? "true" : "false", buf_size - 1);
        buf[buf_size - 1] = '\\0';
    } else if (v.type == VAL_NONE) {
        strncpy(buf, "none", buf_size - 1);
        buf[buf_size - 1] = '\\0';
    } else {
        strncpy(buf, "[object]", buf_size - 1);
        buf[buf_size - 1] = '\\0';
    }
}

long value_to_long(Value v) {
    if (v.type == VAL_INT) return v.data.i_val;
    if (v.type == VAL_FLOAT) return (long)v.data.f_val;
    return 0;
}

bool is_truthy(Value v) {
    if (v.type == VAL_BOOL) return v.data.b_val;
    if (v.type == VAL_NONE) return false;
    if (v.type == VAL_INT) return v.data.i_val != 0;
    if (v.type == VAL_FLOAT) return v.data.f_val != 0;
    return true;
}

Value add(Value a, Value b) {
    if (a.type == VAL_INT && b.type == VAL_INT) return make_int(a.data.i_val + b.data.i_val);
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_float(f1 + f2);
    }
    if (a.type == VAL_STRING || b.type == VAL_STRING) {
        char s1[1024], s2[1024];
        value_to_string(a, s1, sizeof(s1));
        value_to_string(b, s2, sizeof(s2));
        char* res = malloc(strlen(s1) + strlen(s2) + 1);
        strcpy(res, s1);
        strcat(res, s2);
        Value v = make_string(res);
        free(res);
        return v;
    }
    runtime_error("Invalid types for addition.");
    return make_none();
}

Value sub(Value a, Value b) {
    if (a.type == VAL_INT && b.type == VAL_INT) return make_int(a.data.i_val - b.data.i_val);
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_float(f1 - f2);
    }
    runtime_error("Invalid types for subtraction.");
    return make_none();
}

Value mul(Value a, Value b) {
    if (a.type == VAL_INT && b.type == VAL_INT) return make_int(a.data.i_val * b.data.i_val);
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_float(f1 * f2);
    }
    runtime_error("Invalid types for multiplication.");
    return make_none();
}

Value dv(Value a, Value b) {
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        if (f2 == 0) runtime_error("Division by zero.");
        double res = f1 / f2;
        if (a.type == VAL_INT && b.type == VAL_INT && (long)f1 % (long)f2 == 0) {
            return make_int((long)res);
        }
        return make_float(res);
    }
    runtime_error("Invalid types for division.");
    return make_none();
}

Value eq(Value a, Value b) {
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_bool(fabs(f1 - f2) < 1e-9);
    }
    if (a.type == VAL_STRING && b.type == VAL_STRING) return make_bool(strcmp(a.data.s_val, b.data.s_val) == 0);
    if (a.type == b.type) {
        if (a.type == VAL_BOOL) return make_bool(a.data.b_val == b.data.b_val);
        if (a.type == VAL_NONE) return make_bool(true);
    }
    return make_bool(false);
}

Value le(Value a, Value b) {
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_bool(f1 <= f2);
    }
    return make_bool(false);
}

Value ge(Value a, Value b) {
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_bool(f1 >= f2);
    }
    return make_bool(false);
}

Value lt(Value a, Value b) {
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_bool(f1 < f2);
    }
    return make_bool(false);
}

Value gt(Value a, Value b) {
    if ((a.type == VAL_INT || a.type == VAL_FLOAT) && (b.type == VAL_INT || b.type == VAL_FLOAT)) {
        double f1 = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
        double f2 = (b.type == VAL_FLOAT) ? b.data.f_val : (double)b.data.i_val;
        return make_bool(f1 > f2);
    }
    return make_bool(false);
}

// Builtins
Value builtin_sqrt(Value a) {
    if (a.type != VAL_INT && a.type != VAL_FLOAT) runtime_error("sqrt requires a number.");
    double f = (a.type == VAL_FLOAT) ? a.data.f_val : (double)a.data.i_val;
    if (f < 0) runtime_error("Square root of negative number.");
    return make_float(sqrt(f));
}

Value builtin_abs(Value a) {
    if (a.type == VAL_INT) return make_int(labs(a.data.i_val));
    if (a.type == VAL_FLOAT) return make_float(fabs(a.data.f_val));
    runtime_error("abs requires a number.");
    return make_none();
}

Value builtin_len(Value a) {
    if (a.type != VAL_STRING) runtime_error("len requires a string.");
    return make_int(strlen(a.data.s_val));
}

Value builtin_typeof(Value a) {
    switch(a.type) {
        case VAL_INT: return make_string("int");
        case VAL_FLOAT: return make_string("float");
        case VAL_STRING: return make_string("string");
        case VAL_BOOL: return make_string("bool");
        case VAL_NONE: return make_string("none");
        case VAL_RANGE: return make_string("range");
        default: return make_string("unknown");
    }
}

Value builtin_append(Value* args, int count) {
    size_t total_len = 0;
    char** bufs = malloc(sizeof(char*) * count);
    for (int i = 0; i < count; i++) {
        bufs[i] = malloc(1024);
        value_to_string(args[i], bufs[i], 1024);
        total_len += strlen(bufs[i]);
    }
    char* res = malloc(total_len + 1);
    res[0] = '\\0';
    for (int i = 0; i < count; i++) {
        strcat(res, bufs[i]);
        free(bufs[i]);
    }
    free(bufs);
    Value v = make_string(res);
    free(res);
    return v;
}

Value builtin_echo(Value* args, int count) {
    char buf[1024];
    for (int i = 0; i < count; i++) {
        value_to_string(args[i], buf, sizeof(buf));
        printf("%s%s", buf, i == count - 1 ? "" : " ");
    }
    printf("\\n");
    return make_none();
}

// Hash Table Variable Registry
#define HASH_SIZE 4096
typedef struct {
    char* key;
    Value val;
    bool occupied;
} HashEntry;

HashEntry hash_table[HASH_SIZE];

unsigned int hash(const char* str) {
    unsigned int h = 5381;
    int c;
    while ((c = *str++)) h = ((h << 5) + h) + c;
    return h % HASH_SIZE;
}

void set_var(const char* name, Value v) {
#if SMC_DEBUG
    printf("%s SETVAR: %s\\n", SMC_DBG_PREFIX, name);
#endif
    unsigned int h = hash(name);
    while (hash_table[h].occupied) {
        if (strcmp(hash_table[h].key, name) == 0) {
            free_value(hash_table[h].val);
            hash_table[h].val = copy_value(v);
            return;
        }
        h = (h + 1) % HASH_SIZE;
    }
    hash_table[h].key = strdup(name);
    hash_table[h].val = copy_value(v);
    hash_table[h].occupied = true;
}

Value get_var(const char* name) {
    unsigned int h = hash(name);
    unsigned int start = h;
    while (hash_table[h].occupied) {
        if (strcmp(hash_table[h].key, name) == 0) {
            return copy_value(hash_table[h].val);
        }
        h = (h + 1) % HASH_SIZE;
        if (h == start) break;
    }
    return make_none();
}

void cleanup_vars() {
#if SMC_DEBUG
    printf("%s CLEANUP: variables\\n", SMC_DBG_PREFIX);
#endif
    for (int i = 0; i < HASH_SIZE; i++) {
        if (hash_table[i].occupied) {
            free(hash_table[i].key);
            free_value(hash_table[i].val);
        }
    }
}

// Function Declarations
`;

    // Forward declare procedures
    const procs = nodes.filter(n => n.type === 'proc');
    const getCProcName = (name) => 'proc_' + name.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '_');

    for (const p of procs) {
        output += `Value ${getCProcName(p.name)}(Value* args, int count);\n`;
    }

    const compileExpr = (expr) => {
        expr = expr.trim();
        if (!expr) return 'make_none()';

        // Literal check first
        if (/^[0-9]+$/.test(expr)) return `make_int(${expr})`;
        if (/^[0-9]+\.[0-9]+$/.test(expr)) return `make_float(${expr})`;
        if (expr === 'true') return 'make_bool(true)';
        if (expr === 'false') return 'make_bool(false)';
        if (expr === 'none') return 'make_none()';
        if (expr.startsWith('"') && expr.endsWith('"')) {
             const inner = expr.slice(1, -1).replace(/"/g, '\\\\"');
             return `make_string("${inner}")`;
        }

        // Constant Folding attempt for other expressions
        const folded = tryEvaluate(expr);
        if (folded) return folded;

        // Brackets [@func arg]
        if (expr.startsWith('[') && expr.endsWith(']')) {
            const inner = expr.slice(1, -1).trim();
            if (inner.startsWith('@')) {
                // Procedure/Builtin call
                const tokens = robustTokenize(inner);
                const name = tokens[0];
                const cleanName = name.slice(1);
                
                // Get the argument string by stripping the name from the inner content
                const argText = inner.slice(name.length).trim();
                const argsRaw = parseProcedureCallArgs(argText, robustTokenize);
                const args = argsRaw.map(compileExpr);
                
                if (cleanName === 'sqrt') return `builtin_sqrt(${args[0] || 'make_none()'})`;
                if (cleanName === 'abs') return `builtin_abs(${args[0] || 'make_none()'})`;
                if (cleanName === 'len') return `builtin_len(${args[0] || 'make_none()'})`;
                if (cleanName === 'typeof') return `builtin_typeof(${args[0] || 'make_none()'})`;
                if (cleanName === 'append') return `builtin_append((Value[]){${args.join(', ')}}, ${args.length})`;
                
                const proc = procs.find(p => p.name === cleanName || p.name === '@' + cleanName);
                if (proc) {
                    const cName = getCProcName(proc.name);
                    return `${cName}((Value[]){${args.length ? args.join(', ') : 'make_none()'}}, ${args.length})`;
                }
                throw new Error(`Compile Error: Unknown function or procedure '@${cleanName}'.`);
            } else {
                throw new Error(`Compile Error: Built-in or procedure call '${inner}' must be prefixed with '@' (e.g. '[${inner} ...]' -> '[@${inner} ...]').`);
            }
        }

        // Parens grouping
        if (expr.startsWith('(') && expr.endsWith(')')) {
            return compileExpr(expr.slice(1, -1));
        }

        // Arithmetic
        const ops = ['==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/'];
        for (const op of ops) {
            const parts = splitByOp(expr, op);
            if (parts) {
                const opFuncMap = {
                    '==': 'eq', '!=': 'neq', '<=': 'le', '>=': 'ge', '<': 'lt', '>': 'gt',
                    '+': 'add', '-': 'sub', '*': 'mul', '/': 'dv'
                };
                if (op === '!=') return `make_bool(!is_truthy(eq(${compileExpr(parts[0])}, ${compileExpr(parts[1])})))`;
                return `${opFuncMap[op]}(${compileExpr(parts[0])}, ${compileExpr(parts[1])})`;
            }
        }

        if (expr.startsWith('$')) return `get_var("${expr.slice(1)}")`;

        return `make_string("${expr.replace(/"/g, '\\\\"')}")`;
    };

    const compileCondition = (cond) => {
        return `is_truthy(${compileExpr(cond)})`;
    };

    const compileNodes = (nodes, indent = '    ', isMain = false) => {
        let code = '';
        for (const node of nodes) {
            if (node.type === 'file_marker') {
                code += `${indent}// --- ${node.action === 'start' ? 'START' : 'END'} OF FILE: ${node.path} ---\n`;
                continue;
            }
            code += `${indent}current_line = ${node.lineNum}; current_col = ${node.col || 0};\n`;
            if (node.type === 'assign' || node.type === 'var') {
                code += `${indent}{ Value v = ${compileExpr(node.value)}; set_var("${node.name}", v); free_value(v); }\n`;
            } else if (node.type === 'global') {
                code += `${indent}set_var("${node.name}", ${compileExpr(node.value)});\n`;
            } else if (node.type === 'cmd') {
                const line = node.line.trim();
                if (line.startsWith('echo ')) {
                    const argText = line.slice(5).trim();
                    const args = robustTokenize(argText).map(compileExpr);
                    code += `${indent}{\n`;
                    code += `${indent}    Value args[] = {${args.join(', ')}};\n`;
                    code += `${indent}    builtin_echo(args, ${args.length});\n`;
                    args.forEach((arg, i) => {
                        if (arg.includes('(') || arg.includes('add') || arg.includes('get_var') || arg.includes('builtin') || arg.includes('proc_')) {
                             code += `${indent}    free_value(args[${i}]);\n`;
                        }
                    });
                    code += `${indent}}\n`;
                } else if (line.startsWith('wait ')) {
                    code += `${indent}{ Value v = ${compileExpr(line.slice(5))}; usleep(v.data.i_val * 1000); free_value(v); }\n`;
                }
            } else if (node.type === 'var_echo') {
                code += `${indent}{ Value v = get_var("${node.name}"); char buf[1024]; value_to_string(v, buf, sizeof(buf)); printf("%s\\n", buf); free_value(v); }\n`;
            } else if (node.type === 'if') {
                code += `${indent}if (${compileCondition(node.condition)}) {\n`;
                code += compileNodes(node.thenNodes, indent + '    ', isMain);
                if (node.elseNodes && node.elseNodes.length) {
                    code += `${indent}} else {\n`;
                    code += compileNodes(node.elseNodes, indent + '    ', isMain);
                }
                code += `${indent}}\n`;
            } else if (node.type === 'while') {
                code += `${indent}while (${compileCondition(node.condition)}) {\n`;
                code += compileNodes(node.body, indent + '    ', isMain);
                code += `${indent}}\n`;
            } else if (node.type === 'for') {
                if (node.rangeExpr.includes('..')) {
                    const [startExpr, endExpr] = node.rangeExpr.split('..');
                    code += `${indent}{\n`;
                    code += `${indent}    Value v_start = ${compileExpr(startExpr)};\n`;
                    code += `${indent}    Value v_end = ${compileExpr(endExpr)};\n`;
                    code += `${indent}    long start = value_to_long(v_start);\n`;
                    code += `${indent}    long end = value_to_long(v_end);\n`;
                    code += `${indent}    free_value(v_start); free_value(v_end);\n`;
                    code += `${indent}    for (long i = start; i <= end; i++) {\n`;
                    code += `${indent}        Value v_i = make_int(i);\n`;
                    code += `${indent}        set_var("${node.varName}", v_i);\n`;
                    code += `${indent}        free_value(v_i);\n`;
                    code += compileNodes(node.body, indent + '        ', isMain);
                    code += `${indent}    }\n`;
                    code += `${indent}}\n`;
                }
            } else if (node.type === 'return') {
                if (isMain) {
                    code += `${indent}{ Value v = ${compileExpr(node.value)}; int ret = (v.type == VAL_INT ? v.data.i_val : 0); free_value(v); cleanup_vars(); return ret; }\n`;
                } else {
                    code += `${indent}{ Value v = ${compileExpr(node.value)}; return v; }\n`;
                }
            }
        }
        return code;
    };

    // Compile procedure definitions
    for (const p of procs) {
        const cName = getCProcName(p.name);
        output += `\nValue ${cName}(Value* args, int count) {\n`;
        output += `    push_frame("${p.name}", current_file, ${p.lineNum}, ${p.col || 0});\n`;
        if (p.argNames) {
            p.argNames.forEach((argName, i) => {
                output += `    if (count > ${i}) set_var("${argName.startsWith('$') ? argName.slice(1) : argName}", args[${i}]);\n`;
            });
        }
        output += compileNodes(p.body, '    ', false);
        output += `    pop_frame();\n`;
        output += `    return make_none();\n}\n`;
    }

    output += `\nint main() {\n`;
    output += compileNodes(nodes.filter(n => n.type !== 'proc'), '    ', true);
    output += `    cleanup_vars();\n`;
    output += `    return 0;\n}\n`;

    return output;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateC };
}
