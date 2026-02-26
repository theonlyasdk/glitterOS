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
    container.style.cssText = 'padding:0; margin:0; height:100%; display:flex; flex-direction:column; overflow:hidden;';

    const html = `
        <div class="gos-about-header">
            <div class="gos-about-logo" style="font-size: 3rem;">
                <i class="bi-balloon-fill"></i>
            </div>
            <div class="gos-about-title">
                <h1 style="margin:0; font-size: 1.5rem;">glitterOS Beta</h1>
                <p style="margin:0; opacity: 0.8;">Version 4.2.9 (Build 2026.02)</p>
            </div>
        </div>
        <div class="gos-about-content" style="flex-grow:1; overflow-y:auto; padding: 20px; line-height: 1.6; color: #eee; background: #1e1e1e;">
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
    `;
    container.innerHTML = html;

    wm.createWindow('About glitterOS', container, {
        width: 450,
        height: 500,
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
        registry.set('personalization.wallpaper', url);
    }
    if (typeof SysLog !== 'undefined') SysLog.info(`glitterOS: Wallpaper set to ${url}`);
}

window.setWallpaper = setWallpaper;
