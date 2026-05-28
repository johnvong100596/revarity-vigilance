-- Brain-dead onboarding (night batch WS3).
--
-- Two one-time flags on profiles:
--   welcomed         — has the user seen the "There you are" welcome moment
--                      after their first balance landed? (fire once)
--   locale_detected  — have we auto-set home_currency + timezone from the
--                      browser locale yet? (run the silent detector once)
--
-- Both default false so existing users get the detector + (if they have
-- accounts) the welcome on next load; harmless either way.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcomed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locale_detected BOOLEAN NOT NULL DEFAULT false;
