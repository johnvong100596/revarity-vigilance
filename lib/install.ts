// PWA install detection + per-platform instructions.
//
// The marketing page can't fire a browser's native install prompt on its
// own — only Chromium browsers expose `beforeinstallprompt`, and iOS/Safari/
// Firefox need the user to use a menu. So this module picks the closest set
// of plain-English steps to show, and the InstallExperience component layers
// a one-tap native button on top whenever the browser actually offers one.

export type InstallPlatform =
  | "ios-safari"
  | "ios-other"
  | "android"
  | "desktop-chromium"
  | "desktop-firefox"
  | "desktop-safari"
  | "unknown";

export interface InstallGuide {
  platform: InstallPlatform;
  /** Where the app will live, in plain words. */
  device: string;
  /** Modal headline. */
  title: string;
  /** Ordered, jargon-free steps. */
  steps: string[];
  /** A gentle note when the happy path isn't available on this browser. */
  note?: string;
}

/**
 * Best-effort platform sniff. User-agent detection is never perfect, but the
 * modal always shows manual steps as a floor, and Chromium's
 * `beforeinstallprompt` is the authoritative signal layered on top — so a
 * wrong guess still leaves the user with workable instructions.
 */
export function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent;
  // iPadOS 13+ reports as desktop Mac; the touch-point check catches it.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    // CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge on iOS. Anything else
    // on iOS is the WebKit Safari shell, which is the reliable A2HS path.
    const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isOtherIOSBrowser ? "ios-other" : "ios-safari";
  }

  if (isAndroid) return "android";

  // Desktop. Order matters: Edge UA also contains "Chrome".
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge && !/OPR\//.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isSafari = /Safari\//.test(ua) && /Version\//.test(ua) && !isChrome;

  if (isChrome || isEdge) return "desktop-chromium";
  if (isFirefox) return "desktop-firefox";
  if (isSafari) return "desktop-safari";
  return "unknown";
}

export function getInstallGuide(platform: InstallPlatform): InstallGuide {
  switch (platform) {
    case "ios-safari":
      return {
        platform,
        device: "your iPhone",
        title: "Add Vigilance to your iPhone",
        steps: [
          "Tap the Share button — the square with an arrow pointing up — at the bottom of the screen.",
          'Scroll down and tap "Add to Home Screen".',
          'Tap "Add" in the top corner. Vigilance lands on your home screen.',
        ],
      };

    case "ios-other":
      return {
        platform,
        device: "your iPhone",
        title: "Open in Safari to add Vigilance",
        steps: [
          "Copy this page's link from the address bar.",
          "Open Safari and paste the link.",
          'Tap Share, then "Add to Home Screen", then "Add".',
        ],
        note: "On iPhone, adding to the home screen works from Safari. Other browsers can't do it yet.",
      };

    case "android":
      return {
        platform,
        device: "your phone",
        title: "Add Vigilance to your phone",
        steps: [
          "Tap the menu (three dots) in the top corner of your browser.",
          'Tap "Install app" or "Add to Home screen".',
          'Tap "Install" to confirm.',
        ],
      };

    case "desktop-chromium":
      return {
        platform,
        device: "your computer",
        title: "Add Vigilance to your computer",
        steps: [
          "Look for the install icon in the address bar — a small screen with a down-arrow, on the right.",
          'Click it, then click "Install".',
          'No icon? Open the browser menu and choose "Install Vigilance" (in Edge: Apps → Install).',
        ],
      };

    case "desktop-firefox":
      return {
        platform,
        device: "your computer",
        title: "Save Vigilance to Firefox",
        steps: [
          "Press Ctrl + D (Cmd + D on Mac) to bookmark this page for one-click access.",
          "Want the full app window? Open this page in Chrome or Edge and click Install.",
        ],
        note: "Firefox on desktop doesn't install web apps, so a bookmark is the quickest option here.",
      };

    case "desktop-safari":
      return {
        platform,
        device: "your Mac",
        title: "Add Vigilance to your Dock",
        steps: [
          'In the Safari menu bar at the top, click "File".',
          'Click "Add to Dock".',
          'Click "Add". Vigilance opens like a native app.',
        ],
        note: "Add to Dock needs macOS Sonoma or newer. On older Macs, bookmark the page instead.",
      };

    default:
      return {
        platform: "unknown",
        device: "your device",
        title: "Add Vigilance to your device",
        steps: [
          "Open your browser's menu.",
          'Look for "Install app" or "Add to Home Screen".',
          "Follow the prompt to confirm.",
        ],
        note: "Vigilance installs best from Safari on iPhone, or Chrome and Edge everywhere else.",
      };
  }
}
