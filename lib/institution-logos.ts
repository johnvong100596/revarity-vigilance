import type { SupabaseClient } from "@supabase/supabase-js";
import { CountryCode } from "plaid";

import { plaid, LINK_COUNTRY_CODES } from "@/lib/plaid";
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

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface InstitutionLogo {
  institution_id: string;
  name: string | null;
  logo_base64: string | null;
  color_primary: string | null;
}

function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > CACHE_TTL_MS;
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

  if (cached && !isStale(cached.fetched_at as string)) {
    return {
      institution_id: cached.institution_id as string,
      name: (cached.name as string | null) ?? null,
      logo_base64: (cached.logo_base64 as string | null) ?? null,
      color_primary: (cached.color_primary as string | null) ?? null,
    };
  }

  // Cache miss or stale — ask Plaid. Country codes must cover the
  // institution's country; we send whatever Link is currently scoped to.
  let name: string | null = null;
  let logo: string | null = null;
  let color: string | null = null;
  try {
    const res = await plaid().institutionsGetById({
      institution_id: institutionId,
      country_codes: LINK_COUNTRY_CODES as CountryCode[],
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
 * Ensure logos exist for the given institution_ids — lazily fetches any
 * that are missing or stale. Best-effort, bounded, swallows errors so it
 * can be awaited from a server component render without risk. Returns the
 * fresh cache map for immediate render.
 */
export async function ensureLogos(
  supabase: SupabaseClient,
  institutionIds: string[]
): Promise<Record<string, InstitutionLogo>> {
  const ids = Array.from(new Set(institutionIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("institution_logos")
    .select("institution_id, fetched_at")
    .in("institution_id", ids);

  const fresh = new Set(
    (existing ?? [])
      .filter((r) => !isStale(r.fetched_at as string))
      .map((r) => r.institution_id as string)
  );
  const missing = ids.filter((id) => !fresh.has(id));

  // Fetch missing ones sequentially (institution counts are tiny — one
  // per connected bank). Failures cache an empty row and don't throw.
  for (const id of missing) {
    await fetchAndCacheInstitutionLogo(id);
  }

  return getCachedLogosMap(supabase, ids);
}
