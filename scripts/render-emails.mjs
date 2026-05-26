// Render React Email components to static HTML files in lib/email/templates/.
//
// Run: node scripts/render-emails.mjs
//
// For Supabase auth email templates (magic link), paste the contents of
// lib/email/templates/magic-link.html into:
//   Supabase Dashboard → Authentication → Email Templates → Magic Link
//
// For Resend-driven transactional emails (Sunday Reckoning, Monthly Close),
// the templates are imported and rendered at send time inside the cron
// route handlers — this script is for the auth-template Supabase needs.

import { render } from "@react-email/render";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Dynamic import so we can run the .tsx via Node 20+ with the experimental
// type-stripping flag, OR fall back to a pre-compiled CommonJS variant.
// Vercel build doesn't run this script — it's invoked manually by Cena
// when the email design changes.
const { default: MagicLinkEmail } = await import(
  "../lib/email/MagicLinkEmail.tsx"
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = `${__dirname}/../lib/email/templates`;

mkdirSync(outDir, { recursive: true });

const magicLinkHtml = await render(MagicLinkEmail({}), { pretty: true });
writeFileSync(`${outDir}/magic-link.html`, magicLinkHtml, "utf8");

console.log(`✓ Wrote ${outDir}/magic-link.html`);
console.log(
  "  Paste contents into Supabase → Auth → Email Templates → Magic Link."
);
