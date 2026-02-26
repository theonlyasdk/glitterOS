/**
 * System State - Global references and OS constants
 */
const SystemState = (() => {
    // DOM References
    const references = {
        menubar: document.getElementById("menubar"),
        desktop: document.getElementById("desktop"),
        taskbar: document.getElementById("taskbar"),
        desktopNameLbl: document.getElementById("desktop-name")
    };

    // Shared State
    const session = {
        currentDesktopIdx: 0,
        desktops: [{ name: "Desktop" }]
    };

    return {
        ...references,
        ...session,
        shortcuts: new Map([
            ['alt+s', { description: 'Toggle App Search', action: () => typeof toggleSearch === 'function' && toggleSearch() }],
            ['alt+f4', { description: 'Close Active Window', action: () => wm && wm.activeWindow && wm.closeWindow(wm.activeWindow.id) }],
            ['escape', {
                description: 'Close all overlays', action: () => {
                    if (typeof closeSearch === 'function') closeSearch();
                    if (typeof closeActionCentre === 'function') closeActionCentre();
                }
            }]
        ])
    };
})();

// Temporary aliases for transition
window.menubar = SystemState.menubar;
window.desktop = SystemState.desktop;
window.taskbar = SystemState.taskbar;
window.desktopNameLbl = SystemState.desktopNameLbl;
window.currentDesktopIdx = SystemState.currentDesktopIdx;
window.desktops = SystemState.desktops;
window.SYSTEM_SHORTCUTS = SystemState.shortcuts;
