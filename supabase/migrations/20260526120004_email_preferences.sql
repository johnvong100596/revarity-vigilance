-- Email preference flags (Tasks 2.2 + 2.3 night batch). Both default to
-- true — users opt out from Settings → Preferences if they don't want them.

ALTER TABLE public.profiles ADD COLUMN weekly_email_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN monthly_email_enabled BOOLEAN NOT NULL DEFAULT true;
