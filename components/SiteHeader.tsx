"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "首页" }, { href: "/seasons", label: "四时" },
  { href: "/explore", label: "知时" }, { href: "/studio", label: "造物" },
  { href: "/about", label: "关于" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  return <header className="site-header">
    <Link className="brand" href="/" aria-label="时序万象·AI 首页">时序万象<span className="seal">AI</span></Link>
    <nav aria-label="主导航">{links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>
  </header>;
}
