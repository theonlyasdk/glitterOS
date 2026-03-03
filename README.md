# glitterOS
Operating system simulator written in HTML, CSS and JS. A modern web-based environment inspired by classic desktop workflows.

## Features

### Core System Services
- **FileSystem Service**: Robust virtual filesystem with support for directories, file metadata, and persistent storage.
- **Process Manager**: Advanced process lifecycle management, including application isolation and resource tracking.
- **Service Manager**: Dynamic service registration and discovery for cross-app communication.
- **App Registry**: centralized application metadata and icon management.
- **Notification Service**: System-wide notifications with stacking, animations, and interactive callbacks.
- **Event Bus**: Global pub/sub event system for decoupled service interaction.
- **Registry**: Key-value system configuration and user preference storage.
- **Syntax Highlighter**: Native high-performance code highlighting for SMC and other formats.
- **SysLog**: Centralized system logging for auditing and debugging.

### Scriptable Macro Commands (SMC)
- **Hybrid Interpreter**: Direct execution of `.smc` scripts with support for block scoping, procedures, and error handling.
- **Native Transpiler**: High-performance compiler that converts SMC scripts into memory-safe C code.
- **Performance**: Up to 120x speedup when compiled to native binaries via the `smcc` toolchain.
- **Modern Syntax**: Features like mandatory `@` function prefixing, comma-separated arguments, and full symbolic call stack traces.

### Pre-installed Applications
- **Assistant**: AI-powered companion for system guidance and tasks.
- **CMD**: Powerful DOS-inspired command-line interface with full SMC integration.
- **File Manager**: Desktop-grade file explorer with list/grid views and context menus.
- **Control Panel**: Centralized management for system settings and themes.
- **Edit**: Professional code and text editor with syntax highlighting and tab support.
- **Notepad**: Simple, fast text editor for quick notes.
- **Regedit**: Registry editor for fine-tuning system behavior.
- **Task Manager**: Real-time process monitoring and system resource usage.
- **Syslog Viewer**: Integrated interface for viewing system logs.
- **Welcome**: Interactive onboarding experience for new users.

## Credits
- [WhiteSur cursors](https://github.com/vinceliuice/WhiteSur-cursors) by [vinceliuice](https://github.com/vinceliuice)
- [Remix Icons](https://remixicon.com/) for system-wide iconography.
- [Bootstrap](https://getbootstrap.com/) for UI component foundations.
