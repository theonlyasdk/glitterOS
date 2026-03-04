const SyntaxHighlighter = (() => {
    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function highlightSmc(text) {
        if (typeof window.tokenizeForHighlighting !== 'function') {
            return esc(text);
        }

        return String(text).split('\n').map(line => {
            const tokens = window.tokenizeForHighlighting(line) || [];
            return tokens.map(token => {
                const val = token.value ?? '';
                if (token.type === 'comment') return `<span class="gos-syn-com">${esc(val)}</span>`;
                if (token.type === 'string') {
                    const varRefRe = /%\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
                    let cursor = 0;
                    let out = '';
                    let match;
                    while ((match = varRefRe.exec(val)) !== null) {
                        out += esc(val.slice(cursor, match.index));
                        out += `<span class="gos-syn-varref">${esc(match[0])}</span>`;
                        cursor = match.index + match[0].length;
                    }
                    out += esc(val.slice(cursor));
                    return `<span class="gos-syn-str">${out}</span>`;
                }
                if (token.type === 'keyword') return `<span class="gos-syn-kw">${esc(val)}</span>`;
                if (token.type === 'operator') return `<span class="gos-syn-op">${esc(val)}</span>`;
                if (token.type === 'number') return `<span class="gos-syn-num">${esc(val)}</span>`;
                if (token.type === 'variable') return `<span class="gos-syn-varref">${esc(val)}</span>`;
                if (token.type === 'procedure') return `<span class="gos-syn-proc">${esc(val)}</span>`;
                return esc(val);
            }).join('');
        }).join('\n');
    }

    function highlightHtml(text) {
        const src = String(text);
        let out = '';
        let i = 0;

        function readTag(start) {
            let j = start + 1;
            let quote = null;
            while (j < src.length) {
                const ch = src[j];
                if (quote) {
                    if (ch === '\\') {
                        j += 2;
                        continue;
                    }
                    if (ch === quote) quote = null;
                    j++;
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    quote = ch;
                    j++;
                    continue;
                }
                if (ch === '>') break;
                j++;
            }
            return j < src.length ? j : -1;
        }

        function highlightTag(rawTag) {
            let k = 0;
            let result = '<span class="gos-syn-tag">';

            result += esc(rawTag[k++]);

            while (k < rawTag.length && /\s/.test(rawTag[k])) {
                result += esc(rawTag[k++]);
            }

            if (rawTag[k] === '/') {
                result += esc(rawTag[k++]);
            }

            while (k < rawTag.length && /\s/.test(rawTag[k])) {
                result += esc(rawTag[k++]);
            }

            let nameStart = k;
            while (k < rawTag.length && /[A-Za-z0-9:-]/.test(rawTag[k])) k++;
            if (k > nameStart) {
                result += `<span class="gos-syn-kw">${esc(rawTag.slice(nameStart, k))}</span>`;
            }

            while (k < rawTag.length - 1) {
                const ch = rawTag[k];

                if (/\s/.test(ch)) {
                    result += esc(ch);
                    k++;
                    continue;
                }

                if (ch === '"' || ch === "'") {
                    const q = ch;
                    let m = k + 1;
                    while (m < rawTag.length) {
                        if (rawTag[m] === '\\') {
                            m += 2;
                            continue;
                        }
                        if (rawTag[m] === q) {
                            m++;
                            break;
                        }
                        m++;
                    }
                    result += `<span class="gos-syn-str">${esc(rawTag.slice(k, m))}</span>`;
                    k = m;
                    continue;
                }

                if (ch === '=') {
                    result += `<span class="gos-syn-op">=</span>`;
                    k++;
                    continue;
                }

                if (/[A-Za-z_:]/.test(ch)) {
                    let m = k + 1;
                    while (m < rawTag.length && /[A-Za-z0-9:._-]/.test(rawTag[m])) m++;
                    result += `<span class="gos-syn-attr">${esc(rawTag.slice(k, m))}</span>`;
                    k = m;
                    continue;
                }

                result += esc(ch);
                k++;
            }

            result += esc(rawTag[rawTag.length - 1]);
            result += '</span>';
            return result;
        }

        while (i < src.length) {
            if (src.startsWith('<!--', i)) {
                const end = src.indexOf('-->', i + 4);
                const j = end === -1 ? src.length : end + 3;
                out += `<span class="gos-syn-com">${esc(src.slice(i, j))}</span>`;
                i = j;
                continue;
            }

            if (src[i] === '<') {
                const end = readTag(i);
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
                const match = src.slice(i).match(/^&[A-Za-z0-9#]+;/);
                if (match) {
                    out += `<span class="gos-syn-num">${esc(match[0])}</span>`;
                    i += match[0].length;
                    continue;
                }
            }

            out += esc(src[i]);
            i++;
        }

        return out;
    }

    function detectLanguage(path) {
        if (typeof path !== 'string') return null;
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
        return esc(text ?? '');
    }

    return { detectLanguage, highlight };
})();

window.SyntaxHighlighter = SyntaxHighlighter;