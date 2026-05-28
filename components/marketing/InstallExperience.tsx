"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone, X } from "lucide-react";

import {
  detectPlatform,
  getInstallGuide,
  type InstallPlatform,
} from "@/lib/install";

/** Window event that InstallButton dispatches to open the modal. */
export const INSTALL_OPEN_EVENT = "vigilance:install-open";

const BANNER_DISMISS_KEY = "vigilance:install-banner-dismissed";
const BANNER_DELAY_MS = 10_000;

// `beforeinstallprompt` isn't in the standard DOM lib yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** The Vigilance home-screen mark: red square, bold white "V" (matches the favicon). */
function BrandMark({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-[12px] bg-accent-primary font-extrabold leading-none text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.52),
        letterSpacing: "-0.04em",
      }}
    >
      V
    </span>
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag when launched from home screen.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * Single mounted instance on the landing page. Owns the install modal and the
 * smart banner, captures the browser's native install prompt when offered, and
 * stays out of the way once Vigilance is already installed.
 */
export function InstallExperience() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("unknown");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [bannerMounted, setBannerMounted] = useState(false);
  const [bannerIn, setBannerIn] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Detect platform + already-installed state on mount.
  useEffect(() => {
    setPlatform(detectPlatform());
    if (isStandalone()) setInstalled(true);
  }, []);

  // Capture the native install prompt (Chromium) and react to install.
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setOpen(false);
      setBannerIn(false);
      setBannerMounted(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Open the modal when any InstallButton fires the event.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(INSTALL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(INSTALL_OPEN_EVENT, onOpen);
  }, []);

  // Smart banner: surface after a short delay, once per session.
  useEffect(() => {
    if (installed) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(BANNER_DISMISS_KEY) === "1";
    } catch {
      // Private mode / blocked storage — just behave as not-dismissed.
    }
    if (dismissed) return;
    const t = setTimeout(() => {
      setBannerMounted(true);
      requestAnimationFrame(() => setBannerIn(true));
    }, BANNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [installed]);

  // Modal: lock scroll, focus close, close on Escape.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dismissBanner = useCallback(() => {
    setBannerIn(false);
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setTimeout(() => setBannerMounted(false), 300);
  }, []);

  const triggerNativePrompt = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setOpen(false);
    }
  }, [deferredPrompt]);

  if (installed) return null;

  const guide = getInstallGuide(platform);

  return (
    <>
      {/* ─── Install modal ─── */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
        >
          <div
            className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm animate-in fade-in-0"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-[440px] animate-in fade-in-0 zoom-in-95 rounded-t-frame bg-bg-tertiary p-7 shadow-[0_30px_80px_rgba(26,26,26,0.18)] sm:rounded-frame sm:p-8">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-secondary hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <BrandMark size={44} />
              <div>
                <h2
                  id="install-title"
                  className="text-lg font-semibold leading-tight tracking-[-0.01em] text-text-primary"
                >
                  {guide.title}
                </h2>
                <p className="text-sm text-text-secondary">
                  Open Vigilance like an app on {guide.device}.
                </p>
              </div>
            </div>

            {deferredPrompt && (
              <>
                <button
                  type="button"
                  onClick={triggerNativePrompt}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <Smartphone className="h-4 w-4" />
                  Install Vigilance
                </button>
                <div className="mt-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  <span className="h-px flex-1 bg-text-primary/10" />
                  or add it yourself
                  <span className="h-px flex-1 bg-text-primary/10" />
                </div>
              </>
            )}

            <ol className="mt-6 space-y-4">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular-nums text-accent-primary">
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-relaxed text-text-primary">
                    {step}
                  </span>
                </li>
              ))}
            </ol>

            {guide.note && (
              <p className="mt-6 rounded-card bg-bg-secondary px-4 py-3 text-[13px] leading-relaxed text-text-secondary">
                {guide.note}
              </p>
            )}

            <p className="mt-6 text-center text-xs text-text-muted">
              Takes about 30 seconds. Nothing to download from an app store.
            </p>
          </div>
        </div>
      )}

      {/* ─── Smart banner ─── */}
      {bannerMounted && (
        <div
          className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
            bannerIn ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-3 flex max-w-[560px] items-center gap-3 rounded-frame border border-text-primary/10 bg-bg-tertiary px-4 py-3 shadow-[0_12px_40px_rgba(26,26,26,0.14)] sm:mb-5 sm:px-5">
            <BrandMark size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-text-primary">
                Keep Vigilance one tap away
              </div>
              <div className="truncate text-xs text-text-secondary">
                Install it for your 30-second daily check-in.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                dismissBanner();
              }}
              className="shrink-0 rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="shrink-0 rounded-full p-1.5 text-text-muted transition hover:bg-bg-secondary hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
