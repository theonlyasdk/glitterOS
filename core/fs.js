// ── glitterOS Virtual Filesystem ─────────────────────────────────────────────
// A simple in-memory tree. Each node is { type, name, children?, content? }
// Uses drive-letter paths: C:\Users\User, C:\Program Files, etc.

const fs = (() => {
    const _tree = {
        type: 'dir', name: 'C:', children: [
            {
                type: 'dir', name: 'Users', children: [
                    {
                        type: 'dir', name: 'User', children: [
                            { type: 'dir', name: 'Desktop', children: [] },
                            {
                                type: 'dir', name: 'Documents', children: [
                                    { type: 'file', name: 'readme.txt', content: 'Welcome to glitterOS!\r\nThis is a virtual document.' },
                                    { type: 'file', name: 'notes.txt', content: 'These are your notes.' },
                                ]
                            },
                            { type: 'dir', name: 'Downloads', children: [] },
                            { type: 'dir', name: 'Pictures', children: [] },
                        ]
                    },
                    { type: 'dir', name: 'Public', children: [] }
                ]
            },
            {
                type: 'dir', name: 'Windows', children: [
                    {
                        type: 'dir', name: 'System32', children: [
                            { type: 'file', name: 'edit.exe', content: '[glitterOS System Executable]' },
                        ]
                    },
                    { type: 'dir', name: 'Web', children: [] },
                ]
            },
            {
                type: 'dir', name: 'Program Files', children: [
                    {
                        type: 'dir', name: 'glitterOS', children: [
                            { type: 'file', name: 'version.txt', content: 'glitterOS v1.0.0 (Alpha)' },
                        ]
                    },
                ]
            },
            {
                type: 'dir', name: 'Program Data', children: []
            },
            {
                type: 'dir', name: 'Temp', children: []
            },
        ]
    };

    // Current working directory as array of path segments
    let _cwd = ['Users', 'User'];

    const STORAGE_KEY = 'lde_filesystem_root';

    function _save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_tree));
    }

    function _load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.type === 'dir') {
                    _tree.children = parsed.children;
                    _tree.name = parsed.name;
                }
            } catch (e) {
                console.error("FS: Failed to load from localStorage", e);
            }
        }
    }

    // Initial load
    _load();

    // ── Internal helpers ──────────────────────────────────────────────────────
    function _getNode(pathSegs) {
        let node = _tree;
        for (const seg of pathSegs) {
            if (!seg) continue;
            if (node.type !== 'dir') return null;
            node = node.children.find(c => c.name.toLowerCase() === seg.toLowerCase());
            if (!node) return null;
        }
        return node;
    }

    function _normalizePath(raw) {
        return raw.replace(/\//g, '\\');
    }

    function _resolvePath(path) {
        if (!path || path === '.') return [..._cwd];
        let raw = _normalizePath(path);

        // Drive letter root
        if (/^[A-Za-z]:$/.test(raw)) return [];

        const isAbsolute = /^[A-Za-z]:/.test(raw) || raw.startsWith('\\');
        let p = raw;
        if (/^[A-Za-z]:/.test(p)) {
            p = p.replace(/^[A-Za-z]:\\?/, '');
        } else if (p.startsWith('\\')) {
            p = p.slice(1);
        }

        const parts = isAbsolute ? p.split('\\').filter(Boolean) : [..._cwd, ...p.split('\\').filter(Boolean)];

        const resolved = [];
        for (const seg of parts) {
            if (seg === '..') { if (resolved.length) resolved.pop(); }
            else if (seg !== '.') resolved.push(seg);
        }
        return resolved;
    }

    function _toDisplayPath(segs) {
        return 'C:\\' + segs.join('\\');
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        pwd() { return _toDisplayPath(_cwd); },

        ls(path = '.') {
            const segs = _resolvePath(path);
            const node = _getNode(segs);
            if (!node) return { error: `The system cannot find the path specified.` };
            if (node.type !== 'dir') return { error: `The directory name is invalid.` };
            return { entries: node.children.map(c => ({ name: c.name, type: c.type })) };
        },

        cd(path = '~') {
            if (path === '~' || path === '/') { _cwd = ['Users', 'User']; return { ok: true }; }
            const segs = _resolvePath(path);
            const node = _getNode(segs);
            if (!node) return { error: `The system cannot find the path specified.` };
            if (node.type !== 'dir') return { error: `The directory name is invalid.` };
            _cwd = segs;
            return { ok: true };
        },

        cat(path) {
            const segs = _resolvePath(path);
            const node = _getNode(segs);
            if (!node) return { error: `The system cannot find the file specified.` };
            if (node.type !== 'file') return { error: `Access is denied.` };
            return { content: node.content };
        },

        write(path, content = '') {
            const segs = _resolvePath(path);
            const name = segs.pop();
            const dirNode = _getNode(segs);
            if (!dirNode) return { error: `The system cannot find the path specified.` };
            if (dirNode.type !== 'dir') return { error: `The directory name is invalid.` };
            // Case-insensitive check
            const existing = dirNode.children.find(c => c.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                existing.content = content;
                existing.name = name; // update case?
            } else {
                dirNode.children.push({ type: 'file', name, content });
            }
            _save();
            return { ok: true };
        },

        touch(path) {
            const segs = _resolvePath(path);
            const name = segs.pop();
            const dirNode = _getNode(segs);
            if (!dirNode) return { error: `The system cannot find the path specified.` };
            if (dirNode.type !== 'dir') return { error: `The directory name is invalid.` };
            if (!dirNode.children.find(c => c.name.toLowerCase() === name.toLowerCase())) {
                dirNode.children.push({ type: 'file', name, content: '' });
            }
            _save();
            return { ok: true };
        },

        mkdir(path) {
            const segs = _resolvePath(path);
            const name = segs.pop();
            const dirNode = _getNode(segs);
            if (!dirNode) return { error: `The system cannot find the path specified.` };
            if (dirNode.type !== 'dir') return { error: `The directory name is invalid.` };
            if (dirNode.children.find(c => c.name.toLowerCase() === name.toLowerCase()))
                return { error: `A subdirectory or file already exists.` };
            dirNode.children.push({ type: 'dir', name, children: [] });
            _save();
            return { ok: true };
        },

        rm(path) {
            const segs = _resolvePath(path);
            const name = segs.pop();
            const dirNode = _getNode(segs);
            if (!dirNode) return { error: `The system cannot find the file specified.` };
            const idx = dirNode.children.findIndex(c => c.name.toLowerCase() === name.toLowerCase() && c.type === 'file');
            if (idx === -1) return { error: `Could Not Find ${name}` };
            dirNode.children.splice(idx, 1);
            _save();
            return { ok: true };
        },

        rmdir(path) {
            const segs = _resolvePath(path);
            const name = segs.pop();
            const dirNode = _getNode(segs);
            if (!dirNode) return { error: `The system cannot find the path specified.` };
            const idx = dirNode.children.findIndex(c => c.name.toLowerCase() === name.toLowerCase() && c.type === 'dir');
            if (idx === -1) return { error: `The system cannot find the path specified.` };
            if (dirNode.children[idx].children.length)
                return { error: `The directory is not empty.` };
            dirNode.children.splice(idx, 1);
            _save();
            return { ok: true };
        },

        exists(path) {
            return !!_getNode(_resolvePath(path));
        },

        stat(path) {
            const node = _getNode(_resolvePath(path));
            if (!node) return { error: `The system cannot find the path specified.` };
            return { name: node.name, type: node.type };
        },

        getattr(path, key) {
            const node = _getNode(_resolvePath(path));
            if (!node) return null;
            return node[key];
        },

        setattr(path, key, val) {
            const node = _getNode(_resolvePath(path));
            if (!node) return { error: `The system cannot find the path specified.` };
            node[key] = val;
            _save();
            return { ok: true };
        },

        getattributes(path) {
            const node = _getNode(_resolvePath(path));
            if (!node) return null;
            const attrs = {};
            const internal = ['name', 'type', 'content', 'children', 'size'];
            Object.keys(node).forEach(k => {
                if (!internal.includes(k)) attrs[k] = node[k];
            });
            return attrs;
        }
    };
})();

// Initialize System32 executables
(function () {
    const apps = [
        { exe: 'notepad.exe', id: 'notepad' },
        { exe: 'explorer.exe', id: 'filemanager' },
        { exe: 'taskmgr.exe', id: 'taskmanager' },
        { exe: 'control.exe', id: 'controlpanel' },
        { exe: 'regedit.exe', id: 'regedit' },
        { exe: 'cmd.exe', id: 'cmd' }
    ];

    apps.forEach(app => {
        const path = `C:\\Windows\\System32\\${app.exe}`;
        if (!fs.exists(path)) {
            fs.write(path, '[glitterOS System Executable]');
            fs.setattr(path, 'appId', app.id);
        }
    });
})();
