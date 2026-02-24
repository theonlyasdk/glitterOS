// ── glitterOS Widget Gallery ──────────────────────────────────────────────────

function launchWidgetGallery() {
    const container = document.createElement('div');
    container.className = 'lde-app-padded h-100 overflow-auto';
    container.style.backgroundColor = '#1e1e1e';

    const createGroup = (label, content) => {
        const group = document.createElement('div');
        group.className = 'lde-w32-group';
        group.innerHTML = `<div class="lde-w32-group-label">${label}</div>`;
        group.appendChild(content);
        return group;
    };

    // ── Buttons & Basic Controls ─────────────────────────────────────────────
    const basicBox = document.createElement('div');
    basicBox.style.display = 'flex';
    basicBox.style.flexDirection = 'column';
    basicBox.style.gap = '10px';

    const btnRow = document.createElement('div');
    btnRow.className = 'd-flex gap-2';
    const btn1 = document.createElement('button');
    btn1.className = 'lde-w32-btn';
    btn1.textContent = 'Command 1';
    const btn2 = document.createElement('button');
    btn2.className = 'lde-w32-btn';
    btn2.textContent = 'Command 2';
    btnRow.append(btn1, btn2);

    const checkRow = document.createElement('div');
    checkRow.className = 'lde-w32-check-row';
    const check = document.createElement('div');
    check.className = 'lde-w32-check';
    check.onclick = () => check.classList.toggle('checked');
    const checkLbl = document.createElement('span');
    checkLbl.textContent = 'Enable Advanced Features';
    checkRow.append(check, checkLbl);

    const radioRow = document.createElement('div');
    radioRow.className = 'd-flex gap-3';
    ['Option A', 'Option B'].forEach((txt, i) => {
        const rRow = document.createElement('div');
        rRow.className = 'lde-w32-check-row';
        const radio = document.createElement('div');
        radio.className = 'lde-w32-radio' + (i === 0 ? ' checked' : '');
        rRow.append(radio, document.createTextNode(txt));
        rRow.onclick = () => {
            radioRow.querySelectorAll('.lde-w32-radio').forEach(r => r.classList.remove('checked'));
            radio.classList.add('checked');
        };
        radioRow.appendChild(rRow);
    });

    basicBox.append(btnRow, checkRow, radioRow);

    // ── Progress & Status ────────────────────────────────────────────────────
    const progressBox = document.createElement('div');
    const pBar = document.createElement('div');
    pBar.className = 'lde-w32-progress';
    const pFill = document.createElement('div');
    pFill.className = 'lde-w32-progress-fill';
    pFill.style.width = '45%';
    pBar.appendChild(pFill);

    const pLabel = document.createElement('div');
    pLabel.style.fontSize = '0.75rem';
    pLabel.style.marginTop = '4px';
    pLabel.style.color = '#888';
    pLabel.textContent = 'System processing: 45%';

    progressBox.append(pBar, pLabel);

    // ── List & Input ─────────────────────────────────────────────────────────
    const listBox = document.createElement('div');
    listBox.className = 'lde-w32-list';
    ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].forEach((name, i) => {
        const item = document.createElement('div');
        item.className = 'lde-w32-list-item' + (i === 0 ? ' selected' : '');
        item.textContent = name;
        item.onclick = () => {
            listBox.querySelectorAll('.lde-w32-list-item').forEach(li => li.classList.remove('selected'));
            item.classList.add('selected');
        };
        listBox.appendChild(item);
    });

    const inputBox = document.createElement('div');
    inputBox.style.marginTop = '12px';
    const inputLbl = document.createElement('div');
    inputLbl.style.fontSize = '0.8rem';
    inputLbl.style.marginBottom = '2px';
    inputLbl.textContent = 'Configuration Key:';
    const input = document.createElement('input');
    input.className = 'lde-w32-input';
    input.value = 'GLTR-1234-X99';
    inputBox.append(inputLbl, input);

    const listGroup = document.createElement('div');
    listGroup.append(listBox, inputBox);

    // Assembly
    container.append(
        createGroup('Basic Controls', basicBox),
        createGroup('Progress & Feedback', progressBox),
        createGroup('Selection & Configuration', listGroup)
    );

    wm.createWindow('Widget Gallery', container, {
        icon: 'ri-magic-line',
        width: 450,
        height: 520
    });
}

AppRegistry.register({
    id: 'widgetgallery',
    name: 'Widget Gallery',
    exe: 'widgetgallery.exe',
    icon: 'ri-magic-line',
    launch: () => launchWidgetGallery(),
    desktopShortcut: true
});
