"use client";

import { useState } from "react";
import { Button } from "./ui/button";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ email, specialty: "UROLOGY" }),
    });
    setStatus(res.ok ? "ok" : "err");
    if (res.ok) localStorage.setItem("medfrontier_email", email);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">邮件订阅（泌尿外科更新）</h3>
      <p className="text-sm text-muted-foreground">
        订阅后可接收泌尿外科指南与研究证据更新。邮件发送需要部署环境配置 SMTP。
      </p>
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        aria-label="订阅邮箱"
      />
      <Button type="submit">订阅</Button>
      {status === "ok" && <p className="text-sm text-emerald-600">订阅成功！</p>}
      {status === "err" && <p className="text-sm text-red-600">订阅失败，请检查邮箱或数据库连接。</p>}
    </form>
  );
}
