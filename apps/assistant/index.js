// ── Assistant App — AI Chatbot Powered by Gemini ──────────────────────────────

const SYSTEM_PROMPT = `You are the glitterOS Assistant, a powerful and helpful AI agent designed to control the glitterOS desktop environment.
You have the ability to execute system commands by outputting a specific prefix followed by the command.

FILESYSTEM CONTEXT:
- The filesystem is Windows-like.
- The default user directory is C:\\Users\\User.
- Listing directory contents can be done by using the open_folder_in_explorer command which will show the content to the user, or you can assume standard paths exist.

COMMAND FORMAT:
gOS_MCPCmd::<COMMAND_NAME>(<ARGUMENTS>)

RULES:
1. ONLY output the command when you intend to perform an action.
2. Do not use Markdown for the command itself.
3. You can include a brief message before or after the command to the user.
4. If asked to perform multiple actions, output multiple commands each on a new line.
5. ALWAYS show visual feedback for the user by summarizing what you are doing.
6. MANDATORY: Prefix EVERY system action with "gOS_MCPCmd::".
7. For string arguments containing newlines or complex characters, wrap them in DOUBLE BACKTICKS (\`\`). Example: gOS_MCPCmd::save_to_file("test.txt", \`\`line 1\nline 2\`\`).

AVAILABLE TOOLS:
- set_wallpaper_from_url(url): Changes the desktop wallpaper.
- open_app(appId): Launches an application by its ID (e.g., 'notepad', 'filemanager' (alias: explorer), 'regedit', 'cmd', 'controlpanel', 'welcome', 'assistant').
- list_apps(): Returns a JSON list of all registered applications.
- run_in_cmd(command): Executes a command string in the glitterOS Command Prompt.
- open_menu(): Opens the system balloon menu.
- open_folder_in_explorer(path): Opens the File Explorer at a specific path.
- save_to_file(path, content): Writes content to a file in the virtual filesystem.
- download_image_to_file(url, path): Downloads an image from a URL and saves it to the specified path.
- lock_system(): Locks the screen.
- sleep_system(): Puts the system into a simulated nap state.
- restart_system(): Triggers a system reload.
- shutdown_system(): Fades out the screen and reloads.

Always be supportive, concise, and efficient. If you perform an action, briefly tell the user what you did. If a command fails, you will receive feedback and should try to correct your approach.`;

function launchAssistant() {
    const container = document.createElement('div');
    container.className = 'gos-assistant';

    // ── State Management ──────────────────────────────────────────────────────
    let _threads = []; // { id, title, messages: [], temporary: boolean }
    let _activeThreadId = null;
    let _isThinking = false;

    function loadHistory() {
        try {
            const saved = localStorage.getItem('gos_assistant_history');
            if (saved) {
                _threads = JSON.parse(saved);
                _threads = _threads.filter(t => !t.temporary);
            }
        } catch (e) {
            console.error('Assistant: Failed to load history', e);
        }
    }

    function saveHistory() {
        try {
            const toSave = _threads.filter(t => !t.temporary);
            localStorage.setItem('gos_assistant_history', JSON.stringify(toSave));
        } catch (e) {
            console.error('Assistant: Failed to save history', e);
        }
    }

    loadHistory();

    // ── UI Components ─────────────────────────────────────────────────────────
    const sidebar = document.createElement('div');
    sidebar.className = 'gos-assistant-sidebar';

    const sidebarHeader = document.createElement('div');
    sidebarHeader.className = 'gos-assistant-sidebar-header';

    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'gos-w32-btn';
    newChatBtn.innerHTML = '<i class="bi bi-plus-lg"></i> New Chat';
    newChatBtn.onclick = () => createNewThread(false);

    const newTempBtn = document.createElement('button');
    newTempBtn.className = 'gos-msg-btn';
    newTempBtn.innerHTML = '<i class="bi bi-incognito"></i> Temporary Chat';
    newTempBtn.onclick = () => createNewThread(true);

    sidebarHeader.append(newChatBtn, newTempBtn);

    const historyList = document.createElement('div');
    historyList.className = 'gos-assistant-history';
    sidebar.append(sidebarHeader, historyList);

    const main = document.createElement('div');
    main.className = 'gos-assistant-main';

    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'gos-assistant-messages';

    const inputWrap = document.createElement('div');
    inputWrap.className = 'gos-assistant-input-wrap';

    const inputArea = document.createElement('textarea');
    inputArea.className = 'gos-assistant-input';
    inputArea.placeholder = 'Message Assistant...';
    inputArea.rows = 1;

    const sendBtn = document.createElement('button');
    sendBtn.className = 'gos-w32-btn gos-assistant-send-btn disabled';
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="bi bi-send-fill"></i>';
    sendBtn.onclick = () => handleSend();

    inputWrap.append(inputArea, sendBtn);
    main.append(messagesContainer, inputWrap);

    const body = document.createElement('div');
    body.className = 'gos-assistant-body';
    body.append(sidebar, main);
    container.append(body);

    const mbar = buildAppMenuBar();
    mbar.createMenu('File', [
        { label: 'New Chat', action: () => createNewThread(false) },
        { label: 'New Temporary Chat', action: () => createNewThread(true) },
        { type: 'sep' },
        { label: 'Preferences', action: openPreferences },
        { type: 'sep' },
        { label: 'Exit', action: () => wm.closeWindow(win.id) }
    ]);
    mbar.createMenu('Edit', [
        { label: 'Clear History', color: '#f44336', action: clearAllHistory }
    ]);
    mbar.createMenu('Help', [
        { label: 'About Assistant', action: () => aboutGlitterOS('Assistant') }
    ]);
    container.prepend(mbar);

    // ── Logic ────────────────────────────────────────────────────────────────

    function createNewThread(temp = false) {
        const currentThread = _threads.find(t => t.id === _activeThreadId);
        if (currentThread && currentThread.messages.length === 0) {
            inputArea.focus();
            return;
        }

        const id = 'thread_' + Date.now();
        const thread = { id, title: temp ? 'Temporary Chat' : 'New Chat', messages: [], temporary: temp };
        _threads.unshift(thread);
        _activeThreadId = id;
        if (!temp) saveHistory();
        renderHistory();
        renderMessages();
        inputArea.focus();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        _threads.forEach(t => {
            const item = document.createElement('div');
            item.className = 'gos-assistant-history-item' + (t.id === _activeThreadId ? ' active' : '');
            item.innerHTML = `
                <i class="bi ${t.temporary ? 'bi-incognito' : 'bi-chat-left-text'}"></i>
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.title}</span>
                <button class="delete-btn" title="Delete Chat"><i class="bi bi-trash"></i></button>
            `;
            item.onclick = (e) => {
                if (e.target.closest('.delete-btn')) {
                    deleteThread(t.id);
                    return;
                }
                const cur = _threads.find(x => x.id === _activeThreadId);
                const oldId = _activeThreadId;
                _activeThreadId = t.id;

                // Discard empty chats on switch
                if (cur && cur.messages.length === 0 && cur.id !== t.id) {
                    _threads = _threads.filter(x => x.id !== oldId);
                }

                renderHistory();
                renderMessages();
            };
            item.oncontextmenu = (e) => {
                e.preventDefault();
                gosShowContextMenu(e.clientX, e.clientY, [
                    { label: 'Delete Chat', icon: 'bi-trash', color: 'danger', action: () => deleteThread(t.id) }
                ]);
            };
            historyList.appendChild(item);
        });
    }

    function parseMarkdown(text) {
        if (typeof Markdown !== 'undefined' && Markdown.render) {
            return Markdown.render(text);
        }
        // Fallback if Markdown service is missing
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }

    function renderMessages() {
        messagesContainer.innerHTML = '';
        const thread = _threads.find(t => t.id === _activeThreadId);
        if (!thread) return;

        if (thread.messages.length === 0) {
            const welcome = document.createElement('div');
            welcome.className = 'gos-assistant-welcome';
            welcome.innerHTML = `
                <i class="ri-sparkling-fill"></i>
                <h2>New Chat</h2>
            `;
            messagesContainer.appendChild(welcome);
            return;
        }

        thread.messages.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `gos-assistant-bubble ${msg.role === 'user' ? 'user' : (msg.isError ? 'error' : 'ai')}`;
            if (msg.role === 'user' || msg.isError) bubble.textContent = msg.text;
            else {
                let displayHtml = parseMarkdown(msg.text);
                let cmdCount = 0;
                displayHtml = displayHtml.replace(/gOS_MCPCmd::([a-zA-Z0-9_]+)\(([\s\S]*?)\)/g, (match, func, args) => {
                    const cmdIdx = cmdCount++;
                    const id = `cmd-${msg.turnId || 'hist'}-${cmdIdx}`;
                    const res = msg.commandResults ? msg.commandResults[cmdIdx] : null;

                    if (res) {
                        if (res.success) {
                            if (res.func === 'save_to_file' && res.path) {
                                // Direct string for history/re-render, handle backslashes
                                const safePath = res.path.replace(/\\/g, '\\\\');
                                return `<span id="${id}" class="gos-assistant-cmd-feedback completed">File saved to ${res.path}. <span class="gos-assistant-save-link" onclick="event.stopPropagation(); if(typeof intelligentOpen === 'function') intelligentOpen('${safePath}')">Click to open.</span></span>`;
                            }
                            return `<span id="${id}" class="gos-assistant-cmd-feedback completed">${getPastTenseFriendlyName(func)}.</span>`;
                        } else {
                            return `<span id="${id}" class="gos-assistant-cmd-feedback error">Error: ${res.message}</span>`;
                        }
                    }
                    return `<span id="${id}" class="gos-assistant-cmd-feedback shimmering">${getFriendlyName(func)}...</span>`;
                });
                bubble.innerHTML = displayHtml;
            }
            messagesContainer.appendChild(bubble);
        });

        if (_isThinking) {
            const thinking = document.createElement('div');
            thinking.className = 'gos-assistant-thinking bubble ai';
            thinking.innerHTML = `<div class="gos-assistant-dot"></div><div class="gos-assistant-dot"></div><div class="gos-assistant-dot"></div>`;
            messagesContainer.appendChild(thinking);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function handleSend(overrideText = null) {
        const text = overrideText || inputArea.value.trim();
        if (!text || _isThinking) return;

        const apiKey = localStorage.getItem('gos_assistant_api_key');
        const modelId = registry.get('Software.GlitterOS.Assistant.Model', 'gemini-2.0-flash');

        if (!apiKey) {
            wm.messageBox('Assistant', 'API Key Missing. Please set it in File > Preferences.', { icon: 'bi-exclamation-triangle' });
            return;
        }

        let thread = _threads.find(t => t.id === _activeThreadId);
        if (!thread) {
            createNewThread();
            thread = _threads.find(t => t.id === _activeThreadId);
        }
        thread.messages.push({ role: 'user', text });
        if (thread.title === 'New Chat') thread.title = text.substring(0, 24) + (text.length > 24 ? '...' : '');

        if (!overrideText) {
            inputArea.value = '';
            inputArea.style.height = 'auto';
        }

        sendBtn.disabled = true;
        sendBtn.classList.add('disabled');
        _isThinking = true;
        renderHistory();
        renderMessages();

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents: thread.messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }))
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errMsg = errorData.error?.message || response.statusText;
                if (response.status === 429) {
                    throw new Error("Quota Exceeded (429). You've reached your API rate limit. Please wait a moment or check your Google AI Studio quota.");
                }
                throw new Error(`API Error (${response.status}): ${errMsg}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiMsg = { role: 'model', text: '', images: [], turnId: Date.now() };
            thread.messages.push(aiMsg);

            _isThinking = false;
            renderMessages();
            const bubble = messagesContainer.lastElementChild;

            let hasContent = false;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.substring(6));
                            const cand = json.candidates?.[0];
                            if (!cand) continue;

                            const parts = cand.content?.parts || [];
                            parts.forEach(part => {
                                if (part.text) {
                                    aiMsg.text += part.text;
                                    hasContent = true;
                                }
                                if (part.inlineData) {
                                    aiMsg.images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                                    hasContent = true;
                                }
                            });

                            // Re-render with real-time friendly command replacements
                            let cmdCount = 0;
                            let streamingHtml = parseMarkdown(aiMsg.text);
                            streamingHtml = streamingHtml.replace(/gOS_MCPCmd::([a-zA-Z0-9_]+)\(([\s\S]*?)\)/g, (match, func) => {
                                const id = `cmd-${aiMsg.turnId}-${cmdCount++}`;
                                return `<span id="${id}" class="gos-assistant-cmd-feedback shimmering">${getFriendlyName(func)}...</span>`;
                            });
                            bubble.innerHTML = streamingHtml;
                            aiMsg.images.forEach(src => {
                                const img = document.createElement('img');
                                img.src = src;
                                img.style.cssText = 'max-width:100%;border-radius:4px;margin-top:8px;display:block;';
                                bubble.appendChild(img);
                            });
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        } catch (e) { }
                    }
                }
            }

            if (aiMsg.text.includes('gOS_MCPCmd::')) {
                const commands = aiMsg.text.match(/gOS_MCPCmd::[a-zA-Z0-9_]+\(.*\)/g);
                if (commands) {
                    const results = [];
                    for (let i = 0; i < commands.length; i++) {
                        results.push(await processCommand(commands[i], `cmd-${aiMsg.turnId}-${i}`));
                    }
                    aiMsg.commandResults = results;
                    if (!thread.temporary) saveHistory();

                    const failures = results.filter(r => !r.success);
                    if (failures.length > 0) {
                        const errorMsg = failures.map(f => f.message).join('; ');
                        setTimeout(() => handleSend(`System Error: ${errorMsg}. Please adjust and retry.`), 500);
                    }
                }
            }

            if (!hasContent) {
                aiMsg.text = "Model did not produce any output.";
            }

            if (!thread.temporary) saveHistory();
            renderMessages();
        } catch (err) {
            _isThinking = false;
            thread.messages.push({ role: 'ai', isError: true, text: "Error: " + err.message });
            renderMessages();
        }
    }

    function deleteThread(id) {
        const thread = _threads.find(t => t.id === id);
        const doDelete = () => {
            _threads = _threads.filter(t => t.id !== id);
            if (_activeThreadId === id) _activeThreadId = _threads[0]?.id || null;
            saveHistory(); renderHistory(); renderMessages();
        };

        if (thread && thread.temporary) {
            doDelete();
        } else {
            wm.messageBox('Assistant', 'Are you sure you want to delete this chat?', {
                buttons: 'yesno',
                icon: 'bi-trash',
                onYes: doDelete
            });
        }
    }

    function clearAllHistory() {
        wm.messageBox('Assistant', 'Clear history?', { buttons: 'yesno', onYes: () => { _threads = []; _activeThreadId = null; saveHistory(); renderHistory(); renderMessages(); } });
    }

    function getFriendlyName(func) {
        const map = {
            'set_wallpaper_from_url': 'Setting wallpaper',
            'open_app': 'Opening app',
            'list_apps': 'Listing apps',
            'run_in_cmd': 'Running command',
            'open_menu': 'Opening menu',
            'open_folder_in_explorer': 'Opening folder',
            'save_to_file': 'Saving to file',
            'download_image_to_file': 'Downloading image',
            'lock_system': 'Locking system',
            'sleep_system': 'Putting system to sleep',
            'restart_system': 'Restarting system',
            'shutdown_system': 'Shutting down system'
        };
        return map[func] || func.replace(/_/g, ' ');
    }

    function intelligentOpen(path) {
        if (!path) return;
        const stat = typeof fs !== 'undefined' ? fs.stat(path) : null;
        if (stat && stat.type === 'file') {
            if (typeof launchNotepad === 'function') {
                launchNotepad(path);
                return;
            }
        }
        if (typeof launchFileManager === 'function') launchFileManager(path);
    }

    function getPastTenseFriendlyName(func) {
        const map = {
            'set_wallpaper_from_url': 'Set wallpaper',
            'open_app': 'Opened app',
            'list_apps': 'Listed apps',
            'run_in_cmd': 'Ran command',
            'open_menu': 'Opened menu',
            'open_folder_in_explorer': 'Opened folder',
            'save_to_file': 'Saved to file',
            'download_image_to_file': 'Downloaded image',
            'lock_system': 'Locked system',
            'sleep_system': 'Put system to sleep',
            'restart_system': 'Restarted system',
            'shutdown_system': 'Shut down system'
        };
        return map[func] || func.replace(/_/g, ' ') + 'ed';
    }

    async function processCommand(cmdStr, elId) {
        const startTime = Date.now();
        // Support double backticks for multiline strings
        const match = cmdStr.match(/gOS_MCPCmd::([a-zA-Z0-9_]+)\(([\s\S]*)\)/);
        if (!match) return { success: false, message: 'Invalid command format' };

        const [_, func, argsRaw] = match;

        // Robust argument parser
        const args = [];
        let cur = '';
        let inBackticks = false;
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < argsRaw.length; i++) {
            const char = argsRaw[i];
            if (argsRaw.substring(i, i + 2) === '``') {
                inBackticks = !inBackticks;
                i++; continue;
            }
            if (!inBackticks && (char === '"' || char === "'")) {
                if (!inQuotes) { inQuotes = true; quoteChar = char; }
                else if (char === quoteChar) { inQuotes = false; }
                else { cur += char; }
                continue;
            }
            if (char === ',' && !inBackticks && !inQuotes) {
                args.push(cur.trim()); cur = ''; continue;
            }
            cur += char;
        }
        args.push(cur.trim());

        let result = { success: true, message: '' };

        try {
            switch (func) {
                case 'set_wallpaper_from_url':
                    if (typeof setWallpaper === 'function') setWallpaper(args[0]);
                    break;
                case 'open_app':
                    const app = AppRegistry.get(args[0]);
                    if (app) app.launch();
                    break;
                case 'list_apps':
                    const apps = AppRegistry.getAll().map(a => `${a.name} (${a.id})`).join(', ');
                    result.message = apps;
                    break;
                case 'run_in_cmd':
                    if (typeof launchCommandPrompt === 'function') launchCommandPrompt(args[0]);
                    break;
                case 'open_menu':
                    const btn = document.querySelector('.gos-mbar-item');
                    if (btn) btn.click();
                    break;
                case 'open_folder_in_explorer':
                    if (typeof launchFileManager === 'function') launchFileManager(args[0]);
                    break;
                case 'save_to_file':
                    if (typeof fs !== 'undefined') {
                        const res = fs.write(args[0], args[1]);
                        if (res.error) throw new Error(res.error);
                        result.path = args[0];
                    }
                    break;
                case 'download_image_to_file':
                    console.log(`Downloading ${args[0]} to ${args[1]}`);
                    break;
                case 'lock_system':
                    if (typeof lockScreen === 'function') lockScreen();
                    break;
                case 'sleep_system':
                    if (typeof systemSleep === 'function') systemSleep();
                    break;
                case 'restart_system':
                    location.reload();
                    break;
                case 'shutdown_system':
                    document.body.style.transition = 'opacity 2s';
                    document.body.style.opacity = '0';
                    setTimeout(() => location.reload(), 2500);
                    break;
            }
            result.func = func;
        } catch (e) {
            result.success = false;
            result.message = e.message;
            result.func = func;
            console.error('Assistant command failed:', e);
        }

        // Finalize feedback after at least 2 seconds
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 2000 - elapsed);
        setTimeout(() => {
            const el = document.getElementById(elId);
            if (el) {
                el.classList.remove('shimmering');
                if (result.success) {
                    el.classList.add('completed');
                    if (func === 'save_to_file' && result.path) {
                        const safePath = result.path.replace(/\\/g, '\\\\');
                        el.innerHTML = `File saved to ${result.path}. <span class="gos-assistant-save-link">Click to open.</span>`;
                        el.onclick = () => { intelligentOpen(result.path); };
                    } else {
                        el.textContent = getPastTenseFriendlyName(func) + '.';
                    }
                } else {
                    el.classList.add('error');
                    el.textContent = `Error: ${result.message}`;
                }
            }
        }, remaining);

        return result;
    }

    function openPreferences() {
        const dlgContainer = document.createElement('div');
        dlgContainer.className = 'gos-taskmgr';
        dlgContainer.style.height = '100%';
        dlgContainer.style.display = 'flex';
        dlgContainer.style.flexDirection = 'column';

        const header = document.createElement('div');
        header.className = 'gos-tab-strip';

        const tabContent = document.createElement('div');
        tabContent.className = 'gos-taskmgr-content';
        tabContent.style.flex = '1';
        tabContent.style.overflowY = 'auto';

        const tabs = [{ id: 'general', label: 'General' }];
        let activeTab = 'general';

        function renderGeneral() {
            tabContent.innerHTML = '';
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:100px 1fr;gap:12px;padding:20px;align-items:start;';

            // Key Row
            const keyLbl = document.createElement('div');
            keyLbl.style.fontSize = '0.85rem';
            keyLbl.style.paddingTop = '6px';
            keyLbl.textContent = 'API Key:';

            const keyInputWrap = document.createElement('div');
            keyInputWrap.style.display = 'flex';
            keyInputWrap.style.flexDirection = 'column';
            keyInputWrap.style.gap = '6px';

            const keyInput = document.createElement('input');
            keyInput.type = 'password';
            keyInput.className = 'gos-w32-input';
            keyInput.value = localStorage.getItem('gos_assistant_api_key') || '';
            keyInput.placeholder = 'Paste key here...';

            const hint = document.createElement('div');
            hint.style.cssText = 'font-size:0.75rem;color:#888;';
            hint.innerHTML = 'Don\'t have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent-color);">Get one for free at Google AI Studio</a>.';

            keyInputWrap.append(keyInput, hint);
            grid.append(keyLbl, keyInputWrap);

            // Model Row
            const modelLbl = document.createElement('div');
            modelLbl.style.fontSize = '0.85rem';
            modelLbl.style.paddingTop = '6px';
            modelLbl.textContent = 'Model:';

            const modelInputWrap = document.createElement('div');
            modelInputWrap.style.display = 'flex';
            modelInputWrap.style.flexDirection = 'column';
            modelInputWrap.style.gap = '6px';

            const modelSelect = document.createElement('select');
            modelSelect.className = 'gos-w32-input';
            modelSelect.style.cssText = 'background:#111;color:#fff;border:1px solid #444;padding:4px;';

            const statusText = document.createElement('div');
            statusText.style.cssText = 'font-size:0.7rem;color:#888;min-height:1em;';

            modelInputWrap.append(modelSelect, statusText);
            grid.append(modelLbl, modelInputWrap);

            tabContent.appendChild(grid);

            // Helpers
            const cur = registry.get('Software.GlitterOS.Assistant.Model', 'gemini-2.0-flash');

            const updateVisibility = () => {
                const hasKey = keyInput.value.trim().length >= 10;
                hint.style.display = hasKey ? 'none' : 'block';
                modelLbl.style.display = hasKey ? 'block' : 'none';
                modelInputWrap.style.display = hasKey ? 'flex' : 'none';
            };

            async function updateModels(key) {
                updateVisibility();
                if (key.length < 10) return;
                statusText.textContent = 'Fetching models...';
                try {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                    const data = await res.json();
                    if (data.models) {
                        modelSelect.innerHTML = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'))
                            .map(m => `<option value="${m.name.split('/').pop()}" ${m.name.endsWith(cur) || (m.name.split('/').pop() === cur) ? 'selected' : ''}>${m.displayName}</option>`).join('');
                        statusText.textContent = '';
                    } else if (data.error) {
                        statusText.textContent = 'Invalid API key';
                        statusText.style.color = '#f44336';
                    }
                } catch (e) {
                    statusText.textContent = 'Network error';
                    statusText.style.color = '#f44336';
                }
            }

            keyInput.oninput = () => updateModels(keyInput.value.trim());
            updateModels(keyInput.value.trim());
            updateVisibility();

            // Save values closure
            dlgContainer._save = () => {
                const k = keyInput.value.trim();
                if (k) localStorage.setItem('gos_assistant_api_key', k);
                else localStorage.removeItem('gos_assistant_api_key');
                registry.set('Software.GlitterOS.Assistant.Model', modelSelect.value);
            };
        }

        tabs.forEach(tab => {
            const el = document.createElement('div');
            el.className = 'gos-tab' + (tab.id === activeTab ? ' active' : '');
            el.textContent = tab.label;
            el.onclick = () => {
                activeTab = tab.id;
                header.querySelectorAll('.gos-tab').forEach(t => t.classList.toggle('active', t === el));
                if (tab.id === 'general') renderGeneral();
            };
            header.appendChild(el);
        });

        const footer = document.createElement('div');
        footer.className = 'gos-messagebox-buttons';
        footer.style.padding = '10px';
        footer.style.borderTop = '1px solid #333';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'gos-msg-btn default';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => {
            if (dlgContainer._save) dlgContainer._save();
            wm.closeWindow(prefWin.id);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gos-msg-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => wm.closeWindow(prefWin.id);

        footer.append(saveBtn, cancelBtn);

        dlgContainer.append(header, tabContent, footer);
        renderGeneral();

        const prefWin = wm.createWindow('Assistant Preferences', dlgContainer, {
            width: 480, height: 320, noResize: true, icon: 'bi-gear-fill'
        });
        prefWin.element.classList.add('gos-window-messagebox');
    }

    inputArea.oninput = () => {
        sendBtn.disabled = !inputArea.value.trim();
        sendBtn.classList.toggle('disabled', sendBtn.disabled);
        inputArea.style.height = 'auto';
        inputArea.style.height = inputArea.scrollHeight + 'px';
    };

    inputArea.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    const win = wm.createWindow('Assistant', container, { icon: 'ri-sparkling-fill', width: 800, height: 600, appId: 'assistant' });
    win.preferencesProvider = openPreferences;
    win.appMenu = [
        { label: 'Clear History', action: () => clearAllHistory() }
    ];
    wm.updateMenubarLabel();

    if (_threads.length > 0) {
        _activeThreadId = _threads[0].id;
    } else {
        createNewThread();
    }

    renderHistory(); renderMessages();
}

AppRegistry.register({ id: 'assistant', name: 'Assistant', exe: 'assistant.exe', icon: 'ri-sparkling-fill', launch: launchAssistant, desktopShortcut: true });
