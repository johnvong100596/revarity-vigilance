import { render } from "@react-email/render";
import { Resend } from "resend";

let resendClient: Resend | null = null;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export const DEFAULT_FROM = "Vigilance <noreply@revarity.com>";

/**
 * Renders a React Email component to HTML and sends via Resend. Returns
 * { sent: true, id } on success, { sent: false, reason } if Resend isn't
 * configured or the send fails. Cron handlers swallow failures so the
 * batch continues for other users.
 */
export async function sendEmail({
  to,
  subject,
  component,
  from = DEFAULT_FROM,
}: {
  to: string;
  subject: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any;
  from?: string;
}): Promise<{ sent: boolean; id?: string; reason?: string }> {
  const c = client();
  if (!c) {
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }
  try {
    const html = await render(component, { pretty: false });
    const res = await c.emails.send({ from, to, subject, html });
    if (res.error) {
      return { sent: false, reason: res.error.message };
    }
    return { sent: true, id: res.data?.id };
  } catch (e) {
    return {
      sent: false,
      reason: e instanceof Error ? e.message : "Unknown send error",
    };
  }
}
