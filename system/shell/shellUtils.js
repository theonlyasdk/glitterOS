/**
 * Shell Utilities - Kaboom, About, and System Actions
 */

function kaboom() {
    const kaboomCandidates = [
        SystemState.menubar,
        SystemState.desktop,
        SystemState.taskbar
    ];
    kaboomCandidates.forEach((elem) => {
        if (elem) elem.classList.add("kaboom");
    });
    document.body.classList.add("kaboom-ticking");
    setTimeout(() => {
        document.body.classList.remove("kaboom-ticking");
        document.body.classList.add("kaboom");
        setTimeout(() => location.reload(), 3000);
    }, 5000);
}

function aboutGlitterOS() {
    const container = document.createElement('div');
    container.className = 'gos-about-page';
    container.style.cssText = 'padding:0; margin:0; height:100%; display:flex; flex-direction:column; overflow:hidden; background: #1e1e1e;';

    const headerHtml = `
        <style>
            @keyframes gos-about-zoom {
                from { opacity: 0; transform: scale(0.98); }
                to { opacity: 1; transform: scale(1); }
            }
            .gos-about-pane.active {
                animation: gos-about-zoom 0.3s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
            }
            .gos-about-tab {
                color: #888;
                transition: color 0.2s;
            }
            .gos-about-tab.active {
                color: #fff;
            }
        </style>
        <div class="gos-about-header" style="background: #252525; padding: 15px; display: flex; align-items: center; border-bottom: 1px solid #333;">
            <div class="gos-about-logo" style="font-size: 2.5rem; margin-right: 15px; color: var(--accent-color);">
                <i class="bi-balloon-fill"></i>
            </div>
            <div class="gos-about-title">
                <h1 style="margin:0; font-size: 1.3rem; color: #fff;">glitterOS Beta</h1>
                <p style="margin:0; opacity: 0.8; font-size: 0.9rem;">Version 4.2.9 (Build 2026.02)</p>
            </div>
        </div>
        <div class="gos-about-tabs" style="display: flex; background: #2d2d2d; border-bottom: 1px solid #333; position: relative;">
            <div class="gos-about-tab active" data-tab="about" style="padding: 10px 20px; cursor: pointer; font-size: 0.9rem; position: relative; z-index: 2;">About</div>
            <div class="gos-about-tab" data-tab="smc" style="padding: 10px 20px; cursor: pointer; font-size: 0.9rem; position: relative; z-index: 2;">SMC Docs</div>
            <div class="gos-about-tab-indicator" style="position: absolute; bottom: 0; height: 2px; background: var(--accent-color); transition: left 0.3s cubic-bezier(0.1, 0.9, 0.2, 1), width 0.3s cubic-bezier(0.1, 0.9, 0.2, 1); z-index: 1;"></div>
        </div>
        <div class="gos-about-body" style="flex-grow: 1; overflow: hidden; position: relative; padding: 0 !important;">
            <div class="gos-about-pane active" id="pane-about" style="height: 100%; overflow-y: auto; padding: 0 !important; margin: 0 !important; line-height: 1.6; color: #eee; display: block;">
                <div style="padding: 20px;">
                    <p>glitterOS is a modern, high-performance web-based operating system built for the next generation of computing.</p>
                    
                    <h3 style="color: var(--accent-color); font-size: 1.1rem; margin-top: 20px;">System Information</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>Architecture:</strong> x64 Web-Native</li>
                        <li><strong>Kernel:</strong> glint 2.1-perf-debug</li>
                    </ul>

                    <h3 style="color: var(--accent-color); font-size: 1.1rem; margin-top: 20px;">Legal Information</h3>
                    <p style="font-size: 0.85rem; opacity: 0.7;">
                        &copy; 2026 theonlyasdk. <br>
                        glitterOS is provided "as is" without warranty of any kind.
                    </p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
                        <a href="https://github.com/theonlyasdk/glitterOS" target="_blank" style="color: var(--accent-color); text-decoration: none;">
                            <i class="bi bi-github"></i> View Source Code on GitHub
                        </a>
                    </div>
                </div>
            </div>
            <div class="gos-about-pane" id="pane-smc" style="height: 100%; overflow-y: auto; padding: 0 !important; margin: 0 !important; line-height: 1.6; color: #eee; display: none;">
                <div class="gos-about-loading" style="display: flex; align-items: center; justify-content: center; height: 100%; font-style: italic; opacity: 0.7;">
                    Loading documentation...
                </div>
                <div class="gos-about-smc-content" style="padding: 20px;"></div>
            </div>
        </div>
    `;
    container.innerHTML = headerHtml;

    const tabs = container.querySelectorAll('.gos-about-tab');
    const panes = container.querySelectorAll('.gos-about-pane');
    const indicator = container.querySelector('.gos-about-tab-indicator');
    const smcContent = container.querySelector('.gos-about-smc-content');
    const smcLoading = container.querySelector('.gos-about-loading');

    function updateIndicator(activeTab) {
        indicator.style.left = activeTab.offsetLeft + 'px';
        indicator.style.width = activeTab.offsetWidth + 'px';
    }

    // Initial position
    setTimeout(() => updateIndicator(tabs[0]), 0);

    let smcLoaded = false;

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => {
                p.classList.remove('active');
                p.style.display = 'none';
            });

            tab.classList.add('active');
            updateIndicator(tab);

            const activePane = container.querySelector(`#pane-${target}`);
            if (activePane) {
                activePane.style.display = 'block';
                // Trigger animation
                void activePane.offsetWidth;
                activePane.classList.add('active');
            }

            if (target === 'smc' && !smcLoaded) {
                smcLoading.style.display = 'flex';
                smcContent.innerHTML = '';
                try {
                    // We use fetch if it's on a server, or we can try to use fs.cat if available
                    // Since it's glitterOS, smc/docs might be in the real FS or virtual FS.
                    // Usually smc/docs are real files on the server.
                    const response = await fetch('smc/docs/introduction_to_smc.md');
                    if (response.ok) {
                        const text = await response.text();
                        if (typeof Markdown !== 'undefined' && Markdown.render) {
                            smcContent.innerHTML = Markdown.render(text);
                        } else {
                            smcContent.innerText = text;
                        }
                        smcLoaded = true;
                    } else {
                        smcContent.innerHTML = '<p style="color:#f07070;">Failed to load documentation file.</p>';
                    }
                } catch (err) {
                    smcContent.innerHTML = `<p style="color:#f07070;">Error loading documentation: ${err.message}</p>`;
                } finally {
                    smcLoading.style.display = 'none';
                }
            }
        });
    });

    wm.createWindow('About glitterOS', container, {
        width: 550,
        height: 600,
        noResize: false,
        icon: 'bi-info-circle'
    });
}

function systemSleep() {
    document.body.style.filter = 'brightness(0.1) grayscale(1)';
    setTimeout(() => {
        document.body.style.filter = '';
        if (typeof lockScreen === 'function') lockScreen();
    }, 2000);
}

window.kaboom = kaboom;
window.aboutGlitterOS = aboutGlitterOS;
window.systemSleep = systemSleep;

function setWallpaper(url) {
    if (!url) return;
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    const newLayer = document.createElement('div');
    newLayer.className = 'gos-wallpaper-layer';
    newLayer.style.backgroundImage = `url("${url}")`;
    newLayer.style.opacity = '0';

    // Ensure it is at the very background (prepend)
    desktop.insertBefore(newLayer, desktop.firstChild);

    const oldLayers = Array.from(desktop.querySelectorAll('.gos-wallpaper-layer')).filter(l => l !== newLayer);

    // Trigger transition
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            newLayer.style.opacity = '1';
            oldLayers.forEach(layer => {
                layer.style.opacity = '0';
                setTimeout(() => {
                    if (layer.parentNode === desktop) {
                        desktop.removeChild(layer);
                    }
                }, 1000); // 1s transition from CSS
            });
        });
    });

    if (typeof registry !== 'undefined') {
        registry.set('Software.GlitterOS.Personalization.Wallpaper', url);
    }
    if (typeof SysLog !== 'undefined') SysLog.info(`glitterOS: Wallpaper set to ${url}`);
}

window.setWallpaper = setWallpaper;
