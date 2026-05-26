"use client";

import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";

interface ReferralCardProps {
  referralToken: string;
  invitedCount: number;
  siteUrl: string;
}

/**
 * Settings card showing the user's own referral link + the count of
 * people they've successfully invited. Tap to copy.
 */
export function ReferralCard({
  referralToken,
  invitedCount,
  siteUrl,
}: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const url = `${siteUrl}/r/${referralToken}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers: select-text + alert
      window.prompt("Copy your invite link:", url);
    }
  }

  return (
    <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        <Users className="h-3 w-3" />
        Invite a friend
      </div>
      <p className="mb-3 text-xs leading-relaxed text-text-muted">
        Share this link. When they sign up, you both show up in each
        other&apos;s referral list — early users get founder cred.
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="group flex w-full items-center justify-between gap-2 rounded-md border border-text-primary/12 bg-bg-primary px-3 py-2.5 text-left transition hover:border-accent-primary/40"
      >
        <code className="truncate text-xs text-text-primary">{url}</code>
        <span className="shrink-0 text-text-secondary transition group-hover:text-accent-primary">
          {copied ? (
            <Check className="h-4 w-4 text-positive" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </span>
      </button>
      {invitedCount > 0 && (
        <p className="mt-3 text-[11px] text-text-secondary">
          <span className="font-semibold text-text-primary tabular-nums">
            {invitedCount}
          </span>{" "}
          {invitedCount === 1 ? "friend has" : "friends have"} signed up so far.
        </p>
      )}
    </div>
  );
}
