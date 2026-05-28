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

interface SundayReckoningEmailProps {
  displayName: string;
  netWorthChange: string; // pre-formatted with sign + currency
  netWorthChangeIsPositive: boolean;
  topHints: { body: string; severity: "pay_attention" | "opportunity" | "strategic" }[];
  weekStreak: number;
  deepLink: string;
}

const PALETTE = {
  cream: "#F5F1EB",
  white: "#FFFFFF",
  red: "#F04E37",
  teal: "#1F6E5C",
  textPrimary: "#1A1A1A",
  textSecondary: "#595959",
  textMuted: "#8C8C8C",
  border: "rgba(26,26,26,0.10)",
};

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif';
const HEADING_FONT = 'Georgia, Cambria, "Times New Roman", serif';

export default function SundayReckoningEmail({
  displayName = "there",
  netWorthChange = "+$0",
  netWorthChangeIsPositive = true,
  topHints = [],
  weekStreak = 0,
  deepLink = "https://vigilance.revarity.com/app/reckoning",
}: SundayReckoningEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Sunday Reckoning — {netWorthChange} this week</Preview>
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
            maxWidth: 520,
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
              Sunday Reckoning
            </Text>
            <Text
              style={{
                fontFamily: HEADING_FONT,
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
                margin: "0 0 16px",
              }}
            >
              {displayName}, here&apos;s your week.
            </Text>

            <Text
              style={{
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: netWorthChangeIsPositive ? PALETTE.teal : PALETTE.red,
                fontVariantNumeric: "tabular-nums",
                margin: "20px 0 4px",
              }}
            >
              {netWorthChange}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: PALETTE.textSecondary,
                margin: "0 0 24px",
              }}
            >
              net worth change this week
              {weekStreak > 0 ? ` · ${weekStreak} week streak` : ""}
            </Text>
          </Section>

          {topHints.length > 0 && (
            <>
              <Hr
                style={{
                  border: "none",
                  borderTop: `1px solid ${PALETTE.border}`,
                  margin: "24px 0",
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: PALETTE.textMuted,
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                What needs attention
              </Text>
              {topHints.slice(0, 3).map((h, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `3px solid ${h.severity === "pay_attention" ? "#C8553D" : h.severity === "opportunity" ? PALETTE.red : PALETTE.teal}`,
                    paddingLeft: 12,
                    margin: "0 0 12px",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: PALETTE.textPrimary,
                      margin: 0,
                    }}
                  >
                    {h.body}
                  </Text>
                </div>
              ))}
            </>
          )}

          <Section style={{ textAlign: "center", margin: "32px 0 0" }}>
            <Button
              href={deepLink}
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
              Open Reckoning
            </Button>
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
            You&apos;re getting this because weekly reminders are on. Turn off
            in Settings → Preferences.
            <br />
            <br />
            Vigilance · built by Revarity
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
