/**
 * glitterOS Control Panel
 */

const STOCK_WALLPAPERS = [
    { name: 'Mountain Lake', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Starry Night', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Cyberpunk City', url: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=2055&auto=format&fit=crop' },
    { name: 'Abstract Flow', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2070&auto=format&fit=crop' },
    { name: 'Foggy Forest', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2071&auto=format&fit=crop' },
    { name: 'Desert Dunes', url: 'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?q=80&w=2070&auto=format&fit=crop' }
];

function launchControlPanel() {
    const container = document.createElement('div');
    container.className = 'gos-cp';

    const body = document.createElement('div');
    body.className = 'gos-cp-body';

    const sidebar = document.createElement('div');
    sidebar.className = 'gos-cp-sidebar';

    const highlighter = document.createElement('div');
    highlighter.className = 'gos-cp-sidebar-highlighter';
    sidebar.appendChild(highlighter);

    const mainContent = document.createElement('div');
    mainContent.className = 'gos-cp-content';

    const navItems = [
        { id: 'personalization', label: 'Background', icon: 'ri-image-line' },
        { id: 'appearance', label: 'Appearance', icon: 'ri-palette-line' },
        { id: 'windowmgmt', label: 'Window Management', icon: 'ri-window-line' },
        { id: 'system', label: 'System', icon: 'ri-computer-line' },
        { id: 'apps', label: 'Applications', icon: 'ri-apps-line' },
        { id: 'privacy', label: 'Privacy & Security', icon: 'ri-shield-keyhole-line' }
    ];

    let currentSection = 'personalization';

    function renderSection(id) {
        mainContent.innerHTML = '';
        currentSection = id;

        // Trigger entry animation
        mainContent.classList.remove('animate-in');
        void mainContent.offsetWidth; // Force reflow
        mainContent.classList.add('animate-in');

        // Update sidebar UI and move highlighter
        sidebar.querySelectorAll('.gos-cp-nav-item').forEach(item => {
            const isActive = item.dataset.id === id;
            item.classList.toggle('active', isActive);
            if (isActive) {
                highlighter.style.top = item.offsetTop + 'px';
                highlighter.style.height = item.offsetHeight + 'px';
            }
        });

        const title = document.createElement('h2');
        title.className = 'gos-cp-section-title';
        title.textContent = navItems.find(n => n.id === id).label;
        mainContent.appendChild(title);

        if (id === 'personalization') {
            // ── Wallpaper Provider Selector ──────────────────────────────
            const providerWrap = document.createElement('div');
            providerWrap.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;';

            const providerLabel = document.createElement('span');
            providerLabel.textContent = 'Wallpaper Source';
            providerLabel.style.cssText = 'font-size:0.85rem;color:#aaa;';

            const providerSelect = document.createElement('select');
            providerSelect.style.cssText = 'background:#2b2b2b;border:1px solid #444;color:#ddd;padding:4px 10px;font-size:0.85rem;font-family:inherit;outline:none;cursor:pointer;';
            providerSelect.innerHTML = `
                <option value="unsplash">Unsplash</option>
                <option value="upload">Upload My Own</option>
            `;
            const savedProvider = registry.get('personalization.wallpaperProvider', 'unsplash');
            providerSelect.value = savedProvider;

            providerWrap.append(providerLabel, providerSelect);
            mainContent.appendChild(providerWrap);

            const wallpaperArea = document.createElement('div');
            mainContent.appendChild(wallpaperArea);

            function renderWallpaperProvider(provider) {
                wallpaperArea.innerHTML = '';
                registry.set('personalization.wallpaperProvider', provider);

                if (provider === 'unsplash') {
                    const grid = document.createElement('div');
                    grid.className = 'gos-cp-wallpaper-grid';

                    STOCK_WALLPAPERS.forEach((wall, idx) => {
                        const thumb = document.createElement('div');
                        thumb.className = 'gos-cp-wallpaper-thumb';
                        thumb.style.backgroundImage = `url("${wall.url}")`;
                        thumb.title = wall.name;

                        Widgets.registerTileEffect(thumb);

                        thumb.onclick = () => {
                            grid.querySelectorAll('.gos-cp-wallpaper-thumb').forEach(t => t.classList.remove('active'));
                            thumb.classList.add('active');
                            setWallpaper(wall.url);
                        };

                        const img = new Image();
                        img.src = wall.url;
                        img.onload = () => {
                            setTimeout(() => thumb.classList.add('loaded'), idx * 20);
                        };

                        grid.appendChild(thumb);
                    });

                    wallpaperArea.appendChild(grid);
                } else if (provider === 'upload') {
                    renderUploadProvider(wallpaperArea);
                }
            }

            function renderUploadProvider(parent) {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

                // Show current custom wallpaper if saved
                const savedCustom = registry.get('personalization.customWallpaper', null);
                if (savedCustom) {
                    const preview = document.createElement('div');
                    preview.style.cssText = `
                        width:100%;height:160px;background-image:url("${savedCustom}");
                        background-size:cover;background-position:center;
                        border:1px solid #3a3a3a;position:relative;overflow:hidden;
                    `;
                    const previewLabel = document.createElement('div');
                    previewLabel.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:6px 10px;background:rgba(0,0,0,0.6);font-size:0.75rem;color:#aaa;';
                    previewLabel.textContent = 'Current custom wallpaper';
                    preview.appendChild(previewLabel);
                    wrap.appendChild(preview);
                }

                // Upload button
                const uploadBtn = document.createElement('div');
                uploadBtn.style.cssText = `
                    display:flex;align-items:center;justify-content:center;gap:10px;
                    padding:20px;background:#252525;border:1px solid #3a3a3a;
                    cursor:pointer;font-size:0.9rem;color:#ccc;position:relative;overflow:hidden;
                `;
                uploadBtn.innerHTML = '<i class="ri-upload-cloud-2-line" style="font-size:1.4rem;color:var(--accent-color);"></i> Upload image...';
                Widgets.registerTileEffect(uploadBtn, { tilt: true, ripple: true, glow: true, liveTilt: true });

                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';

                uploadBtn.onclick = () => fileInput.click();

                fileInput.onchange = () => {
                    const file = fileInput.files[0];
                    if (!file) return;

                    // Show processing state
                    uploadBtn.innerHTML = '<i class="ri-loader-4-line" style="font-size:1.4rem;color:var(--accent-color);animation:spin 1s linear infinite;"></i> Processing...';

                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                            // Compress and resize
                            const canvas = document.createElement('canvas');
                            const MAX_DIM = 1920;
                            let w = img.width, h = img.height;
                            if (w > MAX_DIM || h > MAX_DIM) {
                                if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
                                else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
                            }
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, w, h);

                            // Encode as JPEG for smaller size
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

                            // Save to LocalStorage
                            try {
                                registry.set('personalization.customWallpaper', dataUrl);
                                setWallpaper(dataUrl);
                                // Re-render to show preview
                                renderWallpaperProvider('upload');
                            } catch (e) {
                                wm.messageBox('Upload Failed', 'The image is too large to store. Try a smaller image.', {
                                    buttons: 'ok',
                                    icon: 'bi-x-circle-fill'
                                });
                                uploadBtn.innerHTML = '<i class="ri-upload-cloud-2-line" style="font-size:1.4rem;color:var(--accent-color);"></i> Upload image...';
                            }
                        };
                        img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                };

                wrap.append(uploadBtn, fileInput);

                // Remove custom wallpaper button if one exists
                if (savedCustom) {
                    const removeBtn = document.createElement('div');
                    removeBtn.style.cssText = 'padding:8px 16px;background:#333;border:1px solid #444;cursor:pointer;font-size:0.85rem;color:#f44336;text-align:center;';
                    removeBtn.textContent = 'Remove custom wallpaper';
                    removeBtn.onmouseenter = () => removeBtn.style.backgroundColor = '#444';
                    removeBtn.onmouseleave = () => removeBtn.style.backgroundColor = '#333';
                    removeBtn.onclick = () => {
                        registry.set('personalization.customWallpaper', null);
                        setWallpaper('res/wall.png');
                        renderWallpaperProvider('upload');
                    };
                    wrap.appendChild(removeBtn);
                }

                parent.appendChild(wrap);
            }

            providerSelect.onchange = () => renderWallpaperProvider(providerSelect.value);
            renderWallpaperProvider(savedProvider);
        } else if (id === 'system') {
            const card = document.createElement('div');
            card.style.cssText = 'background:#252525;border:1px solid #3a3a3a;padding:20px;margin-top:8px;';

            // Gather browser stats
            const ua = navigator.userAgent;
            let browserName = 'Unknown';
            let browserVer = '';
            if (ua.includes('Firefox/')) { browserName = 'Mozilla Firefox'; browserVer = ua.match(/Firefox\/([\d.]+)/)?.[1] || ''; }
            else if (ua.includes('Edg/')) { browserName = 'Microsoft Edge'; browserVer = ua.match(/Edg\/([\d.]+)/)?.[1] || ''; }
            else if (ua.includes('Chrome/')) { browserName = 'Google Chrome'; browserVer = ua.match(/Chrome\/([\d.]+)/)?.[1] || ''; }
            else if (ua.includes('Safari/')) { browserName = 'Apple Safari'; browserVer = ua.match(/Version\/([\d.]+)/)?.[1] || ''; }

            let osName = 'Unknown OS';
            if (ua.includes('Windows')) osName = 'Windows';
            else if (ua.includes('Mac OS')) osName = 'macOS';
            else if (ua.includes('Linux')) osName = 'Linux';
            else if (ua.includes('Android')) osName = 'Android';
            else if (ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS';

            const stats = [
                { label: 'Device Name', value: 'glitterOS Desktop' },
                { label: 'Operating System', value: osName },
                { label: 'Browser', value: `${browserName} ${browserVer}` },
                { label: 'Processor Cores', value: navigator.hardwareConcurrency || 'N/A' },
                { label: 'Device Memory', value: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'N/A' },
                { label: 'Screen Resolution', value: `${screen.width} × ${screen.height}` },
                { label: 'Color Depth', value: screen.colorDepth + '-bit' },
                { label: 'Language', value: navigator.language },
                { label: 'Timezone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
                { label: 'Connection', value: navigator.connection ? navigator.connection.effectiveType.toUpperCase() : 'N/A' },
                { label: 'Online', value: navigator.onLine ? 'Yes' : 'No' },
            ];

            // Header
            const sysHeader = document.createElement('div');
            sysHeader.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #3a3a3a;';
            sysHeader.innerHTML = `
                <i class="ri-computer-line" style="font-size:2.5rem;color:var(--accent-color);"></i>
                <div>
                    <div style="font-size:1.1rem;font-weight:600;">glitterOS</div>
                    <div style="font-size:0.8rem;color:#888;">Version 4.2.0.6969</div>
                </div>
            `;
            card.appendChild(sysHeader);

            // Stats table
            const table = document.createElement('div');
            table.style.cssText = 'display:grid;grid-template-columns:160px 1fr;gap:0;font-size:0.85rem;';
            stats.forEach(({ label, value }) => {
                const lbl = document.createElement('div');
                lbl.style.cssText = 'padding:6px 0;color:#888;';
                lbl.textContent = label;
                const val = document.createElement('div');
                val.style.cssText = 'padding:6px 0;color:#ccc;';
                val.textContent = value;
                table.append(lbl, val);
            });
            card.appendChild(table);

            mainContent.appendChild(card);
        } else if (id === 'appearance') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

            const splashCheck = Widgets.createUWPCheckbox('Show application splash screens',
                registry.get('personalization.showSplash', true),
                (checked) => {
                    registry.set('personalization.showSplash', checked);
                }
            );

            wrap.append(splashCheck);
            mainContent.appendChild(wrap);
        } else if (id === 'windowmgmt') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

            const snappingCheck = Widgets.createUWPCheckbox('Enable window snapping',
                registry.get('system.windowSnapping', true),
                (checked) => {
                    registry.set('system.windowSnapping', checked);
                }
            );

            wrap.append(snappingCheck);
            mainContent.appendChild(wrap);
        } else if (id === 'apps') {
            renderAppsList(mainContent);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'text-center mt-5 text-secondary';
            placeholder.innerHTML = `<i class="ri-tools-line display-1 opacity-25"></i><p class="mt-3">This section is currently under development.</p>`;
            mainContent.appendChild(placeholder);
        }
    }

    // ── Applications List ─────────────────────────────────────────────────────
    function renderAppsList(parent) {
        const apps = AppRegistry.getAll();
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'margin-top:8px;border:1px solid #3a3a3a;background:#1a1a1a;';

        // Table header
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:grid;grid-template-columns:1fr 100px 100px;padding:8px 12px;background:#2b2b2b;border-bottom:1px solid #444;font-size:0.8rem;color:#888;font-weight:500;';
        headerRow.innerHTML = '<div>Name</div><div>Type</div><div>Size</div>';
        listContainer.appendChild(headerRow);

        apps.forEach(app => {
            const row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:1fr 100px 100px;padding:6px 12px;border-bottom:1px solid #2a2a2a;font-size:0.85rem;cursor:default;align-items:center;position:relative;';
            row.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <i class="${getFullIcon(app.icon)}" style="font-size:1.1rem;color:#ccc;"></i>
                    <span style="color:#ddd;">${app.name}</span>
                </div>
                <div style="color:#888;">Application</div>
                <div style="color:#888;">${(Math.random() * 5 + 0.5).toFixed(1)} MB</div>
            `;

            row.addEventListener('mouseenter', () => row.style.backgroundColor = 'rgba(255,255,255,0.05)');
            row.addEventListener('mouseleave', () => row.style.backgroundColor = '');

            // Right-click context menu
            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showAppContextMenu(e.clientX, e.clientY, app, parent);
            });

            // Double click to open
            row.addEventListener('dblclick', () => app.launch());

            listContainer.appendChild(row);
        });

        if (apps.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:20px;text-align:center;color:#666;font-size:0.85rem;';
            empty.textContent = 'No applications installed.';
            listContainer.appendChild(empty);
        }

        parent.appendChild(listContainer);
    }

    // ── App Context Menu ──────────────────────────────────────────────────────
    let _appCtxMenu = null;
    function showAppContextMenu(x, y, app, parent) {
        gosShowContextMenu(x, y, [
            { label: 'Open', action: () => app.launch() },
            { type: 'sep' },
            {
                label: 'Uninstall',
                color: 'danger',
                action: () => {
                    wm.messageBox('Uninstall Application', `"${app.name}" will be uninstalled. Continue?`, {
                        buttons: 'yesno',
                        icon: 'bi-exclamation-triangle-fill',
                        onYes: () => {
                            AppRegistry.unregister(app.id);
                            gosInitDesktopIcons();
                            if (typeof refreshSearchAppList === 'function') refreshSearchAppList();
                            renderSection('apps');
                        }
                    });
                }
            }
        ]);
    }

    navItems.forEach(nav => {
        const item = document.createElement('div');
        item.className = 'gos-cp-nav-item';
        item.dataset.id = nav.id;
        item.innerHTML = `<i class="${nav.icon}"></i><span>${nav.label}</span>`;

        // Add tilt/ripple to sidebar items too (tile styling)
        Widgets.registerTileEffect(item);

        item.onclick = () => renderSection(nav.id);
        sidebar.appendChild(item);
    });

    body.append(sidebar, mainContent);
    container.appendChild(body);

    wm.createWindow('Control Panel', container, {
        width: 750,
        height: 500,
        icon: 'ri-settings-3-line'
    });

    renderSection('personalization');
}

AppRegistry.register({
    id: 'controlpanel',
    name: 'Control Panel',
    exe: 'control.exe',
    icon: 'ri-settings-3-line',
    launch: () => launchControlPanel(),
    desktopShortcut: true
});
