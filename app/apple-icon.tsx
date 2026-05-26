import { ImageResponse } from "next/og";

// Apple touch icon — Next auto-serves this at /apple-icon and emits
// <link rel="apple-touch-icon"> on every page. iOS uses this for the
// home-screen icon when the user does "Add to Home Screen".
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#F04E37",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontSize: 132,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: "-6px",
          lineHeight: 1,
        }}
      >
        V
      </div>
    ),
    { ...size }
  );
}
