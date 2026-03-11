# SathiPlays Electron App (macOS)

## What is already configured
- Electron main process: `electron/main.cjs`
- Embedded Next.js server for packaged app (no separate browser required)
- Desktop scripts in `package.json`:
  - `npm run desktop:dev` (run web + electron dev window)
  - `npm run desktop:prep` (prepare Next standalone payload)
  - `npm run desktop:pack` (build unpacked `.app` bundle)
  - `npm run desktop:dist` (build distributable `.dmg` + `.zip`)
- Builder config in `package.json > build`

## Set app name
Edit `package.json`:
- `build.productName` -> app name shown in Finder/Dock
- `build.appId` -> unique app id (reverse domain style)

Example:
- `"productName": "SathiPlays"`
- `"appId": "com.sathiplays.desktop"`

## Set app logo/icon (mac)
Current icon path:
- `build.mac.icon = "public/SathiPlays/Images/avatar.png"`

For best mac quality, use `.icns`:
1. Create a square PNG (1024x1024), e.g. `electron/assets/icon.png`
2. Convert to `.icns`:

```bash
mkdir -p electron/assets/icon.iconset
sips -z 16 16 electron/assets/icon.png --out electron/assets/icon.iconset/icon_16x16.png
sips -z 32 32 electron/assets/icon.png --out electron/assets/icon.iconset/icon_16x16@2x.png
sips -z 32 32 electron/assets/icon.png --out electron/assets/icon.iconset/icon_32x32.png
sips -z 64 64 electron/assets/icon.png --out electron/assets/icon.iconset/icon_32x32@2x.png
sips -z 128 128 electron/assets/icon.png --out electron/assets/icon.iconset/icon_128x128.png
sips -z 256 256 electron/assets/icon.png --out electron/assets/icon.iconset/icon_128x128@2x.png
sips -z 256 256 electron/assets/icon.png --out electron/assets/icon.iconset/icon_256x256.png
sips -z 512 512 electron/assets/icon.png --out electron/assets/icon.iconset/icon_256x256@2x.png
sips -z 512 512 electron/assets/icon.png --out electron/assets/icon.iconset/icon_512x512.png
sips -z 1024 1024 electron/assets/icon.png --out electron/assets/icon.iconset/icon_512x512@2x.png
iconutil -c icns electron/assets/icon.iconset -o electron/assets/icon.icns
rm -rf electron/assets/icon.iconset
```

3. Update `package.json`:
- `"icon": "electron/assets/icon.icns"`

## Build and save as app on your Mac
From project root:

```bash
npm install
npm run desktop:dist
```

Output folder:
- `release/`
  - `*.dmg`
  - `*.zip`
  - unpacked app bundle (depending on target)

Install:
1. Open generated `.dmg`
2. Drag `SathiPlays.app` to `Applications`
3. Open from Applications and optionally “Keep in Dock”

## Local dev desktop mode
```bash
npm run desktop:dev
```

This starts Next on `http://localhost:3000` and opens Electron window sized for your compact target.

