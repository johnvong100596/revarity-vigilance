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

export interface SendResult {
  sent: boolean;
  /** True when we deliberately didn't try (no API key configured) — this
   *  is NOT a failure. Cron logs use it to distinguish "Resend isn't set
   *  up yet" from "the send attempt errored". */
  skipped?: boolean;
  id?: string;
  reason?: string;
}

/**
 * Renders a React Email component to HTML and sends via Resend.
 *   - { sent: true, id }            success
 *   - { sent: false, skipped: true} Resend not configured (no key) — benign
 *   - { sent: false, reason }       a real send failure
 * Cron handlers swallow failures so the batch continues for other users.
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
}): Promise<SendResult> {
  const c = client();
  if (!c) {
    return { sent: false, skipped: true, reason: "RESEND_API_KEY not set" };
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
