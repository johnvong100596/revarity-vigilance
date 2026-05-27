import { cn } from "@/lib/utils";

interface BankIconProps {
  /** base64 PNG from Plaid (no data: prefix), or null for the fallback */
  logoBase64?: string | null;
  /** institution brand hex color, used to tint the fallback square */
  colorPrimary?: string | null;
  /** account or institution name — first letter is used in the fallback */
  label: string;
  /** pixel size of the square */
  size?: number;
  className?: string;
}

/**
 * Institution logo with a graceful fallback. When Plaid has a logo we
 * render it on a white rounded square; otherwise we render a cream
 * square with the first letter of the name (legacy / no-logo accounts).
 * The fallback tints toward the brand color when one is known.
 */
export function BankIcon({
  logoBase64,
  colorPrimary,
  label,
  size = 32,
  className,
}: BankIconProps) {
  const radius = Math.round(size * 0.28);
  const letter = (label?.trim()?.[0] ?? "?").toUpperCase();

  if (logoBase64) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden border border-text-primary/8 bg-white",
          className
        )}
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${logoBase64}`}
          alt=""
          width={Math.round(size * 0.72)}
          height={Math.round(size * 0.72)}
          style={{ objectFit: "contain" }}
        />
      </span>
    );
  }

  // Fallback: cream square, first letter, optional brand tint
  const tint = colorPrimary ?? undefined;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border border-text-primary/8 bg-bg-secondary font-semibold text-text-secondary",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.round(size * 0.42),
        color: tint,
        borderColor: tint ? `${tint}33` : undefined,
        backgroundColor: tint ? `${tint}12` : undefined,
      }}
    >
      {letter}
    </span>
  );
}
