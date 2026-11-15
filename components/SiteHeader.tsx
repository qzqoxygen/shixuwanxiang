"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site-name";
import "./SiteHeader.css";

const links = [
  { href: "/", label: "首页" }, { href: "/seasons", label: "四时" },
  { href: "/explore", label: "知时" }, { href: "/visit", label: "节气探访" },
  { href: "/studio", label: "造物" },
  { href: "/about", label: "关于" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  return <header className="site-header">
    <Link className="brand" href="/" prefetch={false} aria-label={`${SITE_NAME} 首页`}>
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>{SITE_NAME}</span>
    </Link>
    <nav className="site-nav" aria-label="主导航">{links.map(({ href, label }) => <Link key={href} href={href} prefetch={false} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>
  </header>;
}
