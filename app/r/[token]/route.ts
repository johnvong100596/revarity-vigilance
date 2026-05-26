import { NextResponse, type NextRequest } from "next/server";

/**
 * Referral capture endpoint. /r/<token> sets a cookie with the token
 * then redirects to /signup. The /callback route reads the cookie at
 * sign-in time and persists invited_by_user_id on the new user's
 * profile.
 *
 * Cookie expires in 30 days — generous window for the invitee to
 * actually complete signup.
 */
const COOKIE_NAME = "vig_ref";
const COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token.trim();
  if (!token || token.length < 4 || token.length > 64) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const response = NextResponse.redirect(new URL("/signup", req.url));
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_TTL_SECONDS,
    path: "/",
  });

  return response;
}

export { COOKIE_NAME as REFERRAL_COOKIE };
