import Link from "next/link";
import { RESOURCE_NAV, SITE_NAME } from "@/lib/constants";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0 font-serif text-xl font-bold tracking-tight text-primary">
          {SITE_NAME}
        </Link>
        <nav className="hidden min-w-0 items-center gap-4 overflow-x-auto text-sm md:flex">
          {RESOURCE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-2 text-xs md:hidden">
            <Link href="/search" className="text-muted-foreground">
              搜索
            </Link>
            <Link href="/guidelines" className="text-muted-foreground">
              指南
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
