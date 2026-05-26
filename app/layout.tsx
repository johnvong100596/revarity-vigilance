import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is loaded with the full weight range for Apple/Tesla-style hierarchy:
// 300 light body, 400 default, 500 mid, 600 emphasis, 700 hero, 800 ultra-hero.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vigilance — Watch your money. Or watch it drift.",
  description:
    "A 30-second daily ritual against financial drift. Multi-account check-in, CFO-grade hints, weekly reckoning, monthly close.",
  // PWA — manifest auto-emits via app/manifest.ts. Apple-specific tags
  // below activate the home-screen-installable experience on iOS.
  appleWebApp: {
    capable: true,
    title: "Vigilance",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F1EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
