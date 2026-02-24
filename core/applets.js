// ── Applets (clock, date, calendar) ─────────────────────────────────────────
const applets = {
    date: { elem: document.getElementById("lde-mbar-applet-date"), interval: null },
    time: { elem: document.getElementById("lde-mbar-applet-time"), id: null },
};

let currentCalendarDate = new Date();

function ldeInitApplets() {
    const hourHand = document.getElementById("hour-hand");
    const minHand = document.getElementById("minute-hand");
    const secHand = document.getElementById("second-hand");
    const digitalClock = document.getElementById("clock-digital");
    const timezoneElem = document.getElementById("clock-timezone");

    function updateClock() {
        const now = new Date();
        const seconds = now.getSeconds();
        const minutes = now.getMinutes();
        const hours = now.getHours();

        // Create markers if not yet present
        const markerGroup = document.getElementById("clock-markers");
        if (markerGroup && markerGroup.children.length === 0) {
            for (let i = 0; i < 12; i++) {
                const angle = i * 30;
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("class", "clock-marker");
                line.setAttribute("x1", "50"); line.setAttribute("y1", "7");
                line.setAttribute("x2", "50"); line.setAttribute("y2", "12");
                line.setAttribute("transform", `rotate(${angle}, 50, 50)`);
                markerGroup.appendChild(line);
            }
        }

        if (secHand) secHand.style.transform = `rotate(${seconds * 6}deg)`;
        if (minHand) minHand.style.transform = `rotate(${minutes * 6 + seconds * 0.1}deg)`;
        if (hourHand) hourHand.style.transform = `rotate(${hours * 30 + minutes * 0.5}deg)`;

        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        });
        applets.time.elem.innerText = timeStr;
        if (digitalClock) digitalClock.innerText = timeStr;
        if (timezoneElem) {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const offset = -now.getTimezoneOffset() / 60;
            timezoneElem.innerText = `${timezone} (UTC${offset >= 0 ? '+' : ''}${offset})`;
        }
        applets.date.elem.innerText = now.toDateString();
    }

    applets.time.interval = setInterval(updateClock, 1000);
    updateClock();
}

function renderCalendar(dateToRender, direction = null) {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) return;

    const now = new Date();
    const month = dateToRender.getMonth();
    const year = dateToRender.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    const newPage = document.createElement('div');
    newPage.className = 'calendar-page';

    let html = `
		<div class="calendar-header">
			<button class="cal-nav" onclick="changeMonth(-1, event)"><i class="ri-arrow-left-s-line"></i></button>
			<b>${monthNames[month]} ${year}</b>
			<button class="cal-nav" onclick="changeMonth(1, event)"><i class="ri-arrow-right-s-line"></i></button>
		</div>
		<table class="calendar-table">
			<thead><tr><th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th></tr></thead>
			<tbody><tr>`;

    for (let i = 0; i < firstDay; i++) html += '<td></td>';
    for (let i = 1; i <= daysInMonth; i++) {
        if ((i + firstDay - 1) % 7 === 0 && i !== 1) html += '</tr><tr>';
        const isToday = (i === now.getDate() && month === now.getMonth() && year === now.getFullYear()) ? 'class="today"' : '';
        html += `<td ${isToday}>${i}</td>`;
    }
    html += '</tr></tbody></table>';
    newPage.innerHTML = html;

    // Register tile effects for nav and dates
    newPage.querySelectorAll('.cal-nav').forEach(btn => registerTileEffect(btn, { tilt: true, ripple: true, glow: true, liveTilt: true }));
    newPage.querySelectorAll('.calendar-table td:not(:empty)').forEach(td => registerTileEffect(td, { tilt: true, ripple: true, glow: true, liveTilt: true }));

    const oldPage = calendarContainer.querySelector('.calendar-page');
    newPage.style.visibility = 'hidden';
    newPage.style.position = 'absolute';
    calendarContainer.appendChild(newPage);
    newPage.style.visibility = '';
    newPage.style.position = '';

    if (oldPage && direction) {
        const enterClass = direction === 'next' ? 'slide-left-enter' : 'slide-right-enter';
        const exitClass = direction === 'next' ? 'slide-left-exit' : 'slide-right-exit';
        oldPage.classList.add('sliding');
        newPage.classList.add('sliding', enterClass);
        newPage.offsetHeight; // reflow
        oldPage.classList.add(exitClass);
        newPage.classList.remove(enterClass);
        setTimeout(() => {
            if (oldPage.parentNode === calendarContainer) calendarContainer.removeChild(oldPage);
            newPage.classList.remove('sliding');
        }, 300);
    } else {
        calendarContainer.innerHTML = '';
        calendarContainer.appendChild(newPage);
    }
}

function changeMonth(delta, event) {
    if (event) event.stopPropagation();
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar(currentCalendarDate, delta > 0 ? 'next' : 'prev');
}
