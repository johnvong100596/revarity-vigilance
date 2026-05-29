-- FX audit C1: fx_rates.rate was NUMERIC(10,6) → max integer part 9999.999999.
-- The USD→PYG rate is already ~7300 and trends upward; the day it crosses
-- 10000 the INSERT throws numeric_overflow and the whole feed stops updating
-- for EVERY currency. Widen to NUMERIC(18,8): plenty of integer headroom for
-- any real-world rate, more fractional precision for USD→EUR/CAD. Widening a
-- NUMERIC is a safe, lossless, additive change.

ALTER TABLE public.fx_rates
  ALTER COLUMN rate TYPE NUMERIC(18, 8);
