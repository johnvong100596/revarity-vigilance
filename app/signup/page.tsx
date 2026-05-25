import { redirect } from "next/navigation";

// /signup is the marketing CTA target; the underlying auth flow is magic link
// (signInWithOtp) which creates accounts on first send. Until we want
// differentiated copy, /signup just routes to /login.
export default function SignupPage() {
  redirect("/login");
}
