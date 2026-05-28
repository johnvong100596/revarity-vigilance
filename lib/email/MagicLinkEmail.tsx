import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/**
 * Magic-link sign-in email rendered to HTML by scripts/render-emails.mjs
 * and pasted into Supabase Auth → Email Templates → Magic Link.
 *
 * The {{ .ConfirmationURL }} variable is Supabase / GoTrue templating
 * (Go's text/template syntax) — it gets interpolated at send time with
 * the actual one-time sign-in URL. Don't touch the casing.
 */

interface MagicLinkEmailProps {
  // When previewing locally this prop fills in for the GoTrue variable.
  // When emitted via render-emails.mjs the placeholder string is left
  // as-is for Supabase to substitute.
  confirmationUrl?: string;
}

const PALETTE = {
  cream: "#F5F1EB",
  white: "#FFFFFF",
  red: "#F04E37",
  textPrimary: "#1A1A1A",
  textSecondary: "#595959",
  textMuted: "#8C8C8C",
  border: "rgba(26,26,26,0.10)",
};

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif';
// Marketing/document surfaces use Fraunces for headings; email clients can't
// load it, so headings fall back to an email-safe serif (THESIS.md split).
const HEADING_FONT = 'Georgia, Cambria, "Times New Roman", serif';

export default function MagicLinkEmail({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Vigilance sign-in link</Preview>
      <Body
        style={{
          backgroundColor: PALETTE.cream,
          fontFamily: FONT_STACK,
          margin: 0,
          padding: "32px 16px",
          color: PALETTE.textPrimary,
        }}
      >
        <Container
          style={{
            maxWidth: 480,
            margin: "0 auto",
            backgroundColor: PALETTE.white,
            borderRadius: 14,
            border: `1px solid ${PALETTE.border}`,
            padding: "40px 32px",
          }}
        >
          <Section>
            <Text
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: PALETTE.red,
                textTransform: "uppercase",
                margin: "0 0 24px",
              }}
            >
              Vigilance
            </Text>
            <Text
              style={{
                fontFamily: HEADING_FONT,
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                color: PALETTE.textPrimary,
                margin: "0 0 12px",
              }}
            >
              Your sign-in link
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: PALETTE.textSecondary,
                margin: "0 0 32px",
              }}
            >
              Tap the button below to sign in to Vigilance. The link works for
              one hour, then expires.
            </Text>

            <Button
              href={confirmationUrl}
              style={{
                display: "inline-block",
                backgroundColor: PALETTE.red,
                color: PALETTE.white,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                padding: "14px 28px",
                borderRadius: 999,
              }}
            >
              Sign in to Vigilance
            </Button>

            <Text
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: PALETTE.textMuted,
                margin: "32px 0 0",
              }}
            >
              Button not working? Paste this link into your browser:
              <br />
              <a
                href={confirmationUrl}
                style={{
                  color: PALETTE.textSecondary,
                  wordBreak: "break-all",
                  fontSize: 11,
                }}
              >
                {confirmationUrl}
              </a>
            </Text>
          </Section>

          <Hr
            style={{
              border: "none",
              borderTop: `1px solid ${PALETTE.border}`,
              margin: "32px 0 24px",
            }}
          />

          <Text
            style={{
              fontSize: 11,
              lineHeight: 1.6,
              color: PALETTE.textMuted,
              margin: 0,
            }}
          >
            If you didn&apos;t request this email, ignore it — your account
            stays safe. The link can only sign in the person who has it.
            <br />
            <br />
            Vigilance · built by Revarity
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
