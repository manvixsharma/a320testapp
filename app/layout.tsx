import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "A320 MCQ Trainer",
  description: "A320 Technical Systems — Multiple Choice Questions",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="A320 MCQ" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', -apple-system, sans-serif", background: "#12091f" }}>
        {children}
      </body>
    </html>
  );
}
