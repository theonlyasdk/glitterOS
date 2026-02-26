/**
 * Process Manager - Handles application execution and "Open With" logic
 */
const ProcessManager = (() => {
    return {
        /** Launch a file if it's an executable or associated with an app */
        run(path) {
            if (typeof fs === 'undefined') return { error: 'FS not loaded' };
            const stat = fs.stat(path);
            if (stat.error) return { error: stat.error };
            if (stat.type !== 'file') return { error: 'Not a valid executable.' };

            const appId = fs.getattr(path, 'appId');
            if (appId) {
                const app = AppRegistry.get(appId);
                if (app) {
                    app.launch();
                    return { ok: true };
                } else {
                    if (typeof wm !== 'undefined') {
                        wm.messageBox('glitterOS', `The system cannot find the application associated with this file.<br><br>App not installed: <b>${appId}</b>`, { icon: 'bi-x-circle-fill' });
                    }
                    return { error: 'App not installed' };
                }
            }

            // Find app by extension
            const extMatch = path.match(/\.([^.]+)$/);
            const ext = extMatch ? extMatch[1].toLowerCase() : '';

            // Check for user-defined default
            const userDefaultId = registry.get(`defaults.ext.${ext}`);
            if (userDefaultId) {
                const app = AppRegistry.get(userDefaultId);
                if (app) {
                    app.launch(path);
                    return { ok: true };
                }
            }

            const possibleApps = AppRegistry.getAppsForExt(ext);

            if (possibleApps.length > 0) {
                possibleApps[0].launch(path);
                return { ok: true };
            }

            // Universal fallback
            const editApp = AppRegistry.get('edit');
            if (editApp) {
                editApp.launch(path);
                return { ok: true };
            }

            return { error: 'No application associated with this file.' };
        },

        /**
         * Windows 10 Style "Open With" Dialog
         */
        showOpenWithDialog(path) {
            const extMatch = path.match(/\.([^.]+)$/);
            const ext = extMatch ? extMatch[1].toLowerCase() : '';
            const apps = AppRegistry.getAppsForExt(ext);

            const container = document.createElement('div');
            container.className = 'gos-openwith-page';
            container.style.cssText = 'padding: 20px; background: #1e1e1e; height: 100%; display: flex; flex-direction: column; color: #fff; box-sizing: border-box;';
            container.innerHTML = `<h3 style="margin: 0 0 15px 0; font-size: 1.1rem; font-weight: normal; color: #fff;">How do you want to open this .${ext} file?</h3>`;

            const list = document.createElement('div');
            list.className = 'gos-app-list';
            list.style.cssText = 'background: rgba(28, 28, 32, 0.4); border: 1px solid rgba(255,255,255,0.07); overflow-y: auto; flex: 1; margin: 0 -8px;';

            const footer = document.createElement('div');
            footer.style.cssText = 'margin-top: 15px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;';
            footer.innerHTML = `
                <input type="checkbox" id="always-use-app" style="cursor:pointer;">
                <label for="always-use-app" style="cursor:pointer; color: #aaa;">Always use this app to open .${ext} files</label>
            `;

            if (apps.length === 0) {
                list.innerHTML = `<div class="gos-search-no-results visible">No supported applications</div>`;
            } else {
                apps.forEach(app => {
                    const item = document.createElement('div');
                    item.className = 'gos-app-item';
                    item.innerHTML = `
                        <div class="gos-app-item-icon"><i class="${app.icon}"></i></div>
                        <div class="gos-app-item-name">${app.name}</div>
                    `;
                    if (typeof Widgets !== 'undefined') Widgets.registerTileEffect(item);
                    item.onclick = () => {
                        const alwaysUse = container.querySelector('#always-use-app').checked;
                        if (alwaysUse) {
                            registry.set(`defaults.ext.${ext}`, app.id);
                        }
                        wm.closeWindow(win.id);
                        app.launch(path);
                    };
                    list.appendChild(item);
                });
            }

            container.appendChild(list);
            container.appendChild(footer);

            const win = wm.createWindow('Open with...', container, {
                width: 400,
                height: 400,
                noResize: true,
                modal: true
            });
        }
    };
})();

window.ProcessManager = ProcessManager;
// Aliases
window.SystemExec = ProcessManager;
window.showOpenWithDialog = ProcessManager.showOpenWithDialog.bind(ProcessManager);
