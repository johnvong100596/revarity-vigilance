import { ImageResponse } from "next/og";

// Favicon — Next auto-serves this at /icon and emits <link rel="icon">
// on every page. Replaces the create-next-app default favicon.ico that
// shipped with the scaffold.
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 24,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: "-1px",
          lineHeight: 1,
        }}
      >
        V
      </div>
    ),
    { ...size }
  );
}
