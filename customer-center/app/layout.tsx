import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TikRapid 客户中心",
  description: "TikRapid 客户套餐、工单与合规确认中心",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
