# MedFrontier 泌尿外科指南与研究证据平台

MedFrontier 专注泌尿外科临床指南、临床研究、基础研究和刘犇教授课题组成果。平台复用 PubMed、Europe PMC、CrossRef、Prisma 和 Next.js 数据流程，所有公开记录都必须通过 DOI、PMID、机构官网或正式出版页面核验。

## 核心规则

- 网站定位：泌尿外科指南与研究证据平台。
- 时间窗：近5年为滚动窗口，从执行当天向前推5年，代码动态计算。
- 临床研究与基础研究：正式列表要求 JIF >= 10，且 JIF 状态为 `VERIFIED`。
- 指南：不虚构 IF；无期刊 JIF 时标记 `IF 不适用` 或 `IF 待核验`。
- JIF：仅指 Clarivate Journal Citation Reports 的 Journal Impact Factor。
- 刘犇教授课题组：只导入 `data/liu-ben-lab-disambiguation.json` 中经过人工确认、且具有 DOI/PMID 与单位、邮箱或共同作者网络证据的记录；禁止根据短姓名自动合并。

## 主要页面

- `/` 首页资源总览
- `/guidelines` 临床指南
- `/clinical-research` 临床研究
- `/basic-research` 基础研究
- `/liu-ben-lab` 刘犇教授课题组
- `/search` 全站搜索
- `/about` 关于

旧学科路由已废弃：`/specialty/urology` 会重定向到临床研究，其它旧学科返回 404。

## 常用命令

PowerShell 禁止 `npm.ps1` 时，请使用 `npm.cmd`。

```bash
npm.cmd install
npm.cmd run db:generate
npm.cmd run import:urology-resources -- --page-size=80 --pages=2
npm.cmd run import:liu-ben-lab
npm.cmd run repair:impact-factors
npm.cmd run test:verification
npm.cmd run test:urology
npm.cmd run build
```

## 环境变量

```env
DATABASE_URL=postgresql://...
CRON_SECRET=your-secret
NEXT_PUBLIC_SITE_URL=https://med-paper-platform.netlify.app

LLM_API_BASE=https://api.deepseek.com
LLM_API_KEY=your-deepseek-key
LLM_MODEL=deepseek-chat

```

## 数据库迁移

Netlify 构建只执行 `prisma generate && next build`，不会自动修改数据库结构。新增迁移后需要先对 Neon 执行：

```bash
npx.cmd prisma migrate deploy
```

## 医学内容声明

本站内容仅供科研与学术参考，不构成医疗诊断或治疗建议。AI 只用于翻译、摘要和结构化分析，不生成 DOI、PMID、作者、期刊、发布日期或影响因子。
