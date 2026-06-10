# MedFrontier 医学前沿文献平台

MedFrontier 会从 PubMed、Europe PMC 和 CrossRef 抓取医学论文，校验 PMID/DOI/期刊/发表时间等真实元数据，并按影响因子、科室和研究类型整理为首页推荐、历史文献库和核心文献库。

## 当前规则

- 收录科室：肿瘤科（结直肠）、眼科、消化内科、泌尿外科、肾内科。
- 首页每天只推荐 1 篇文章。
- 新文献和历史文献门槛：IF > 15。
- 核心文献库门槛：近 15 年，IF >= 15，以真实期刊 IF 映射为准。
- AI 只负责翻译、摘要和结构化分析，不允许生成 DOI、PMID、期刊名、发表日期或 IF。

## 每日推荐逻辑

每日推荐任务按北京时间 07:00 执行，顺序如下：

1. 优先选择过去 24 小时新抓取或新发表的高 IF 文献。
2. 当天没有合格新文献时，从近 10 年历史文献库中选择 1 篇。
3. 历史库也没有合适文章时，从核心文献库中选择 1 篇经典文献重读。

科室轮换：

- 周一：肿瘤科（结直肠）
- 周二：眼科
- 周三：消化内科
- 周四：泌尿外科
- 周五：肾内科
- 周六：全科室综合最高分
- 周日：核心文献重读

推荐记录会写入 `DailyRecommendation` 表，并更新文章的 `lastRecommendedAt`、`recommendCount` 和 `recommendSource`，避免短期重复推荐。

## 常用接口

- `GET /api/recommendation/today`：查看今日推荐。
- `POST /api/jobs/run-daily-recommendation`：手动触发每日推荐选择。
- `GET /api/recommendation/history`：分页查看每日推荐历史。
- `POST /api/cron/daily-fetch?secret=CRON_SECRET`：手动触发每日抓取和推荐流程。

## 本地运行

PowerShell 如果禁止运行 `npm.ps1`，请使用 `npm.cmd`。

```bash
npm.cmd install
npm.cmd run db:generate
npm.cmd run dev
```

常用维护命令：

```bash
npm.cmd run import:core-reviews -- --page-size=80 --pages=4
npm.cmd run repair:impact-factors
npm.cmd run generate:ai-analysis -- --limit=10
npm.cmd run test:verification
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

## 部署提醒

Netlify 构建只执行 `prisma generate && next build`，不会自动修改数据库结构。新增迁移后，需要先对 Neon 数据库执行：

```bash
npx.cmd prisma migrate deploy
```

## 医学内容声明

本站内容来自公开学术数据库，并经过程序化真实性校验和 AI 辅助整理，仅用于科研学习参考，不构成医疗诊断或治疗建议。
