# PWA verification — night batch 2026-05-26

Task 2.7 status. What ships in this batch, what's pending physical-device
verification, what needs proper image generation.

## What's wired

- **`app/manifest.ts`** — Next 14 file-based metadata, served at
  `/manifest.webmanifest`. Sets `name`, `short_name`, `description`,
  `start_url=/app`, `scope=/`, `display=standalone`,
  `orientation=portrait`, `background_color=#F5F1EB` (cream),
  `theme_color=#F04E37` (red).
- **`app/icon.tsx`** — 32×32 favicon, generated as PNG via `ImageResponse`
  on Edge runtime. Red square + bold "V" glyph. Auto-injects
  `<link rel="icon">` on every page.
- **`app/apple-icon.tsx`** — 180×180 PNG via `ImageResponse`. iOS uses
  this when the user does "Add to Home Screen" in Safari. Auto-injects
  `<link rel="apple-touch-icon">`.
- **`public/icon-192.svg` + `icon-512.svg`** — referenced by the manifest
  with `"any"` and `"maskable"` purposes. Modern browsers (Chrome,
  Edge, Firefox, Safari 16.4+) render SVG manifest icons without
  rasterization. Android adaptive icon: the maskable variant is the
  same SVG; Android's icon mask gets applied at install time.
- **`app/layout.tsx`** — `metadata.appleWebApp.{capable, title,
  statusBarStyle}` emits the iOS PWA meta tags. `formatDetection.
  telephone: false` stops Safari from auto-linking phone numbers in
  the "$1,247,832" net worth display.
- **`metadata.viewport.themeColor: "#F5F1EB"`** — sets the iOS status
  bar tint when the app is launched standalone.

## What's verified

- ✅ Build emits `/manifest.webmanifest`, `/icon`, `/apple-icon` as
  routes (visible in `next build` output every commit).
- ✅ SVG icons render at expected sizes in browser tab + favicon
  position.
- ✅ Manifest validates against the W3C manifest schema (no warnings
  in browser dev console).
- ✅ Apple-mobile-web-app meta tags present in HTML on every route
  (root layout).

## What's NOT yet verified (audit punch list)

- ⚠ **Physical iPhone test** — adding to home screen, launching as
  standalone, observing the actual icon + status bar tint. Requires
  a physical iOS device with Safari. Cena to test on his iPhone after
  promoting `day3` to production. Expected behaviour: tap Share →
  "Add to Home Screen" → V-on-red icon appears with "Vigilance" label
  → launching opens the app in standalone mode (no Safari URL bar)
  with cream status bar.
- ⚠ **iOS splash screens** — iOS requires `<link rel="apple-touch-
  startup-image">` tags with device-specific `media` queries to show a
  splash on launch. iPhone SE 1st gen (640×1136), iPhone 8 (750×1334),
  8 Plus (1242×2208), X/11 Pro (1125×2436), 12/13/14 Pro (1170×2532),
  12 Pro Max (1284×2778), 14 Pro Max (1290×2796), and iPad sizes —
  ~12 PNGs total. Without these, iOS shows a white screen during
  launch, then the app loads.
  **Mitigation:** generate these PNGs (background = #F5F1EB cream,
  centered red V) via a separate tooling step (Sharp / Figma export
  / similar). For this batch, undone. Cena can either accept the
  white-flash-then-load behavior or generate splash images
  out-of-band and drop them in `/public/splash/`.
- ⚠ **Android adaptive icon** — the SVG with `purpose: "maskable"` is
  the modern way to do this, but older Android (< Android 11) may
  still rasterize the foreground without honoring the safe area.
  Generally fine.
- ⚠ **PWA install prompt** — Chrome shows its own install prompt
  based on engagement heuristics; we haven't added a custom JS
  "Install Vigilance" button. Could add later via `beforeinstallprompt`
  event capture. Not in spec for this batch.

## Manual test path (Cena on iPhone, after promoting day3)

1. Open `https://vigilance.revarity.com` in Safari (must be Safari —
   Chrome on iOS uses WebKit but doesn't support PWA install).
2. Tap the Share button (square with arrow).
3. Scroll down → "Add to Home Screen".
4. Confirm the suggested name "Vigilance" and icon (red square with
   white V).
5. Tap "Add" — icon appears on home screen.
6. Tap the V icon — Vigilance launches in standalone mode (no Safari
   URL bar visible).
7. Expected: cream status bar matches background, the app feels native.

If step 6 instead opens Safari with the URL bar visible, the iOS PWA
meta tags aren't being read — file a bug.

## Next steps for full PWA polish (post-launch)

1. Generate 8-12 iOS splash PNGs and drop in `public/splash/`,
   reference in layout via `<link rel="apple-touch-startup-image"
   media="..." href="..." />`.
2. Add `app/(install-prompt)/page.tsx` or similar — capture
   `beforeinstallprompt` event in a useEffect, render a sticky banner
   on Android that prompts to install (iOS Safari doesn't fire this
   event).
3. Add service worker for offline support (Day 10 polish slot from
   the original sprint — uses Serwist per BUILD 4 commit message).
4. Add `screenshots` array to manifest for "richer app store" PWA
   listing previews (Chrome surfaces these when prompting install).
