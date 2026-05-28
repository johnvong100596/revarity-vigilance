"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { setLocaleDefaults } from "@/lib/actions/onboarding";

type Currency = "USD" | "CAD" | "EUR" | "PYG";

// Map a browser locale's region to one of our supported currencies.
// Anything we don't recognize falls back to USD.
const EURO_REGIONS = new Set([
  "DE", "FR", "ES", "IT", "NL", "BE", "AT", "IE", "PT", "FI", "GR",
  "LU", "SK", "SI", "EE", "LV", "LT", "CY", "MT",
]);

function currencyForLocale(locale: string): Currency {
  const region = locale.split("-")[1]?.toUpperCase() ?? "";
  if (region === "CA") return "CAD";
  if (region === "PY") return "PYG";
  if (EURO_REGIONS.has(region)) return "EUR";
  return "USD";
}

/**
 * Silent smart-defaults detector (WS3 Task 3.4). On first app load it reads
 * the browser timezone + locale and sets the user's home currency + timezone
 * so they never have to choose. Renders nothing. Only mounted when the
 * profile hasn't been localized yet; the server action is itself a no-op if
 * already detected, so this is safe even if it double-fires.
 */
export function LocaleDetector() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let timezone = "America/New_York";
    try {
      timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
    } catch {
      /* keep default */
    }
    const locale =
      (typeof navigator !== "undefined" && navigator.language) || "en-US";
    const currency = currencyForLocale(locale);

    setLocaleDefaults({ timezone, currency })
      .then((res) => {
        if (res.applied) router.refresh();
      })
      .catch(() => {
        /* best-effort */
      });
  }, [router]);

  return null;
}
