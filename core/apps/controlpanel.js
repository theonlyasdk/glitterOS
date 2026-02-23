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
    container.className = 'lde-cp';

    const body = document.createElement('div');
    body.className = 'lde-cp-body';

    const sidebar = document.createElement('div');
    sidebar.className = 'lde-cp-sidebar';

    const mainContent = document.createElement('div');
    mainContent.className = 'lde-cp-content';

    const navItems = [
        { id: 'personalization', label: 'Personalization', icon: 'bi-palette' },
        { id: 'system', label: 'System', icon: 'bi-laptop' },
        { id: 'apps', label: 'Applications', icon: 'bi-grid' },
        { id: 'privacy', label: 'Privacy & Security', icon: 'bi-shield-lock' }
    ];

    let currentSection = 'personalization';

    function renderSection(id) {
        mainContent.innerHTML = '';
        currentSection = id;

        // Update sidebar UI
        sidebar.querySelectorAll('.lde-cp-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
        });

        const title = document.createElement('h2');
        title.className = 'lde-cp-section-title';
        title.textContent = navItems.find(n => n.id === id).label;
        mainContent.appendChild(title);

        if (id === 'personalization') {
            const desc = document.createElement('p');
            desc.textContent = 'Change your desktop wallpaper and overall system appearance.';
            desc.className = 'text-secondary';
            mainContent.appendChild(desc);

            const grid = document.createElement('div');
            grid.className = 'lde-cp-wallpaper-grid';

            STOCK_WALLPAPERS.forEach(wall => {
                const thumb = document.createElement('div');
                thumb.className = 'lde-cp-wallpaper-thumb';
                thumb.style.backgroundImage = `url("${wall.url}")`;
                thumb.title = wall.name;

                thumb.onclick = () => {
                    grid.querySelectorAll('.lde-cp-wallpaper-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                    setWallpaper(wall.url);
                };

                grid.appendChild(thumb);
            });

            mainContent.appendChild(grid);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'text-center mt-5 text-secondary';
            placeholder.innerHTML = `<i class="bi bi-gear-wide-connected display-1 opacity-25"></i><p class="mt-3">This section is currently under development.</p>`;
            mainContent.appendChild(placeholder);
        }
    }

    navItems.forEach(nav => {
        const item = document.createElement('div');
        item.className = 'lde-cp-nav-item';
        item.dataset.id = nav.id;
        item.innerHTML = `<i class="bi ${nav.icon}"></i><span>${nav.label}</span>`;
        item.onclick = () => renderSection(nav.id);
        sidebar.appendChild(item);
    });

    body.append(sidebar, mainContent);
    container.appendChild(body);

    wm.createWindow('Control Panel', container, {
        width: 750,
        height: 500,
        icon: 'bi-sliders'
    });

    renderSection('personalization');
}
