// ── Shared DOM references ────────────────────────────────────────────────────
const menubar = fromId("menubar");
const desktop = fromId("desktop");
const taskbar = fromId("taskbar");

const alertDialog = fromId("alert-dialog");
const alertDialogTitle = fromId("alert-title");
const alertDialogBody = fromId("alert-body");
const alertDialogBtn1 = fromId("alert-btn-1");
const alertDialogBtn2 = fromId("alert-btn-2");

const desktopNameLbl = fromId("desktop-name");

// ── Desktop / virtual desktop state ─────────────────────────────────────────
const currentDesktopIdx = 0;
const desktops = [{ name: "Desktop" }];

// ── Dialog helpers ───────────────────────────────────────────────────────────
function showConfirm(title, msg, on_confirm) {
    showDialog(title, msg, null, {
        btn1: { text: "OK", onclick: on_confirm },
    });
}

function showDialog(title, msg, warnlevel = null, extrabtns = null) {
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
        window.alert(elem + " does not exist! Reloading in 5s...");
        setTimeout(() => location.reload(), 5000);
    }
}

// ── Misc utils ───────────────────────────────────────────────────────────────
function ldeMbarItemClicked(item_index, sender) { alert(sender); }

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
                }, 5000);
            }
        });
    });
}

function aboutGlitterOS(app_name) {
    const sub_text = app_name ? `<div class="mb-3 text-secondary" style="font-size: 0.85rem;">This product is licensed under the glitterOS License to:<br><b>${app_name} User</b></div>` : '';
    const msg = `
		<div class="lde-app-padded">
			<div class="d-flex flex-column align-items-center text-center">
				<i class="bi bi-balloon-fill display-1 mb-3"></i>
				<h1 class="mb-0"><b>glitterOS</b></h1>
				<p class="text-secondary mb-4">Version 4.2.0.6969</p>
				<div class="text-start w-100 px-3">
					<p><b>glitterOS</b> is an experimental web-based desktop environment designed for speed and simplicity.</p>
					<p>Built with vanilla JS and Bootstrap, it brings a familiar multitasking experience to your browser.</p>
                    ${sub_text}
				</div>
				<hr class="w-100">
				<i class="mb-2">"It's like a balloon, but digital."</i>
				<small class="text-secondary">(c) glitterOS Corporation 2025-26. All rights reserved.</small>
			</div>
		</div>
	`;
    wm.createWindow("About glitterOS", msg, { width: 350, height: 480 });
}

/**
 * Wallpaper System with Dissolve Effect
 */
function setWallpaper(url) {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    // Get current layers
    const layers = desktop.querySelectorAll('.lde-wallpaper-layer');
    const oldLayer = layers[layers.length - 1]; // Assume latest is current

    const newLayer = document.createElement('div');
    newLayer.className = 'lde-wallpaper-layer';
    newLayer.style.backgroundImage = `url("${url}")`;
    newLayer.style.opacity = '0';
    desktop.appendChild(newLayer);

    // Initial first set
    if (!oldLayer) {
        newLayer.style.opacity = '1';
        return;
    }

    // Trigger transition
    requestAnimationFrame(() => {
        newLayer.style.opacity = '1';
        oldLayer.style.transition = 'opacity 1s ease-in-out';
        oldLayer.style.opacity = '0';

        // Cleanup old layer
        setTimeout(() => {
            if (oldLayer.parentNode) oldLayer.remove();
        }, 1100);
    });
}

// Initial default wallpaper
window.addEventListener('load', () => {
    setWallpaper('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop');
});
