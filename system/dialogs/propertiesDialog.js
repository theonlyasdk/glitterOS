/**
 * Properties Dialog - Windows 10 style file/folder properties
 */
function launchPropertiesDialog(path) {
    if (!fs || !fs.exists(path)) {
        if (wm) wm.messageBox('Properties', 'The system cannot find the path specified.', { icon: 'bi-exclamation-triangle-fill' });
        return;
    }

    const stat = fs.stat(path);
    const isDir = stat.type === 'dir';
    const name = path.split('\\').pop() || 'Root';
    const parentPath = path.includes('\\') ? path.substring(0, path.lastIndexOf('\\')) || 'C:\\' : 'C:\\';

    const container = document.createElement('div');
    container.className = 'gos-properties-dialog';
    container.style.cssText = 'padding: 16px; background: #1e1e1e; height: 100%; color: #eee; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;';

    // Header section with icon and name
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; gap: 16px; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #333;';
    
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size: 2.5rem; color: var(--accent-color);';
    icon.innerHTML = `<i class="${isDir ? 'ri-folder-fill' : 'ri-file-line'}"></i>`;
    
    const titleInfo = document.createElement('div');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = name;
    nameInput.readOnly = true;
    nameInput.style.cssText = 'background: transparent; border: 1px solid transparent; color: #fff; font-size: 1rem; font-weight: bold; width: 100%; padding: 2px 4px;';
    
    titleInfo.appendChild(nameInput);
    header.append(icon, titleInfo);

    // Details Grid
    const details = document.createElement('div');
    details.style.cssText = 'display: grid; grid-template-columns: 100px 1fr; gap: 8px; font-size: 0.85rem;';

    const addRow = (label, value) => {
        const lbl = document.createElement('div');
        lbl.style.color = '#888';
        lbl.textContent = label + ':';
        const val = document.createElement('div');
        val.style.color = '#ccc';
        val.style.wordBreak = 'break-all';
        val.textContent = value;
        details.append(lbl, val);
    };

    addRow('Type', isDir ? 'File folder' : 'File');
    addRow('Location', parentPath);

    if (isDir) {
        // Calculate directory size and count
        let totalSize = 0;
        let fileCount = 0;
        let folderCount = 0;

        const scan = (p) => {
            const res = fs.ls(p);
            if (res.error || !res.entries) return;
            
            res.entries.forEach(item => {
                const fullPath = p.endsWith('\\') ? p + item.name : p + '\\' + item.name;
                if (item.type === 'dir') {
                    folderCount++;
                    scan(fullPath);
                } else {
                    fileCount++;
                    const s = fs.stat(fullPath);
                    totalSize += (s.size || 0);
                }
            });
        };
        
        scan(path);
        addRow('Size', (totalSize / 1024).toFixed(2) + ' KB (' + totalSize + ' bytes)');
        addRow('Contains', `${fileCount} Files, ${folderCount} Folders`);
    } else {
        addRow('Size', (stat.size / 1024).toFixed(2) + ' KB (' + stat.size + ' bytes)');
    }

    const createdDate = new Date(stat.created || Date.now());
    addRow('Created', createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString());

    container.appendChild(header);
    container.appendChild(details);

    // Footer buttons
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: auto; display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #333;';
    const closeBtn = Widgets.createButton('OK', () => {
        wm.closeWindow(win.id);
    });
    footer.appendChild(closeBtn);
    container.appendChild(footer);

    const win = wm.createWindow('Properties: ' + name, container, {
        width: 380,
        height: 420,
        noResize: true,
        icon: 'bi-info-circle'
    });
}

window.launchPropertiesDialog = launchPropertiesDialog;
