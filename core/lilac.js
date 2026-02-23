const menubar = fromId("menubar");
const desktop = fromId("desktop");
const taskbar = fromId("taskbar");

const alertDialog = fromId("alert-dialog");
const alertDialogTitle = fromId("alert-title");
const alertDialogBody = fromId("alert-body");
const alertDialogBtnClose = fromId("alert-btn-close");
const alertDialogBtn1 = fromId("alert-btn-1");
const alertDialogBtn2 = fromId("alert-btn-2");

const desktopNameLbl = fromId("desktop-name");

const currentDesktopIdx = 0;
const desktops = [
	{
		name: "Desktop"
	}
];

const applets = {
	date: {
		elem: document.getElementById("lde-mbar-applet-date"),
		interval: null,
	},
	time: {
		elem: document.getElementById("lde-mbar-applet-time"),
		id: null,
	}
}

function showConfirm(title, msg, on_confirm) {
	showDialog(title, msg, null, {
		btn1: {
			text: "OK",
			onclick: on_confirm,
		},
	})
}

function showDialog(title, msg, warnlevel = null, extrabtns = null) {
	// hide buttons initially
	alertDialogBtn1.style.display = "none";
	alertDialogBtn2.style.display = "none";

	if (extrabtns) {
		if (extrabtns.btn1) {
			alertDialogBtn1.style.display = "block";
			alertDialogBtn1.innerHTML = extrabtns.btn1.text;
			alertDialogBtn1.onclick = extrabtns.btn1.onclick;
		}
		if (extrabtns.btn2) {
			alertDialogBtn2.style.display = "block";
			alertDialogBtn2.innerHTML = extrabtns.btn2.text;
			alertDialogBtn2.onclick = extrabtns.btn2.onclick;
		}
	}

	const dialog = new bootstrap.Modal(alertDialog, {});
	alertDialogTitle.innerHTML = title;
	alertDialogBody.innerHTML = msg;
	dialog.show();
}
function assertExistsElseReload(elem) {
	if (!elem) {
		window.alert(elem + " does not exist! Reloading the window in 5s...");
		setTimeout(() => location.reload(), 5000);
	}
}

function ldeMbarItemClicked(item_index, sender) {
	alert(sender);
}

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

		// Create markers if not exist
		const markerGroup = document.getElementById("clock-markers");
		if (markerGroup && markerGroup.children.length === 0) {
			for (let i = 0; i < 12; i++) {
				const angle = i * 30;
				const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
				line.setAttribute("class", "clock-marker");
				line.setAttribute("x1", "50");
				line.setAttribute("y1", "7");
				line.setAttribute("x2", "50");
				line.setAttribute("y2", "12");
				line.setAttribute("transform", `rotate(${angle}, 50, 50)`);
				markerGroup.appendChild(line);
			}
		}

		// Analog moves
		if (secHand) secHand.style.transform = `rotate(${seconds * 6}deg)`;
		if (minHand) minHand.style.transform = `rotate(${minutes * 6 + seconds * 0.1}deg)`;
		if (hourHand) hourHand.style.transform = `rotate(${hours * 30 + minutes * 0.5}deg)`;

		// Menubar label
		const timeStr = now.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		});
		applets.time.elem.innerText = timeStr;

		// Expanded details
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

let currentCalendarDate = new Date();

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

function ldeInitDesktopSelection() {
	let selectionRect = null;
	let startX, startY;

	desktop.addEventListener('mousedown', (e) => {
		if (e.target !== desktop) return;

		startX = e.clientX;
		startY = e.clientY;

		selectionRect = document.createElement('div');
		selectionRect.className = 'lde-selection-rect';
		selectionRect.style.left = startX + 'px';
		selectionRect.style.top = startY + 'px';
		selectionRect.style.width = '0px';
		selectionRect.style.height = '0px';
		desktop.appendChild(selectionRect);

		function onMouseMove(e) {
			const currentX = e.clientX;
			const currentY = e.clientY;

			const left = Math.min(startX, currentX);
			const top = Math.min(startY, currentY);
			const width = Math.abs(startX - currentX);
			const height = Math.abs(startY - currentY);

			selectionRect.style.left = left + 'px';
			selectionRect.style.top = top + 'px';
			selectionRect.style.width = width + 'px';
			selectionRect.style.height = height + 'px';
		}

		function onMouseUp() {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);

			if (selectionRect) {
				const rectToRemove = selectionRect;
				rectToRemove.style.opacity = '0';
				setTimeout(() => {
					if (rectToRemove.parentNode) {
						rectToRemove.parentNode.removeChild(rectToRemove);
					}
				}, 200);
				selectionRect = null;
			}
		}

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	});
}

function ldeInitMenubar() {
	let menuActive = false;
	// Exclude non-dropdown buttons (e.g. action centre) from the hover chain
	const mbarItems = Array.from(document.querySelectorAll('.lde-mbar-item'))
		.filter(el => el.dataset.bsToggle === 'dropdown');

	mbarItems.forEach(item => {
		const dropdown = bootstrap.Dropdown.getOrCreateInstance(item);

		item.addEventListener('show.bs.dropdown', () => {
			menuActive = true;
		});

		// Specialized fix for items that need measurement
		item.addEventListener('shown.bs.dropdown', () => {
			if (item.title === "Calendar") {
				renderCalendar(currentCalendarDate);
			}
		});

		item.addEventListener('hide.bs.dropdown', () => {
			// Small delay to check if we moved to another menu
			setTimeout(() => {
				if (!document.querySelector('.dropdown-menu.show')) {
					menuActive = false;
				}
			}, 100);
		});

		item.addEventListener('mouseenter', () => {
			if (menuActive) {
				const activeDropdown = document.querySelector('.dropdown-menu.show');
				if (activeDropdown && activeDropdown.parentElement !== item.parentElement) {
					// Close active one
					const activeBtn = activeDropdown.parentElement.querySelector('.lde-mbar-item');
					if (activeBtn) {
						bootstrap.Dropdown.getInstance(activeBtn).hide();
					}
					// Open this one
					dropdown.show();
				}
			}
		});
	});

	// Close menu when clicking a menu item
	document.querySelectorAll('.dropdown-item').forEach(item => {
		item.addEventListener('click', () => {
			const activeDropdown = document.querySelector('.dropdown-menu.show');
			if (activeDropdown) {
				const activeBtn = activeDropdown.parentElement.querySelector('.lde-mbar-item');
				if (activeBtn) {
					bootstrap.Dropdown.getInstance(activeBtn).hide();
				}
			}
		});
	});
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
			<button class="cal-nav" onclick="changeMonth(-1, event)"><i class="bi bi-chevron-left"></i></button>
			<b>${monthNames[month]} ${year}</b>
			<button class="cal-nav" onclick="changeMonth(1, event)"><i class="bi bi-chevron-right"></i></button>
		</div>
		<table class="calendar-table">
			<thead>
				<tr>
					<th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th>
				</tr>
			</thead>
			<tbody>
				<tr>
	`;

	for (let i = 0; i < firstDay; i++) {
		html += '<td></td>';
	}

	for (let i = 1; i <= daysInMonth; i++) {
		if ((i + firstDay - 1) % 7 === 0 && i !== 1) {
			html += '</tr><tr>';
		}
		const isToday = (i === now.getDate() && month === now.getMonth() && year === now.getFullYear()) ? 'class="today"' : '';
		html += `<td ${isToday}>${i}</td>`;
	}

	html += '</tr></tbody></table>';
	newPage.innerHTML = html;

	const oldPage = calendarContainer.querySelector('.calendar-page');

	// Add new page
	newPage.style.visibility = 'hidden';
	newPage.style.position = 'absolute';
	calendarContainer.appendChild(newPage);
	newPage.style.visibility = '';
	newPage.style.position = '';

	if (oldPage && direction) {
		const enterClass = direction === 'next' ? 'slide-left-enter' : 'slide-right-enter';
		const exitClass = direction === 'next' ? 'slide-left-exit' : 'slide-right-exit';

		oldPage.classList.add('sliding');
		newPage.classList.add('sliding');
		newPage.classList.add(enterClass);

		// Force reflow
		newPage.offsetHeight;

		oldPage.classList.add(exitClass);
		newPage.classList.remove(enterClass);

		setTimeout(() => {
			if (oldPage.parentNode === calendarContainer) {
				calendarContainer.removeChild(oldPage);
			}
			newPage.classList.remove('sliding');
		}, 300);
	} else {
		// Clean up and keep only the new page
		calendarContainer.innerHTML = '';
		calendarContainer.appendChild(newPage);
	}
}

function changeMonth(delta, event) {
	if (event) event.stopPropagation();
	currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
	renderCalendar(currentCalendarDate, delta > 0 ? 'next' : 'prev');
}

function kaboom(sender) {
	const kaboomCandidates = [menubar, desktop, taskbar];
	kaboomCandidates.forEach((elem) => {
		elem.addEventListener("mouseup", () => {
			elem.classList.add("kaboom");
			kaboomCandidates.pop(elem);
			if (kaboomCandidates.length < 2) {
				document.body.classList.add("kaboom-ticking");
				setInterval(() => {
					document.body.classList.remove("kaboom-ticking");
					document.body.classList.add("kaboom");
				}, 5000)
			}
		})
	})
}

function aboutGlitterOS() {
	const msg = `
		<div class="d-flex flex-column align-items-center text-center">
			<i class="bi bi-balloon-fill display-1 mb-3"></i>
			<h1 class="mb-0"><b>glitterOS</b></h1>
			<p class="text-secondary mb-4">Version 1.0.0 (Alpha)</p>
			
			<div class="text-start w-100 px-3">
				<p><b>glitterOS</b> is an experimental web-based desktop environment designed for speed and simplicity.</p>
				<p>Built with vanilla JS and Bootstrap, it brings a familiar multitasking experience to your browser.</p>
			</div>
			
			<hr class="w-100">
			<i class="mb-2">"It's like a balloon, but digital."</i>
			<small class="text-secondary">(c) theonlyasdk 2025-26. All rights reserved.</small>
		</div>
	`;
	wm.createWindow("About glitterOS", msg, { width: 350, height: 450 });
}

/* ---- Action Centre ---- */
const _ac = document.getElementById('action-centre');
const _acOverlay = document.getElementById('action-centre-overlay');
const _acDateLabel = document.getElementById('ac-date-label');

function toggleActionCentre() {
	if (_ac.classList.contains('open')) {
		closeActionCentre();
	} else {
		openActionCentre();
	}
}

function openActionCentre() {
	// Update date label
	const now = new Date();
	_acDateLabel.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
	_acOverlay.style.display = 'block';
	_ac.classList.add('open');
	document.getElementById('action-centre-btn').classList.add('lde-mbar-item-highlight');
}

function closeActionCentre() {
	_ac.classList.remove('open');
	_acOverlay.style.display = 'none';
	document.getElementById('action-centre-btn').classList.remove('lde-mbar-item-highlight');
}

// Perspective tilt helper: calculates rotateX/Y from click position within element
function applyTiltPress(elem, e) {
	const rect = elem.getBoundingClientRect();
	const relX = (e.clientX - rect.left) / rect.width;   // 0=left 1=right
	const relY = (e.clientY - rect.top) / rect.height;  // 0=top  1=bottom
	const rotY = (relX - 0.5) * 30;  // left→negative, right→positive
	const rotX = -(relY - 0.5) * 30;  // top→positive,  bottom→negative
	elem.style.transform = `perspective(500px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(0.93)`;
}

function resetTilt(elem) {
	elem.style.transform = '';
}

// Spawn ripple glow at cursor position
function spawnRipple(elem, e) {
	const rect = elem.getBoundingClientRect();
	const ripple = document.createElement('div');
	ripple.className = 'lde-ac-tile-ripple';
	ripple.style.left = (e.clientX - rect.left) + 'px';
	ripple.style.top = (e.clientY - rect.top) + 'px';
	elem.appendChild(ripple);
	ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

// Toggle tiles + perspective tilt + spotlight glow
_ac.querySelectorAll('.lde-ac-tile').forEach(tile => {
	tile.addEventListener('mousedown', (e) => {
		applyTiltPress(tile, e);
		spawnRipple(tile, e);
	});

	tile.addEventListener('mouseup', () => resetTilt(tile));
	tile.addEventListener('mouseleave', () => resetTilt(tile));

	tile.addEventListener('mousemove', (e) => {
		const rect = tile.getBoundingClientRect();
		tile.style.setProperty('--glow-x', (e.clientX - rect.left) + 'px');
		tile.style.setProperty('--glow-y', (e.clientY - rect.top) + 'px');
	});

	tile.addEventListener('click', () => tile.classList.toggle('active'));
});

// Icon tile buttons (volume / brightness) — same tilt + glow
_ac.querySelectorAll('.lde-ac-icon-tile').forEach(btn => {
	btn.addEventListener('mousedown', (e) => applyTiltPress(btn, e));
	btn.addEventListener('mouseup', () => resetTilt(btn));
	btn.addEventListener('mouseleave', () => resetTilt(btn));

	btn.addEventListener('mousemove', (e) => {
		const rect = btn.getBoundingClientRect();
		btn.style.setProperty('--glow-x', (e.clientX - rect.left) + 'px');
		btn.style.setProperty('--glow-y', (e.clientY - rect.top) + 'px');
	});
});

// Volume mute toggle
const _volBtn = document.getElementById('ac-vol-btn');
const _volSlider = document.getElementById('ac-vol-slider');
let _volLastValue = _volSlider.value;

_volBtn.addEventListener('click', () => {
	if (_volSlider.value > 0) {
		_volLastValue = _volSlider.value;
		_volSlider.value = 0;
		_volBtn.querySelector('i').className = 'bi bi-volume-mute-fill';
		_volBtn.classList.add('active');
	} else {
		_volSlider.value = _volLastValue;
		_volBtn.querySelector('i').className = 'bi bi-volume-up-fill';
		_volBtn.classList.remove('active');
	}
	updateSliderFill(_volSlider);
});

// Brightness toggle
const _brightBtn = document.getElementById('ac-bright-btn');
const _brightSlider = document.getElementById('ac-bright-slider');
let _brightLastValue = _brightSlider.value;

_brightBtn.addEventListener('click', () => {
	if (_brightSlider.value > 0) {
		_brightLastValue = _brightSlider.value;
		_brightSlider.value = 0;
		_brightBtn.classList.add('active');
	} else {
		_brightSlider.value = _brightLastValue;
		_brightBtn.classList.remove('active');
	}
	updateSliderFill(_brightSlider);
});

function updateSliderFill(slider) {
	const min = slider.min || 0;
	const max = slider.max || 100;
	const pct = ((slider.value - min) / (max - min)) * 100;
	slider.style.setProperty('--slider-fill', pct + '%');
}

document.querySelectorAll('.lde-ac-slider').forEach(slider => {
	updateSliderFill(slider);
	slider.addEventListener('input', () => updateSliderFill(slider));
});
/* ── App Search Panel ── */
const _searchPanel = document.getElementById('search-panel');
const _searchOverlay = document.getElementById('search-overlay');
const _searchBtn = document.getElementById('search-btn');
const _searchInput = document.getElementById('search-input');
const _appList = document.getElementById('app-list');

const APPS = [
	{ name: 'Command Prompt', icon: 'bi-terminal-fill', color: '#1a1a1a' },
	{ name: 'File Explorer', icon: 'bi-folder2-open', color: '#d4a01a' },
	{ name: 'Internet Browser', icon: 'bi-globe2', color: '#0078d7' },
	{ name: 'Control Panel', icon: 'bi-sliders', color: '#6c4fa3' },
	{ name: 'Calculator', icon: 'bi-calculator-fill', color: '#1a7a3e' },
	{ name: 'Notepad', icon: 'bi-file-earmark-text', color: '#1a5fa3' },
];

// Build app list DOM
APPS.forEach(app => {
	const item = document.createElement('div');
	item.className = 'lde-app-item';
	item.dataset.name = app.name.toLowerCase();
	item.innerHTML = `
		<div class="lde-app-item-icon" style="background-color:${app.color}">
			<i class="bi ${app.icon}"></i>
		</div>
		<span class="lde-app-item-name">${app.name}</span>
	`;
	item.addEventListener('click', () => {
		closeSearch();
		wm.createWindow(app.name, `<p style="padding:8px">${app.name}</p>`, { icon: app.icon });
	});
	_appList.appendChild(item);
});

const _noResults = document.createElement('div');
_noResults.className = 'lde-search-no-results';
_noResults.textContent = 'No results found';
_appList.appendChild(_noResults);

// Filter apps on input
_searchInput.addEventListener('input', () => {
	const q = _searchInput.value.toLowerCase().trim();
	let anyVisible = false;
	_appList.querySelectorAll('.lde-app-item').forEach(item => {
		const match = item.dataset.name.includes(q);
		item.classList.toggle('hidden', !match);
		if (match) anyVisible = true;
	});
	_noResults.classList.toggle('visible', !anyVisible && q.length > 0);
});

function toggleSearch() {
	_searchPanel.classList.contains('open') ? closeSearch() : openSearch();
}

function openSearch() {
	_searchPanel.classList.add('open');
	_searchOverlay.classList.add('visible');
	_searchBtn.classList.add('active');
	_searchInput.value = '';
	_appList.querySelectorAll('.lde-app-item').forEach(i => i.classList.remove('hidden'));
	_noResults.classList.remove('visible');
	setTimeout(() => _searchInput.focus(), 60);
}

function closeSearch() {
	_searchPanel.classList.remove('open');
	_searchOverlay.classList.remove('visible');
	_searchBtn.classList.remove('active');
}

_searchOverlay.addEventListener('click', closeSearch);

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && _searchPanel.classList.contains('open')) closeSearch();
});

ldeInit();