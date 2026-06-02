"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "./ui/button";

export function FavoriteButton({ articleId }: { articleId: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const email = localStorage.getItem("medfrontier_email");
    if (!email) {
      const input = window.prompt("请输入邮箱以收藏论文（仅保存在本浏览器）");
      if (!input?.includes("@")) return;
      localStorage.setItem("medfrontier_email", input.trim());
    }
    const userEmail = localStorage.getItem("medfrontier_email");
    if (!userEmail) return;

    setLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, articleId }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={loading || saved}
      className="gap-2"
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-red-500 text-red-500" : ""}`} />
      {saved ? "已收藏" : loading ? "收藏中..." : "收藏论文"}
    </Button>
  );
}
