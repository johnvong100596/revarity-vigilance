-- Per-user referral tokens + who-invited-who tracking (Task 3.6).
-- Each user gets a unique short referral token at signup. Links like
-- /r/<token> capture the inviting user, store in a cookie, and persist
-- to profiles.invited_by_user_id on signup completion.

ALTER TABLE public.profiles
  ADD COLUMN referral_token TEXT UNIQUE,
  ADD COLUMN invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill existing profiles with referral tokens
UPDATE public.profiles
SET referral_token = encode(gen_random_bytes(8), 'hex')
WHERE referral_token IS NULL;

-- Going forward, the auto-profile-creation trigger needs to populate it
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, referral_token)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    encode(gen_random_bytes(8), 'hex')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE INDEX idx_profiles_invited_by ON public.profiles(invited_by_user_id) WHERE invited_by_user_id IS NOT NULL;
