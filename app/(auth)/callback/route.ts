import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const REFERRAL_COOKIE = "vig_ref";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // After successful session creation, look at the referral cookie. If
  // present AND this is the user's first sign-in (their profile has no
  // invited_by_user_id yet), resolve the token → inviter user_id and
  // persist. Cookie clears either way so we don't reattribute on
  // subsequent sign-ins.
  const refToken = request.cookies.get(REFERRAL_COOKIE)?.value;
  const response = NextResponse.redirect(`${origin}${next}`);

  if (refToken) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        const { data: inviter } = await admin
          .from("profiles")
          .select("id")
          .eq("referral_token", refToken)
          .maybeSingle();
        if (inviter && inviter.id !== user.id) {
          await admin
            .from("profiles")
            .update({ invited_by_user_id: inviter.id })
            .eq("id", user.id)
            .is("invited_by_user_id", null);
        }
      }
    } catch (e) {
      console.error("[callback] referral attribution failed", e);
    }
    response.cookies.set({
      name: REFERRAL_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
    });
  }

  return response;
}
