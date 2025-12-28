const menubar = fromId("menubar");
const desktop = fromId("desktop");
const dock = fromId("dock");

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
		name:"Desktop"
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
		applets.time.elem.innerText = time;
	}, 1000);

	applets.date.interval = setInterval(() => {
		const now = new Date();
		date = now.toDateString();
		applets.date.elem.innerText = date;
	}, 1000);
}

function ldeInit() {
	assertExistsElseReload(menubar);
	assertExistsElseReload(desktop);
	assertExistsElseReload(dock);

	ldeInitApplets();

	const currentDesktopName = desktops[currentDesktopIdx].name;
	desktopNameLbl.innerText = currentDesktopName;
}
function kaboom(sender) {
	const kaboomCandidates = [menubar,desktop,dock];
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
		<div class="d-flex flex-row">
		<i class="bi bi-balloon-fill display-1"></i>
		<br>
			<div>
			<h1><b>glitterOS</b></h1>
			<p><b>glitterOS</b>&nbsp;is an operating system that runs inside your browser.</p>
			</div>
		</div>
		<hr class="ps-3 pe-3">
		<i class="d-inline-block text-center w-100">Have fun!!!!</i>
		<small class="w-100 text-center d-inline-block text-secondary">(c) theonlyasdk 2025-26</small>
	`;
	showDialog("About",msg);
}
ldeInit();