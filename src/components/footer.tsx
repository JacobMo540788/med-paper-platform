import { SITE_SUBTITLE } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-auto border-t py-8">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>MedFrontier · {SITE_SUBTITLE}</p>
        <p className="mt-1">数据来源：PubMed · Europe PMC · CrossRef · 权威指南机构官网 · 仅供科研与学术参考</p>
      </div>
    </footer>
  );
}
