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

interface WorkspaceInviteEmailProps {
  inviterName: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
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

export default function WorkspaceInviteEmail({
  inviterName,
  workspaceName,
  role,
  acceptUrl,
}: WorkspaceInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to {workspaceName} on Vigilance
      </Preview>
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
              Workspace invite
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: PALETTE.textPrimary,
                margin: "0 0 12px",
              }}
            >
              Join {workspaceName}.
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: PALETTE.textSecondary,
                margin: "0 0 32px",
              }}
            >
              {inviterName} invited you to share the connected banks,
              balances, and hints in {workspaceName} on Vigilance. Your role
              will be <strong>{role}</strong>.
            </Text>

            <Button
              href={acceptUrl}
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
              Accept invite
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
                href={acceptUrl}
                style={{
                  color: PALETTE.textSecondary,
                  wordBreak: "break-all",
                  fontSize: 11,
                }}
              >
                {acceptUrl}
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
            If you weren&apos;t expecting this, ignore it — nothing is
            shared until you accept.
            <br />
            <br />
            Vigilance · built by Revarity
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
