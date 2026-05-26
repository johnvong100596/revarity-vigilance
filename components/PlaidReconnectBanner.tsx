import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface PlaidReconnectBannerProps {
  banks: { id: string; institutionName: string | null; status: string }[];
}

/**
 * Renders at the top of /app home when one or more Plaid connections have
 * gone into 'error' or 'disconnected' state (usually because the user
 * changed their bank password). Single CTA back to Settings where they
 * can disconnect + reconnect.
 */
export function PlaidReconnectBanner({ banks }: PlaidReconnectBannerProps) {
  if (banks.length === 0) return null;

  const label =
    banks.length === 1
      ? `${banks[0].institutionName ?? "A bank"} needs to reconnect`
      : `${banks.length} banks need to reconnect`;

  return (
    <Link
      href="/app/settings"
      className="mb-6 flex items-start gap-3 rounded-card border border-negative/30 bg-negative/5 p-4 transition hover:bg-negative/10"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
      <div className="flex-1 text-sm">
        <div className="font-semibold text-text-primary">{label}</div>
        <div className="mt-0.5 text-xs text-text-secondary">
          Your sign-in might have changed. Tap to reconnect — your balances
          stop updating until you do.
        </div>
      </div>
      <div className="self-center text-xs font-semibold text-negative">
        Fix →
      </div>
    </Link>
  );
}
