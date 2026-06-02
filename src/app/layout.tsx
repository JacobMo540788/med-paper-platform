import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MedFrontier | 医学前沿研究自动推送",
    template: "%s | MedFrontier",
  },
  description:
    "每日自动推送肿瘤科、眼科、消化内科、泌尿外科、肾内科高影响因子医学前沿论文，含 AI 智能分析与中英双语摘要。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
    siteName: "MedFrontier",
    title: "MedFrontier | 医学前沿研究自动推送",
    description: "高 IF 医学论文每日精选 · AI 分析 · 中英双语",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
