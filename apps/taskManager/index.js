// ── Task Manager — Windows 10 Dark Edition ──────────────────────────────────────

function launchTaskManager() {
    const container = document.createElement('div');
    container.className = 'gos-taskmgr';

    // ── State ─────────────────────────────────────────────────────────────────
    let _activeTab = 'processes';
    let _selectedIds = [];
    let _perfData = {
        cpu: Array(60).fill(0),
        mem: Array(60).fill(0)
    };
    let _perfInterval = null;

    // ── Components ────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'gos-tab-strip';

    const tabs = [
        { id: 'processes', label: 'Processes' },
        { id: 'performance', label: 'Performance' },
        { id: 'details', label: 'Details' }
    ];

    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'gos-tab' + (tab.id === _activeTab ? ' active' : '');
        el.innerText = tab.label;
        el.onclick = () => switchTab(tab.id);
        header.appendChild(el);
    });

    const content = document.createElement('div');
    content.className = 'gos-taskmgr-content';

    const footer = document.createElement('div');
    footer.className = 'gos-taskmgr-footer';

    const killAllBtn = document.createElement('button');
    killAllBtn.className = 'gos-taskmgr-btn';
    killAllBtn.innerText = 'Kill all';
    killAllBtn.onclick = () => {
        wm.messageBox('Task Manager', 'Are you sure you want to end all processes?\nAll unsaved work will be lost.', {
            buttons: 'yesno',
            icon: 'bi-exclamation-triangle-fill',
            onYes: () => {
                const allWins = [...wm.windows];
                allWins.forEach(w => {
                    if (w.id !== win.id) wm.closeWindow(w.id);
                });
                if (typeof ServiceManager !== 'undefined') {
                    ServiceManager.list().forEach(svc => {
                        if (svc.running) ServiceManager.kill(svc.id);
                    });
                }
                _selectedIds = [];
                updateViews();
            }
        });
    };

    const endTaskBtn = document.createElement('button');
    endTaskBtn.className = 'gos-taskmgr-btn';
    endTaskBtn.innerText = 'End task';
    endTaskBtn.disabled = true;
    endTaskBtn.onclick = () => {
        if (_selectedIds.length > 0) {
            _selectedIds.forEach(id => terminateTaskById(id));
            _selectedIds = [];
            updateViews();
        }
    };
    footer.append(killAllBtn, endTaskBtn);

    container.append(header, content, footer);

    // ── Tab Switching ─────────────────────────────────────────────────────────
    function switchTab(id) {
        _activeTab = id;
        header.querySelectorAll('.gos-tab').forEach(t => {
            t.classList.toggle('active', t.innerText.toLowerCase() === id);
        });
        updateViews();

        if (id === 'performance') {
            startPerfMonitoring();
        } else {
            stopPerfMonitoring();
        }
    }

    // Listen for window changes to update lists
    function terminateTaskById(id) {
        const winObj = wm.windows.find(w => w.id === id);
        if (winObj) {
            wm.closeWindow(id);
            return;
        }
        if (typeof ServiceManager !== 'undefined') {
            const svc = ServiceManager.list().find(s => s.pid === id);
            if (svc && svc.running) ServiceManager.kill(svc.id);
        }
    }

    const winChangeListener = () => {
        if (_activeTab === 'processes' || _activeTab === 'details') {
            updateViews();
        }
    };
    window.addEventListener('gos-window-changed', winChangeListener);
    window.addEventListener('gos-service-changed', winChangeListener);

    // ── Views ─────────────────────────────────────────────────────────────────
    function updateViews() {
        // Save selection if possible
        const prevIds = [..._selectedIds];

        content.innerHTML = '';
        const view = document.createElement('div');
        view.className = 'gos-taskmgr-view active';

        if (_activeTab === 'processes' || _activeTab === 'details') {
            renderProcessTable(view, _activeTab === 'details');
        } else if (_activeTab === 'performance') {
            renderPerformance(view);
        } else {
            view.innerHTML = `<div class="p-4 text-secondary">Tab "${_activeTab}" is not implemented yet.</div>`;
        }

        content.appendChild(view);

        // Restore selection
        _selectedIds = prevIds.filter(id => {
            if (wm.windows.some(w => w.id === id)) return true;
            if (typeof ServiceManager === 'undefined') return false;
            return ServiceManager.list().some(s => s.pid === id);
        });
        endTaskBtn.disabled = _selectedIds.length === 0;
    }

    // ── Task context menu ──────────────────────────────────────────────────────
    let _taskCtxMenu = null;
    let _taskCtxListener = null;

    function closeTaskContextMenu() {
        if (_taskCtxMenu) {
            _taskCtxMenu.remove();
            _taskCtxMenu = null;
        }
        if (_taskCtxListener) {
            window.removeEventListener('mousedown', _taskCtxListener, true);
            _taskCtxListener = null;
        }
    }

    function showTaskContextMenu(x, y, row) {
        closeTaskContextMenu();

        _taskCtxMenu = document.createElement('div');
        _taskCtxMenu.style.cssText = `
            position:fixed;left:${x}px;top:${y}px;z-index:99999;
            background:#2b2b2b;border:1px solid #444;min-width:160px;padding:2px;
            box-shadow:2px 2px 8px rgba(0,0,0,0.45);font-size:0.85rem;
        `;

        const closeItem = document.createElement('div');
        closeItem.style.cssText = 'padding:6px 20px;color:#f44336;cursor:pointer;';
        closeItem.textContent = row.kind === 'service' ? 'Stop Service' : 'Close';
        closeItem.onmouseenter = () => closeItem.style.backgroundColor = '#3f3f3f';
        closeItem.onmouseleave = () => closeItem.style.backgroundColor = '';
        closeItem.onclick = () => {
            closeTaskContextMenu();
            if (!_selectedIds.includes(row.id)) {
                _selectedIds = [row.id];
            }
            _selectedIds.forEach(id => terminateTaskById(id));
            _selectedIds = [];
            updateViews();
        };

        if (row.kind === 'window') {
            const focusItem = document.createElement('div');
            focusItem.style.cssText = 'padding:6px 20px;color:#eee;cursor:pointer;';
            focusItem.textContent = 'Focus Window';
            focusItem.onmouseenter = () => focusItem.style.backgroundColor = '#3f3f3f';
            focusItem.onmouseleave = () => focusItem.style.backgroundColor = '';
            focusItem.onclick = () => { closeTaskContextMenu(); wm.focusWindow(row.id); };
            const divider = document.createElement('hr');
            divider.style.cssText = 'margin:2px 0;border-color:#444;';
            _taskCtxMenu.append(focusItem, divider, closeItem);
        } else {
            if (typeof ServiceManager !== 'undefined') {
                const svc = ServiceManager.get(row.serviceId);
                const startRestart = document.createElement('div');
                startRestart.style.cssText = 'padding:6px 20px;color:#9ee2ff;cursor:pointer;';
                startRestart.textContent = svc && svc.running ? 'Restart Service' : 'Start Service';
                startRestart.onmouseenter = () => startRestart.style.backgroundColor = '#3f3f3f';
                startRestart.onmouseleave = () => startRestart.style.backgroundColor = '';
                startRestart.onclick = () => {
                    closeTaskContextMenu();
                    if (svc && svc.running) ServiceManager.restart(row.serviceId);
                    else ServiceManager.start(row.serviceId, { manual: true });
                    updateViews();
                };
                const divider = document.createElement('hr');
                divider.style.cssText = 'margin:2px 0;border-color:#444;';
                _taskCtxMenu.append(startRestart, divider, closeItem);
            } else {
                _taskCtxMenu.append(closeItem);
            }
        }
        document.body.appendChild(_taskCtxMenu);

        _taskCtxListener = (ev) => {
            if (_taskCtxMenu && !_taskCtxMenu.contains(ev.target)) {
                closeTaskContextMenu();
            }
        };
        setTimeout(() => window.addEventListener('mousedown', _taskCtxListener, true), 10);
    }

    function renderProcessTable(parent, isDetails) {
        const wins = wm.windows;
        const services = typeof ServiceManager !== 'undefined' ? ServiceManager.list() : [];

        let cols = [];
        if (isDetails) {
            cols = [
                { id: 'name', label: 'Name', width: '30%', render: (val, row) => `<i class="${getFullIcon(row.icon)}"></i> ${val}` },
                { id: 'pid', label: 'PID', width: '10%' },
                { id: 'status', label: 'Status', width: '15%' },
                { id: 'user', label: 'User name', width: '15%' },
                { id: 'cpu', label: 'CPU', width: '15%', sortValue: row => row._cpuRaw },
                { id: 'mem', label: 'Memory', width: '15%', sortValue: row => row._memRaw }
            ];
        } else {
            cols = [
                { id: 'name', label: 'Name', width: '40%', render: (val, row) => `<i class="${getFullIcon(row.icon)}"></i> ${val}` },
                { id: 'status', label: 'Status', width: '20%' },
                { id: 'cpu', label: 'CPU', width: '20%', sortValue: row => row._cpuRaw },
                { id: 'mem', label: 'Memory', width: '20%', sortValue: row => row._memRaw }
            ];
        }

        const winData = wins.map(winItem => {
            const status = winItem.element.classList.contains('minimized') ? 'Minimized' : 'Running';
            const winCount = wins.length;
            const baseCpu = Math.max(1, Math.floor(Math.random() * (3 + winCount * 0.8)));
            const cpuStr = baseCpu + '%';
            const baseMem = Math.floor(12 + Math.random() * 25 + winCount * 3.5);
            const memStr = baseMem + ' MB';

            return {
                kind: 'window',
                id: winItem.id,
                serviceId: null,
                name: winItem.title,
                icon: winItem.icon,
                pid: winItem.id.split('-')[1],
                status: status,
                user: 'User',
                cpu: cpuStr,
                mem: memStr,
                _cpuRaw: baseCpu,
                _memRaw: baseMem
            };
        });

        const svcData = services.map((svc, idx) => {
            const running = svc.running && !svc.disabled;
            const status = svc.disabled ? 'Disabled' : (running ? 'Running' : 'Stopped');
            const cpuRaw = running ? 1 + (idx % 2) : 0;
            const memRaw = running ? 8 + (idx % 4) * 2 : 0;
            return {
                kind: 'service',
                id: svc.pid,
                serviceId: svc.id,
                name: svc.name,
                icon: 'ri-settings-3-line',
                pid: svc.pid,
                status: status,
                user: 'SYSTEM',
                cpu: `${cpuRaw}%`,
                mem: `${memRaw} MB`,
                _cpuRaw: cpuRaw,
                _memRaw: memRaw
            };
        });

        const data = [...winData, ...svcData];

        const tbl = Widgets.createTable({
            columns: cols,
            data: data,
            keyField: 'id',
            onSelectionChange: (selectedIds) => {
                _selectedIds = selectedIds;
                endTaskBtn.disabled = _selectedIds.length === 0;
            },
            onAction: (id, row) => {
                if (row.kind === 'window') wm.focusWindow(id);
                if (row.kind === 'service' && typeof ServiceManager !== 'undefined') {
                    const svc = ServiceManager.get(row.serviceId);
                    if (svc && (!svc.running || svc.disabled)) {
                        ServiceManager.start(row.serviceId, { manual: true });
                        updateViews();
                    }
                }
            },
            onContextMenu: (id, row, e) => {
                if (!_selectedIds.includes(id)) {
                    _selectedIds = [id];
                    endTaskBtn.disabled = false;
                    updateViews();
                }
                showTaskContextMenu(e.clientX, e.clientY, row);
            }
        });

        // Set initial selection visually if already set
        if (_selectedIds.length > 0) {
            tbl.element.querySelectorAll('tbody tr').forEach((tr, i) => {
                if (_selectedIds.includes(data[i].id)) tr.classList.add('selected');
            });
        }

        parent.appendChild(tbl.element);
    }

    // ── CPU Name Detection ─────────────────────────────────────────────────────
    const _cpuName = (() => {
        // Try to get real CPU info from navigator
        if (navigator.userAgentData && navigator.userAgentData.platform) {
            // Some browsers expose architecture
        }
        // Parse from userAgent for hints
        const ua = navigator.userAgent;
        if (/Intel/.test(ua)) return 'Intel Core i7-12700K';
        if (/AMD/.test(ua)) return 'AMD Ryzen 7 5800X';
        if (/ARM|aarch64/.test(ua)) return 'ARM Cortex-A78';
        // Fallback: navigator.hardwareConcurrency gives logical core count
        const cores = navigator.hardwareConcurrency || 4;
        if (cores >= 16) return 'Intel Core i9-13900K';
        if (cores >= 8) return 'Intel Core i7-12700K';
        if (cores >= 4) return 'AMD Ryzen 5 5600X';
        return 'Intel Core i5-10400';
    })();
    const _cpuCores = navigator.hardwareConcurrency || 4;
    const _cpuBaseGhz = 3.2 + Math.random() * 0.8; // Fake base clock

    let _perfView = 'cpu'; // 'cpu' or 'memory'
    function renderPerformance(parent) {
        const layout = document.createElement('div');
        layout.className = 'gos-taskmgr-perf-layout';

        const sidebar = document.createElement('div');
        sidebar.className = 'gos-taskmgr-perf-sidebar';

        const totalMemGB = navigator.deviceMemory || 8;
        const currentCpuPct = Math.floor(_perfData.cpu[_perfData.cpu.length - 1]);
        const currentMemPct = Math.floor(_perfData.mem[_perfData.mem.length - 1]);

        const cpuItem = createPerfSidebarItem('CPU', currentCpuPct + '%');
        const memItem = createPerfSidebarItem('Memory',
            ((_perfData.mem[_perfData.mem.length - 1] / 100) * totalMemGB).toFixed(1) + '/' + totalMemGB + ' GB (' + currentMemPct + '%)'
        );

        cpuItem.classList.toggle('active', _perfView === 'cpu');
        memItem.classList.toggle('active', _perfView === 'memory');

        cpuItem.onclick = () => { _perfView = 'cpu'; updateViews(); };
        memItem.onclick = () => { _perfView = 'memory'; updateViews(); };

        Widgets.registerTileEffect(cpuItem, { tilt: true, ripple: true, glow: true, liveTilt: true });
        Widgets.registerTileEffect(memItem, { tilt: true, ripple: true, glow: true, liveTilt: true });

        sidebar.append(cpuItem, memItem);

        const main = document.createElement('div');
        main.className = 'gos-taskmgr-perf-main';

        const graphHeader = document.createElement('div');
        graphHeader.className = 'gos-taskmgr-graph-header';

        const currentData = _perfView === 'cpu' ? _perfData.cpu : _perfData.mem;
        const currentVal = Math.floor(currentData[currentData.length - 1]);

        // Fake GHz: scale with current CPU usage
        const currentGhz = (_cpuBaseGhz * (0.3 + (currentCpuPct / 100) * 0.7)).toFixed(2);

        if (_perfView === 'cpu') {
            graphHeader.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <div class="gos-taskmgr-graph-title" style="font-weight:300;">${_cpuName}</div>
                    <div style="font-size:0.7rem;color:#888;">${_cpuCores} Logical processors</div>
                </div>
                <div style="text-align:right;">
                    <div class="gos-taskmgr-graph-value" id="perf-val">${currentVal}%</div>
                    <div style="font-size:0.7rem;color:#888;">${currentGhz} GHz</div>
                </div>
            `;
        } else {
            const usedGB = ((_perfData.mem[_perfData.mem.length - 1] / 100) * totalMemGB).toFixed(1);
            graphHeader.innerHTML = `
                <div class="gos-taskmgr-graph-title" style="font-weight:300;">MEMORY</div>
                <div style="text-align:right;">
                    <div class="gos-taskmgr-graph-value" id="perf-val">${usedGB}/${totalMemGB} GB</div>
                    <div style="font-size:0.7rem;color:#888;">${currentVal}% in use</div>
                </div>
            `;
        }

        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'gos-taskmgr-graph-container';
        const canvas = document.createElement('canvas');
        canvas.className = 'gos-taskmgr-canvas';
        canvasContainer.appendChild(canvas);

        main.append(graphHeader, canvasContainer);
        layout.append(sidebar, main);
        parent.appendChild(layout);

        function draw() {
            if (!canvas.getContext) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvasContainer.offsetWidth * dpr;
            canvas.height = canvasContainer.offsetHeight * dpr;
            ctx.scale(dpr, dpr);

            const displayW = canvasContainer.offsetWidth;
            const displayH = canvasContainer.offsetHeight;
            ctx.clearRect(0, 0, displayW, displayH);

            // Grid
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            for (let i = 1; i < 10; i++) {
                ctx.beginPath();
                ctx.moveTo(0, (displayH / 10) * i); ctx.lineTo(displayW, (displayH / 10) * i); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo((displayW / 10) * i, 0); ctx.lineTo((displayW / 10) * i, displayH); ctx.stroke();
            }

            // Plot
            ctx.strokeStyle = _perfView === 'cpu' ? '#0078d7' : '#8e44ad';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const step = displayW / (currentData.length - 1);
            currentData.forEach((val, i) => {
                const x = i * step;
                const y = displayH - (val / 100) * displayH;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();

            ctx.lineTo(displayW, displayH); ctx.lineTo(0, displayH);
            ctx.fillStyle = _perfView === 'cpu' ? 'rgba(0, 120, 215, 0.1)' : 'rgba(142, 68, 173, 0.1)';
            ctx.fill();
        }

        win.onResize = draw;
        setTimeout(draw, 50);
    }

    function createPerfSidebarItem(title, sub1) {
        const item = document.createElement('div');
        item.className = 'gos-taskmgr-perf-item';
        item.innerHTML = `
            <div class="gos-taskmgr-perf-item-title">${title}</div>
            <div class="gos-taskmgr-perf-item-sub">${sub1}</div>
        `;
        return item;
    }

    function startPerfMonitoring() {
        if (_perfInterval) return;

        const winCount = wm.windows.length;
        // Initial dummy data scaled by window count
        if (_perfData.cpu.every(v => v === 0)) {
            const baseCpu = 5 + winCount * 2;
            const baseMem = 18 + winCount * 3;
            _perfData.cpu = _perfData.cpu.map(() => baseCpu + Math.random() * 8);
            _perfData.mem = _perfData.mem.map(() => baseMem + Math.random() * 4);
        }

        _perfInterval = setInterval(() => {
            const winCount = wm.windows.length;
            // CPU: base influenced by number of windows
            const cpuBias = Math.min(winCount * 2.5, 40);
            const prevCpu = _perfData.cpu[_perfData.cpu.length - 1];
            const nextCPU = Math.max(2, Math.min(98, prevCpu + (Math.random() * 10 - 5 + (cpuBias - prevCpu) * 0.05)));

            // Memory: slowly climbs with more windows
            const memBase = 18 + winCount * 3.5;
            const prevMem = _perfData.mem[_perfData.mem.length - 1];
            const nextMEM = Math.max(10, Math.min(95, prevMem + (Math.random() * 2 - 1 + (memBase - prevMem) * 0.08)));

            _perfData.cpu.shift(); _perfData.cpu.push(nextCPU);
            _perfData.mem.shift(); _perfData.mem.push(nextMEM);

            if (_activeTab === 'performance') {
                updateViews();
            }
        }, 1000);
    }

    function stopPerfMonitoring() {
        if (_perfInterval) { clearInterval(_perfInterval); _perfInterval = null; }
    }

    const win = wm.createWindow('Task Manager', container, {
        icon: 'ri-dashboard-line',
        width: 600,
        height: 400,
        appId: 'taskmanager',
        onClose: () => {
            stopPerfMonitoring();
            window.removeEventListener('gos-window-changed', winChangeListener);
            window.removeEventListener('gos-service-changed', winChangeListener);
        }
    });

    switchTab('processes');
}

AppRegistry.register({
    id: 'taskmanager',
    name: 'Task Manager',
    exe: 'taskmgr.exe',
    icon: 'ri-dashboard-line',
    launch: () => launchTaskManager(),
    desktopShortcut: true
});
