"use client";

import { useState } from "react";
import { Button } from "./ui/button";

const SPECIALTIES = [
  { value: "", label: "全部学科" },
  { value: "ONCOLOGY_COLORECTAL", label: "肿瘤科（结直肠）" },
  { value: "OPHTHALMOLOGY", label: "眼科" },
  { value: "GASTROENTEROLOGY", label: "消化内科" },
  { value: "UROLOGY", label: "泌尿外科" },
  { value: "NEPHROLOGY", label: "肾内科" },
];

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setStatus("err");
      return;
    }
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, specialty: specialty || undefined }),
    });
    setStatus(res.ok ? "ok" : "err");
    if (res.ok) localStorage.setItem("medfrontier_email", email);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">邮件订阅（每日推送）</h3>
      <p className="text-sm text-muted-foreground">
        订阅后将在每日抓取完成后收到邮件（需配置 SMTP，见 .env.example）。
      </p>
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <select
        value={specialty}
        onChange={(e) => setSpecialty(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      >
        {SPECIALTIES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <Button type="submit">订阅</Button>
      {status === "ok" && <p className="text-sm text-emerald-600">订阅成功！</p>}
      {status === "err" && <p className="text-sm text-red-600">订阅失败，请检查邮箱或数据库连接。</p>}
    </form>
  );
}
