import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow Automation",
  description: "Claude Code Workflow Automation Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen bg-[#0a0a0a]">
        {children}
      </body>
    </html>
  );
}
