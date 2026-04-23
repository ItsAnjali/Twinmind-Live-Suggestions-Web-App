import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Twinmind — Live Audio Suggestions",
  description:
    "Listen to live audio, transcribe in chunks, and surface 3 fresh, context-aware suggestions every ~30 seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-slate-100">{children}</body>
    </html>
  );
}
