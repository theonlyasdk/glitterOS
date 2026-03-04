const Markdown = (() => {

function esc(s){
    return String(s)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");
}

function tokenize(text){
    const lines = text.replace(/\r/g,"").split("\n");
    const tokens = [];
    let i = 0;

    while(i < lines.length){
        const line = lines[i];

        if(/^```/.test(line)){
            const lang = line.slice(3).trim();
            let code = [];
            i++;
            while(i < lines.length && !/^```/.test(lines[i])){
                code.push(lines[i]);
                i++;
            }
            tokens.push({type:"code_block", lang, content:code.join("\n")});
            i++;
            continue;
        }

        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if(h){
            tokens.push({type:"heading", depth:h[1].length, content:h[2]});
            i++;
            continue;
        }

        const l = line.match(/^\s*[-*]\s+(.+)/);
        if(l){
            const items = [];
            while(i < lines.length){
                const m = lines[i].match(/^\s*[-*]\s+(.+)/);
                if(!m) break;
                items.push(m[1]);
                i++;
            }
            tokens.push({type:"list", items});
            continue;
        }

        if(line.trim() === ""){
            i++;
            continue;
        }

        const para = [];
        while(i < lines.length && lines[i].trim() !== ""){
            if(/^(#{1,3})\s+/.test(lines[i])) break;
            if(/^```/.test(lines[i])) break;
            if(/^\s*[-*]\s+/.test(lines[i])) break;
            para.push(lines[i]);
            i++;
        }
        tokens.push({type:"paragraph", content:para.join("\n")});
    }

    return tokens;
}

function parseInline(text){
    const nodes = [];
    let i = 0;

    function pushText(t){
        if(!t) return;
        nodes.push({type:"text", value:t});
    }

    while(i < text.length){
        if(text.slice(i).startsWith("```")) break;

        if(text[i] === "`"){
            const end = text.indexOf("`", i+1);
            if(end !== -1){
                nodes.push({type:"code_inline", value:text.slice(i+1,end)});
                i = end+1;
                continue;
            }
        }

        if(text.slice(i).startsWith("***")){
            const end = text.indexOf("***", i+3);
            if(end !== -1){
                nodes.push({type:"bolditalic", children:parseInline(text.slice(i+3,end))});
                i = end+3;
                continue;
            }
        }

        if(text.slice(i).startsWith("**")){
            const end = text.indexOf("**", i+2);
            if(end !== -1){
                nodes.push({type:"bold", children:parseInline(text.slice(i+2,end))});
                i = end+2;
                continue;
            }
        }

        if(text[i] === "*"){
            const end = text.indexOf("*", i+1);
            if(end !== -1){
                nodes.push({type:"italic", children:parseInline(text.slice(i+1,end))});
                i = end+1;
                continue;
            }
        }

        if(text[i] === "["){
            const mid = text.indexOf("]", i+1);
            const end = text.indexOf(")", mid+1);
            if(mid !== -1 && text[mid+1] === "(" && end !== -1){
                const label = text.slice(i+1,mid);
                const url = text.slice(mid+2,end);
                nodes.push({type:"link", url, children:parseInline(label)});
                i = end+1;
                continue;
            }
        }

        let j = i+1;
        while(j < text.length && !["`","*","["].includes(text[j])) j++;
        pushText(text.slice(i,j));
        i = j;
    }

    return nodes;
}

function buildAST(tokens){
    return tokens.map(t=>{
        if(t.type === "heading")
            return {type:"heading", depth:t.depth, children:parseInline(t.content)};
        if(t.type === "paragraph")
            return {type:"paragraph", children:parseInline(t.content)};
        if(t.type === "list")
            return {type:"list", items:t.items.map(i=>parseInline(i))};
        if(t.type === "code_block")
            return {type:"code_block", lang:t.lang, value:t.content};
    });
}

function renderNode(node){
    if(node.type === "text") return esc(node.value);
    if(node.type === "code_inline")
        return `<code style="background:#333;padding:2px 5px;border-radius:4px;font-family:var(--font-family-mono);font-size:0.9em;color:#e8c84a;">${esc(node.value)}</code>`;
    if(node.type === "bold")
        return `<strong>${node.children.map(renderNode).join("")}</strong>`;
    if(node.type === "italic")
        return `<em>${node.children.map(renderNode).join("")}</em>`;
    if(node.type === "bolditalic")
        return `<strong><em>${node.children.map(renderNode).join("")}</em></strong>`;
    if(node.type === "link")
        return `<a href="${esc(node.url)}" target="_blank" style="color:var(--accent-color);text-decoration:none;border-bottom:1px dashed var(--accent-color);">${node.children.map(renderNode).join("")}</a>`;
    if(node.type === "heading"){
        const tag = node.depth === 1 ? "h3" : node.depth === 2 ? "h4" : "h5";
        return `<${tag} style="color:var(--accent-color);margin-top:1.5em;margin-bottom:0.5em;font-weight:600;">${node.children.map(renderNode).join("")}</${tag}>`;
    }
    if(node.type === "paragraph")
        return `<p>${node.children.map(renderNode).join("").replace(/\n/g,"<br>")}</p>`;
    if(node.type === "list")
        return `<ul style="margin:1em 0;padding-left:20px;">${node.items.map(i=>`<li>${i.map(renderNode).join("")}</li>`).join("")}</ul>`;
    if(node.type === "code_block"){
        let content = node.value;
        if(node.lang && node.lang.toLowerCase()==="smc" && typeof SyntaxHighlighter!=="undefined")
            content = SyntaxHighlighter.highlight("smc",content);
        else
            content = esc(content);
        return `<pre style="background:#0c0c0c;padding:12px;border-radius:6px;overflow-x:auto;border:1px solid #333;font-family:var(--font-family-mono);font-size:0.9rem;margin:1em 0;line-height:1.4;">${content}</pre>`;
    }
}

function render(text){
    if(!text) return "";
    const tokens = tokenize(text);
    const ast = buildAST(tokens);
    return ast.map(renderNode).join("\n");
}

return { render };

})();

window.Markdown = Markdown;