// ── glitterOS System Log Viewer ─────────────────────────────────────────────

function launchSysLog() {
    const container = document.createElement('div');
    container.className = 'gos-syslog-app';
    container.style.cssText = 'display: flex; flex-direction: column; height: 100%; background: #111; color: #fff; font-family: var(--font-family-mono); font-size: 0.85rem;';

    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; background: #222; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;';

    const titleArea = document.createElement('div');
    titleArea.innerHTML = `<i class="bi bi-journal-code" style="margin-right:8px; color: var(--accent-color);"></i>System Log`;

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Log';
    clearBtn.className = 'gos-msg-btn';
    clearBtn.style.padding = '4px 10px';
    clearBtn.onclick = () => {
        SysLog.logs.length = 0;
        renderLogs();
    };

    header.append(titleArea, clearBtn);

    const logList = document.createElement('div');
    logList.className = 'gos-syslog-list';
    logList.style.cssText = 'flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 4px;';

    const getSevColor = (sev) => {
        switch (sev) {
            case 'info': return '#3498db';
            case 'warn': return '#f39c12';
            case 'error': return '#e74c3c';
            case 'debug': return '#95a5a6';
            default: return '#fff';
        }
    };

    function renderLogs() {
        logList.innerHTML = '';
        if (SysLog.logs.length === 0) {
            logList.innerHTML = `<div style="color: #666; font-style: italic;">No logs available.</div>`;
            return;
        }

        const frag = document.createDocumentFragment();
        SysLog.logs.forEach(log => {
            const entry = document.createElement('div');
            entry.style.cssText = 'display: flex; gap: 10px; word-break: break-all;';
            const timeStr = `<span style="color: #666; flex-shrink: 0;">[${log.timestamp}]</span>`;
            const sevStr = `<span style="color: ${getSevColor(log.severity)}; width: 50px; flex-shrink: 0; font-weight: bold; text-transform: uppercase;">${log.severity}</span>`;
            const msgStr = `<span style="color: #ddd;">${log.message}</span>`;

            entry.innerHTML = `${timeStr} ${sevStr} ${msgStr}`;
            frag.appendChild(entry);
        });
        logList.appendChild(frag);
        logList.scrollTop = logList.scrollHeight; // auto-scroll to bottom
    }

    const unsubs = SysLog.subscribe((entry) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; gap: 10px; word-break: break-all;';
        const timeStr = `<span style="color: #666; flex-shrink: 0;">[${entry.timestamp}]</span>`;
        const sevStr = `<span style="color: ${getSevColor(entry.severity)}; width: 50px; flex-shrink: 0; font-weight: bold; text-transform: uppercase;">${entry.severity}</span>`;
        const msgStr = `<span style="color: #ddd;">${entry.message}</span>`;

        item.innerHTML = `${timeStr} ${sevStr} ${msgStr}`;
        logList.appendChild(item);
        logList.scrollTop = logList.scrollHeight;
    });

    renderLogs();

    container.append(header, logList);

    wm.createWindow('System Log', container, {
        width: 600,
        height: 400,
        icon: 'bi-journal-code',
        onClose: () => {
            SysLog.unsubscribe(unsubs);
        }
    });
}

AppRegistry.register({
    id: 'syslog',
    name: 'System Log',
    exe: 'syslog.exe',
    icon: 'bi-journal-code',
    launch: launchSysLog,
    desktopShortcut: true
});
