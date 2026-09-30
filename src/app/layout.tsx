import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JH One AI — by JH Soft Corporation",
  description: "Your intelligent AI assistant powered by multiple AI engines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
