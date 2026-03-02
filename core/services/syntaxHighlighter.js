const SyntaxHighlighter = (() => {
    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function highlightSmc(text) {
        const kws = new Set([
            'if', 'then', 'else', 'end', 'proc', 'do', 'var', 'let', 'set', 'while', 'global', 'wait', 'echo', 'type', 'cd', 'dir', 'md', 'mkdir', 'del', 'rm',
            'rd', 'rmdir', 'ren', 'copy', 'ver', 'help', 'cls', 'exit', 'history', 'runsmc', 'notify',
            'pwd', 'ls', 'cat', 'cp', 'mv', 'clear'
        ]);
        const ops = ['==', '!=', '<=', '>=', '<', '>', '||', '&&', '|', '=', '+', '-', '*', '/'];
        
        return String(text).split('\n').map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            
            // Full line comments
            if (trimmed.startsWith('//') || trimmed.toLowerCase().startsWith('rem ')) {
                return `<span class="gos-syn-com">${esc(line)}</span>`;
            }

            let out = '';
            let i = 0;
            while (i < line.length) {
                const ch = line[i];
                
                // Inline comments (if outside strings)
                if (ch === '#') {
                    out += `<span class="gos-syn-com">${esc(line.slice(i))}</span>`;
                    break;
                }

                if (ch === '"' || ch === "'") {
                    const quote = ch;
                    let j = i + 1;
                    while (j < line.length) {
                        if (line[j] === '\\') { j += 2; continue; }
                        if (line[j] === quote) { j++; break; }
                        j++;
                    }
                    const raw = line.slice(i, j);
                    const varRefRe = /%\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
                    let cursor = 0;
                    let highlightedParts = [];
                    varRefRe.lastIndex = 0;
                    let match;
                    while ((match = varRefRe.exec(raw)) !== null) {
                        if (match.index > cursor) {
                            highlightedParts.push(esc(raw.slice(cursor, match.index)));
                        }
                        highlightedParts.push(`<span class="gos-syn-varref">${esc(match[0])}</span>`);
                        cursor = match.index + match[0].length;
                    }
                    if (cursor < raw.length) {
                        highlightedParts.push(esc(raw.slice(cursor)));
                    }
                    const highlighted = highlightedParts.join('');
                    out += `<span class="gos-syn-str">${highlighted}</span>`;
                    i = j;
                    continue;
                }
                
                // Procedure calls / declarations
                if (ch === '@') {
                    let j = i + 1;
                    while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
                    out += `<span class="gos-syn-kw" style="color: #c586c0;">${esc(line.slice(i, j))}</span>`;
                    i = j;
                    continue;
                }
                
                // Variable references
                if (ch === '$') {
                    let j = i + 1;
                    while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
                    out += `<span class="gos-syn-varref" style="color: #9cdcfe;">${esc(line.slice(i, j))}</span>`;
                    i = j;
                    continue;
                }

                const op = ops.find(o => line.startsWith(o, i));
                if (op) {
                    out += `<span class="gos-syn-op">${esc(op)}</span>`;
                    i += op.length;
                    continue;
                }
                if (/[0-9]/.test(ch)) {
                    let j = i + 1;
                    while (j < line.length && /[0-9.]/.test(line[j])) j++;
                    out += `<span class="gos-syn-num">${esc(line.slice(i, j))}</span>`;
                    i = j;
                    continue;
                }
                if (/[A-Za-z_]/.test(ch)) {
                    let j = i + 1;
                    while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
                    const word = line.slice(i, j);
                    out += kws.has(word.toLowerCase()) ? `<span class="gos-syn-kw">${esc(word)}</span>` : esc(word);
                    i = j;
                    continue;
                }
                out += esc(ch);
                i++;
            }
            return out;
        }).join('\n');
    }

    function highlightHtml(text) {
        const src = String(text);

        function highlightTag(rawTag) {
            let i = 0;
            let out = '<span class="gos-syn-tag">';

            if (rawTag[i] === '<') { out += esc(rawTag[i]); i++; }
            while (i < rawTag.length && /\s/.test(rawTag[i])) { out += esc(rawTag[i]); i++; }
            if (rawTag[i] === '/') { out += esc(rawTag[i]); i++; }
            while (i < rawTag.length && /\s/.test(rawTag[i])) { out += esc(rawTag[i]); i++; }

            let j = i;
            while (j < rawTag.length && /[A-Za-z0-9:-]/.test(rawTag[j])) j++;
            if (j > i) out += `<span class="gos-syn-kw">${esc(rawTag.slice(i, j))}</span>`;
            i = j;

            while (i < rawTag.length) {
                if (rawTag[i] === '"' || rawTag[i] === "'") {
                    const q = rawTag[i];
                    let k = i + 1;
                    while (k < rawTag.length) {
                        if (rawTag[k] === '\\') { k += 2; continue; }
                        if (rawTag[k] === q) { k++; break; }
                        k++;
                    }
                    out += `<span class="gos-syn-str">${esc(rawTag.slice(i, k))}</span>`;
                    i = k;
                    continue;
                }
                if (rawTag[i] === '=') {
                    out += `<span class="gos-syn-op">=</span>`;
                    i++;
                    continue;
                }
                if (/[A-Za-z_:]/.test(rawTag[i])) {
                    let k = i + 1;
                    while (k < rawTag.length && /[A-Za-z0-9:._-]/.test(rawTag[k])) k++;
                    out += `<span class="gos-syn-op">${esc(rawTag.slice(i, k))}</span>`;
                    i = k;
                    continue;
                }
                out += esc(rawTag[i]);
                i++;
            }

            out += '</span>';
            return out;
        }

        let out = '';
        let i = 0;
        while (i < src.length) {
            if (src.startsWith('<!--', i)) {
                const end = src.indexOf('-->', i + 4);
                const j = end === -1 ? src.length : end + 3;
                out += `<span class="gos-syn-com">${esc(src.slice(i, j))}</span>`;
                i = j;
                continue;
            }
            if (src[i] === '<') {
                const end = src.indexOf('>', i + 1);
                if (end === -1) {
                    out += esc(src.slice(i));
                    break;
                }
                const tag = src.slice(i, end + 1);
                out += highlightTag(tag);
                i = end + 1;
                continue;
            }
            if (src[i] === '&') {
                const semi = src.indexOf(';', i + 1);
                if (semi !== -1 && semi - i <= 12) {
                    out += `<span class="gos-syn-num">${esc(src.slice(i, semi + 1))}</span>`;
                    i = semi + 1;
                    continue;
                }
            }
            out += esc(src[i]);
            i++;
        }
        return out;
    }

    function detectLanguage(path) {
        if (!path || typeof path !== 'string') return null;
        const m = path.trim().match(/\.([^.\\\/]+)$/);
        if (!m) return null;
        const ext = m[1].toLowerCase();
        if (ext === 'smc') return 'smc';
        if (['html', 'htm', 'xhtml', 'xml', 'svg'].includes(ext)) return 'html';
        return null;
    }

    function highlight(language, text) {
        const lang = (language || '').toLowerCase();
        if (lang === 'smc') return highlightSmc(text);
        if (lang === 'html') return highlightHtml(text);
        return esc(text || '');
    }

    return { detectLanguage, highlight };
})();

window.SyntaxHighlighter = SyntaxHighlighter;
