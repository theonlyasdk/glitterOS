const menubar = document.getElementById("menubar");
const desktop = document.getElementById("desktop");
const dock = document.getElementById("dock");
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
	applets.time.interval = setInterval(() => {
		const now = new Date();
		const time = now.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		});
		applets.time.elem.innerHTML = time;
	}, 1000);

	applets.date.interval = setInterval(() => {
		const now = new Date();
		date = now.toDateString();
		applets.date.elem.innerHTML = date;
	}, 1000);
}

function ldeInit() {
	assertExistsElseReload(menubar);
	assertExistsElseReload(desktop);
	assertExistsElseReload(dock);

	ldeInitApplets();
}
function kaboom(sender) {
	document.body.classList.add("kaboom");
}
ldeInit();