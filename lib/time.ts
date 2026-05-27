/**
 * Timezone-aware calendar helpers (H5). Calendar features — the daily
 * check-in streak and the weekly idle check — must roll over at the
 * user's local midnight, not UTC's. We derive the local date with
 * Intl.DateTimeFormat (no dependency) rather than offset math, so DST
 * transitions are handled correctly by the platform.
 *
 * All functions operate on ISO date strings (YYYY-MM-DD). en-CA locale
 * formats as YYYY-MM-DD, which is what we want.
 */

export const DEFAULT_TIMEZONE = "America/New_York";

/** Returns the calendar date (YYYY-MM-DD) in `tz` at instant `at`. */
export function localDateISO(
  tz: string = DEFAULT_TIMEZONE,
  at: Date = new Date()
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    // Invalid tz string — fall back to default, then UTC
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: DEFAULT_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(at);
    } catch {
      return at.toISOString().slice(0, 10);
    }
  }
}

/** YYYY-MM-DD n days before/after the given ISO date (calendar math). */
export function addDaysISO(iso: string, days: number): string {
  // Parse as UTC noon to avoid any DST edge affecting the ±day arithmetic,
  // then re-extract the date. Pure calendar shift on the date components.
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from ISO date `from` to ISO date `to` (to - from). */
export function daysBetweenISO(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** A curated timezone list for the settings picker (US/Canada-first). */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York, Toronto)" },
  { value: "America/Chicago", label: "Central (Chicago, Winnipeg)" },
  { value: "America/Denver", label: "Mountain (Denver, Edmonton)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles, Vancouver)" },
  { value: "America/Halifax", label: "Atlantic (Halifax)" },
  { value: "America/St_Johns", label: "Newfoundland (St. John's)" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central Europe (Paris, Berlin)" },
  { value: "America/Asuncion", label: "Asunción (Paraguay)" },
  { value: "UTC", label: "UTC" },
];
