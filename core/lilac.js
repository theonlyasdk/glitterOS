const menubar = document.getElementById("menubar");
const desktop = document.getElementById("desktop");
const dock = document.getElementById("dock");

const alertDialog = document.getElementById("alert-dialog");
const alertDialogTitle = document.getElementById("alert-title");
const alertDialogBody = document.getElementById("alert-body");
const alertDialogBtnClose = document.getElementById("alert-btn-close");
const alertDialogBtn1 = document.getElementById("alert-btn-1");
const alertDialogBtn2 = document.getElementById("alert-btn-2");

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

function showConfirm(title,msg,on_confirm) {
	showDialog(title,msg,null,{
		btn1: {
			text:"OK",
			onclick:on_confirm,
		},
	})
}

function showDialog(title,msg,warnlevel=null,extrabtns=null) {
	// hide buttons initially
	alertDialogBtn1.style.display="none";
	alertDialogBtn2.style.display="none";

	if (extrabtns) {
		if (extrabtns.btn1) {
			alertDialogBtn1.style.display="block";
			alertDialogBtn1.innerHTML=extrabtns.btn1.text;
			alertDialogBtn1.onclick=extrabtns.btn1.onclick;
		}
		if (extrabtns.btn2) {
			alertDialogBtn2.style.display="block";
			alertDialogBtn2.innerHTML=extrabtns.btn2.text;
			alertDialogBtn2.onclick=extrabtns.btn2.onclick;	
		}
	}

	const dialog = new bootstrap.Modal(alertDialog, {});
	alertDialogTitle.innerHTML=title;
	alertDialogBody.innerHTML=msg;
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
function aboutGlitterOS() {
	const msg = `
		<b>glitterOS</b> is an operating system that runs inside your browser.
		<br>
		<br>
		<i class="d-inline-block text-center w-100">Have fun!!!!</i>
		<small class="w-100 text-center d-inline-block text-secondary">(c) theonlyasdk 2025-26</small>
	`;
	showDialog("About glitterOS",msg);
}
ldeInit();