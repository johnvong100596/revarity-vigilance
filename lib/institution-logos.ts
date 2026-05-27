import type { SupabaseClient } from "@supabase/supabase-js";
import { CountryCode } from "plaid";

import { plaid } from "@/lib/plaid";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Bank icons feature. Institution logos come from Plaid's
 * /institutions/get_by_id with include_optional_metadata: true, which
 * returns a base64 PNG `logo` and a hex `primary_color`. Both can be
 * null for institutions Plaid doesn't have brand assets for.
 *
 * We cache per institution_id in the global `institution_logos` table
 * with a 30-day TTL. Reads are cheap (DB); only a cache miss or a stale
 * row triggers a Plaid call. All Plaid-touching writes go through the
 * admin client so RLS on the cache table only needs a SELECT policy.
 */

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for a real logo
// A row with no logo (Plaid had none, or the fetch failed) retries much
// sooner — otherwise a transient failure or a not-yet-approved country
// (H2) would show the letter fallback for a full month.
const EMPTY_RETRY_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// Logo metadata is fetched with a broad country set — institutionsGetById
// just reads public metadata, so including CA here is harmless and avoids
// caching an empty row for Canadian banks. (Distinct from LINK_COUNTRY_CODES,
// which gates the actual Link phone flow and stays US-only until approval.)
const LOGO_COUNTRY_CODES: CountryCode[] = [CountryCode.Us, CountryCode.Ca];

export interface InstitutionLogo {
  institution_id: string;
  name: string | null;
  logo_base64: string | null;
  color_primary: string | null;
}

/** A cached row is stale after 30d if it has a logo, or after 2d if it's
 *  empty (so failed/unavailable fetches retry without a 30-day blackout). */
function isStaleRow(fetchedAt: string, hasLogo: boolean): boolean {
  const age = Date.now() - new Date(fetchedAt).getTime();
  return age > (hasLogo ? CACHE_TTL_MS : EMPTY_RETRY_TTL_MS);
}

/**
 * Fetch a single institution's logo, using the cache when fresh.
 * Best-effort: returns null (and caches an empty row to avoid hammering
 * Plaid) when Plaid has no logo or the call fails.
 */
export async function fetchAndCacheInstitutionLogo(
  institutionId: string
): Promise<InstitutionLogo | null> {
  if (!institutionId) return null;
  const admin = createAdminClient();

  const { data: cached } = await admin
    .from("institution_logos")
    .select("institution_id, name, logo_base64, color_primary, fetched_at")
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (
    cached &&
    !isStaleRow(cached.fetched_at as string, Boolean(cached.logo_base64))
  ) {
    return {
      institution_id: cached.institution_id as string,
      name: (cached.name as string | null) ?? null,
      logo_base64: (cached.logo_base64 as string | null) ?? null,
      color_primary: (cached.color_primary as string | null) ?? null,
    };
  }

  // Cache miss or stale — ask Plaid with the broad metadata country set.
  let name: string | null = null;
  let logo: string | null = null;
  let color: string | null = null;
  try {
    const res = await plaid().institutionsGetById({
      institution_id: institutionId,
      country_codes: LOGO_COUNTRY_CODES,
      options: { include_optional_metadata: true },
    });
    const inst = res.data.institution;
    name = inst.name ?? null;
    logo = inst.logo ?? null;
    color = inst.primary_color ?? null;
  } catch (e) {
    console.warn(`[institution-logos] Plaid fetch failed for ${institutionId}`, e);
    // Still upsert an (empty) row so we show the fallback and don't retry
    // until the TTL elapses.
  }

  await admin.from("institution_logos").upsert(
    {
      institution_id: institutionId,
      name,
      logo_base64: logo,
      color_primary: color,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "institution_id" }
  );

  return { institution_id: institutionId, name, logo_base64: logo, color_primary: color };
}

/**
 * Read-only cache lookup for a set of institution_ids. Returns a plain
 * record keyed by institution_id. Never calls Plaid — use for render.
 */
export async function getCachedLogosMap(
  supabase: SupabaseClient,
  institutionIds: string[]
): Promise<Record<string, InstitutionLogo>> {
  const ids = Array.from(new Set(institutionIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("institution_logos")
    .select("institution_id, name, logo_base64, color_primary")
    .in("institution_id", ids);

  const map: Record<string, InstitutionLogo> = {};
  for (const row of data ?? []) {
    map[row.institution_id as string] = {
      institution_id: row.institution_id as string,
      name: (row.name as string | null) ?? null,
      logo_base64: (row.logo_base64 as string | null) ?? null,
      color_primary: (row.color_primary as string | null) ?? null,
    };
  }
  return map;
}

/**
 * Warm the logo cache for the given institution_ids — fetches any that are
 * missing or stale from Plaid. Call this from WRITE paths (exchange, sync),
 * NEVER from a page render: it makes serial Plaid round-trips and would
 * block first byte (audit H1). Best-effort; swallows errors.
 */
export async function warmLogos(institutionIds: string[]): Promise<void> {
  const ids = Array.from(new Set(institutionIds.filter(Boolean)));
  if (ids.length === 0) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("institution_logos")
    .select("institution_id, logo_base64, fetched_at")
    .in("institution_id", ids);

  const fresh = new Set(
    (existing ?? [])
      .filter((r) =>
        !isStaleRow(r.fetched_at as string, Boolean(r.logo_base64))
      )
      .map((r) => r.institution_id as string)
  );
  const missing = ids.filter((id) => !fresh.has(id));

  for (const id of missing) {
    await fetchAndCacheInstitutionLogo(id);
  }
}
