import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "首页" },
  { href: "/search", label: "搜索" },
  { href: "/specialty/oncology-colorectal", label: "肿瘤科" },
  { href: "/specialty/ophthalmology", label: "眼科" },
  { href: "/specialty/gastroenterology", label: "消化内科" },
  { href: "/specialty/urology", label: "泌尿外科" },
  { href: "/specialty/nephrology", label: "肾内科" },
  { href: "/about", label: "关于" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="font-serif text-xl font-bold tracking-tight text-primary">
          MedFrontier
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
