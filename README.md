# FileFling

A macOS menubar app for flinging files — especially screenshots — to a remote machine over SSH.

## Why

Built for the workflow of talking to a CLI AI agent on a remote machine via SSH/tmux and needing to quickly share screenshots from your local Mac. FileFling sends the file via SSH/SFTP and copies the remote path to your clipboard so you can paste it straight into the conversation.

## Features

- **Menubar app** — lives in your menubar, not the dock
- **Global hotkey** — `⌘⇧F` sends your latest screenshot instantly
- **Drag & drop** — drop any file onto the dropdown to send it
- **SSH/SFTP transport** — uses `ssh2`, no dependency on external `scp` binary
- **Auto-copy remote path** — clipboard ready to paste into your terminal
- **Send history** — last 10 sends, click to copy the path again
- **TOFU host key verification** — secure by default
- **Settings UI** — configure host, port, key path, remote directory

## Screenshot naming

- Screenshots sent via hotkey/button are renamed to a clean timestamp: `2026-06-25_143015.png`
- Dragged files keep their original name (sanitized: spaces → underscores)

## Stack

- Electron + electron-vite
- React + TypeScript + Tailwind CSS
- `ssh2` for SSH transport
- `menubar` for menubar window management
- `electron-store` for settings persistence

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Package for macOS

Unsigned local build for testing:

```bash
pnpm pack:mac
```

Unsigned DMG/ZIP for testing Gatekeeper-unfriendly direct distribution:

```bash
pnpm dist:mac:unsigned
```

Signed/notarized DMG/ZIP once Apple Developer ID credentials are available:

```bash
pnpm dist:mac
```

See `docs/distribution.md` for the full direct-distribution checklist.

## Tray/app icons

Tray icons are committed as PNG assets under `src/main/icons/`; the packaged app icon is `build/icon.icns`. If the glyph changes, regenerate them with:

```bash
pnpm icons:generate
```

## License

Proprietary. All rights reserved.

This source code is not licensed for copying, modification, redistribution, or use except with explicit permission from the copyright holder.
