import type { Metadata } from "next";
import "../styles/main.css";

export const metadata: Metadata = {
  title: "Email Sending Project",
  description: "A simple email campaign dashboard built with Next.js",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
