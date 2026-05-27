-- H5 (afternoon batch WS2): timezone-aware calendar math.
--
-- Calendar-based features (the daily check-in streak, the weekly 14-day
-- idle check) need to roll over at the user's local midnight, not UTC.
-- A user in Toronto who checks in at 9pm ET would otherwise be recorded
-- against the next UTC day and could break their streak.
--
-- Account decay (lib/decay.ts) is elapsed-time based (full 24h periods
-- since a timestamp), which is already timezone-independent — it is NOT
-- changed by this migration.
--
-- Default America/New_York (US East) for existing users who never set one.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';
