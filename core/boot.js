// ── LDE Boot — calls ldeInit after all modules are loaded ────────────────────
function ldeInit() {
    assertExistsElseReload(menubar);
    assertExistsElseReload(desktop);
    assertExistsElseReload(taskbar);

    ldeInitApplets();
    ldeInitMenubar();
    renderCalendar(currentCalendarDate);

    const currentDesktopName = desktops[currentDesktopIdx].name;
    desktopNameLbl.innerText = currentDesktopName;

    ldeInitDesktopSelection();
}

ldeInit();
