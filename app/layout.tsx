import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "时序万象·AI", template: "%s · 时序万象·AI" },
  description: "基于多模态智能体的二十四节气非遗文化可视化探索与交互创作平台。当前开放节气基础资料与 AI 文化问答。",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><div className="page-shell">
    <a className="skip-link" href="#main-content">跳至主要内容</a>
    <SiteHeader />
    <main id="main-content">{children}</main>
    <footer className="site-footer"><span>时序万象·AI · 观天时，知四季</span><span>以文化为根，以好奇为始</span></footer>
  </div></body></html>;
}
