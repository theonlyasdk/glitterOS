const CACHE_NAME = 'glitter-os-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './styles/bs-theme.css',
    './styles/controls.css',
    './styles/desktop.css',
    './styles/fonts.css',
    './styles/menubar.css',
    './styles/window.css',
    './styles/taskbar.css',
    './styles/action-centre.css',
    './styles/search.css',
    './styles/cmd.css',
    './styles/filemanager.css',
    './styles/switcher.css',
    './styles/notepad.css',
    './styles/widgets.css',
    './styles/filedialog.css',
    './styles/controlpanel.css',
    './styles/edit.css',
    './styles/styles.css',
    './core/document.js',
    './core/lib.js',
    './core/wm.js',
    './core/globals.js',
    './core/applets.js',
    './core/menubar.js',
    './core/action-centre.js',
    './core/fs.js',
    './core/search.js',
    './core/apps/cmd.js',
    './core/apps/filemanager.js',
    './core/apps/edit.js',
    './core/apps/notepad.js',
    './core/filedialog.js',
    './core/apps/welcome.js',
    './core/apps/controlpanel.js',
    './core/switcher.js',
    './core/boot.js',
    './res/wall.png',
    './res/default.svg',
    './res/icons/icon-192.png',
    './res/icons/icon-512.png',
    './res/screenshots/desktop.png',
    './res/screenshots/mobile.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
