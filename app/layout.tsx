import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./toon.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "晴天生活｜原创生活模拟游戏",
    description: "创建居民、经营关系，在晴天市发现每天的新故事。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "晴天生活", description: "每一天，都是新故事", images: [`${origin}/og.png`] },
    twitter: { card: "summary_large_image", title: "晴天生活", description: "每一天，都是新故事", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
