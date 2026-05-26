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

interface MonthlyCloseEmailProps {
  displayName: string;
  monthLabel: string; // "May 2026"
  netWorthChange: string;
  netWorthChangeIsPositive: boolean;
  hintsFired: number;
  hintsResolved: number;
  bestStreakDay: string | null;
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

export default function MonthlyCloseEmail({
  displayName = "there",
  monthLabel = "this month",
  netWorthChange = "+$0",
  netWorthChangeIsPositive = true,
  hintsFired = 0,
  hintsResolved = 0,
  bestStreakDay = null,
  deepLink = "https://vigilance.revarity.com/app/close",
}: MonthlyCloseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{monthLabel} Close — {netWorthChange} on net worth</Preview>
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
            Monthly Close · {monthLabel}
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              margin: "0 0 16px",
            }}
          >
            {displayName}, lock the month.
          </Text>

          <Text
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: netWorthChangeIsPositive ? PALETTE.teal : PALETTE.red,
              fontVariantNumeric: "tabular-nums",
              margin: "24px 0 4px",
            }}
          >
            {netWorthChange}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: PALETTE.textSecondary,
              margin: "0 0 32px",
            }}
          >
            net worth change month-over-month
          </Text>

          <Hr
            style={{
              border: "none",
              borderTop: `1px solid ${PALETTE.border}`,
              margin: "24px 0",
            }}
          />

          <Text
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: PALETTE.textSecondary,
              margin: "0 0 4px",
            }}
          >
            Hints surfaced: <strong style={{ color: PALETTE.textPrimary }}>{hintsFired}</strong>
            <br />
            Hints acted on: <strong style={{ color: PALETTE.textPrimary }}>{hintsResolved}</strong>
            {bestStreakDay && (
              <>
                <br />
                Most engaged day: <strong style={{ color: PALETTE.textPrimary }}>{bestStreakDay}</strong>
              </>
            )}
          </Text>

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
              Run Monthly Close
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
            You&apos;re getting this because monthly reminders are on. Turn off
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
