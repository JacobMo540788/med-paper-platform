# MedFrontier · 医学前沿研究自动推送平台

每日自动抓取、筛选、分析并推送肿瘤科（结直肠）、眼科、消化内科、泌尿外科、肾内科高影响因子（IF > 15）医学论文。

---

## 一、系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                │
│   首页 / 学科页 / 详情页 / 搜索页 (Next.js 15 SSR)              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Next.js API Routes                              │
│   /api/articles  /api/search  /api/cron/daily-fetch  /favorites   │
└───────┬─────────────────────────────┬─────────────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────┐              ┌──────────────┐
│  PostgreSQL   │              │    Redis     │
│  (Prisma)     │              │  首页缓存     │
└───────────────┘              └──────────────┘
        ▲
        │
┌───────┴───────────────────────────────────────────────────────────┐
│              每日抓取 Pipeline (BullMQ Worker / Cron)              │
│  1. PubMed + Europe PMC 抓取                                      │
│  2. CrossRef DOI 补全                                             │
│  3. 期刊 IF 匹配 (本地表 + DB)                                    │
│  4. IF > 15 筛选 + 基础/临床分类                                  │
│  5. LLM 翻译 + AI 结构化分析                                      │
│  6. 写入 DB + 更新 Redis 缓存                                     │
│  7. 无当日更新 → 回退近10年经典文献                                │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│  外部 API: PubMed E-utilities · Europe PMC · CrossRef · OpenRouter  │
└───────────────────────────────────────────────────────────────────┘
```

### 模块说明

| 模块 | 路径 | 作用 |
|------|------|------|
| 数据抓取 | `src/lib/fetchers/` | PubMed / Europe PMC / CrossRef |
| IF 匹配 | `src/lib/journal-if.ts` | 本地 JSON + JournalIf 表 |
| 分类 | `src/lib/classifier.ts` | 关键词规则分类基础/临床 |
| LLM | `src/lib/llm/` | 翻译 + AI 分析 JSON |
| 流水线 | `src/lib/pipeline/daily-fetch.ts` | 每日任务主流程 |
| 定时 | `src/jobs/worker.ts` | BullMQ 每日北京时间 07:00 自动执行 |

---

## 二、目录结构

```
med-paper-platform/
├── prisma/schema.prisma      # 数据库模型
├── data/journal-impact-factors.json
├── scripts/seed-journals.ts  # 仅同步期刊影响因子，不生成论文元数据
├── src/
│   ├── app/                  # 页面 + API
│   ├── components/           # UI 组件
│   ├── lib/                  # 核心业务逻辑
│   └── jobs/worker.ts        # BullMQ 定时任务
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## 三、浏览器直接打开（不用每天开终端）⭐

详见 **[docs/浏览器直接访问说明.md](docs/浏览器直接访问说明.md)**

1. 双击 `scripts/首次配置-常驻运行.cmd`（只需一次）
2. 以后电脑浏览器打开：**http://localhost:3000**
3. 手机（同一 WiFi）：**http://你的电脑IP:3000**
4. 可选：双击 `scripts/安装开机自启.cmd` 实现开机自动后台运行

---

## 四、开发者快速启动

### 前置要求

- Node.js 20+
- Docker（推荐，用于 PostgreSQL + Redis）

### 1. 安装依赖

```bash
cd med-paper-platform
npm install
cp .env.example .env
```

### 2. 启动数据库

```bash
docker compose up -d postgres redis
```

### 3. 初始化数据库

```bash
npm run db:push
npm run db:seed
```

### 4. 配置 LLM（可选，用于 AI 分析）

在 `.env` 中设置：

```
LLM_API_KEY=你的密钥
LLM_API_BASE=https://openrouter.ai/api/v1
LLM_MODEL=deepseek/deepseek-chat
```

### 5. 启动（推荐：网站 + 自动抓取一起开）

```bash
npm run dev:all
```

会同时启动：
- **网站**（Next.js）
- **定时任务**（每天北京时间 **07:00** 自动抓取，无需你每天手动点）

也可双击 Windows 脚本：`scripts/start-with-auto-fetch.cmd`

> 仅 `npm run dev` 只开网站，**不会**自动定时抓取。

访问终端里显示的地址（如 http://localhost:3000 或 3001）

### 6. 生产环境（Docker 全自动，电脑重启后仍生效）

```bash
docker compose up -d
```

`worker` 容器会常驻并在每天 07:00（北京时间）执行抓取。

### 7. 手动触发（仅测试用，日常不必）

```bash
curl -X POST "http://localhost:3000/api/cron/daily-fetch?secret=你的CRON_SECRET"
```

---

## 五、筛选逻辑

1. **每日抓取**：各学科从 PubMed / Europe PMC 获取近 24 小时论文
2. **IF 筛选**：`impactFactor > 15` 才进入推荐池
3. **顶刊优先**：Nature / Science / Cell / NEJM / Lancet / JAMA / BMJ 及子刊
4. **无更新回退**：当日无合格新文献 → 从库中取近 10 年高 IF 经典文献标记为今日推荐

---

## 六、AI 分析 JSON Schema

```json
{
  "goal": "研究目的（中文一句话）",
  "conclusion": "研究结论（中文一句话）",
  "methods": "研究方法简述",
  "design": ["实验设计1", "实验设计2"],
  "technologies": ["scRNA-seq", "CRISPR"],
  "clinical_significance": "临床意义",
  "keywords_cn_en": [{ "en": "Tumor Microenvironment", "cn": "肿瘤微环境" }]
}
```

Prompt 模板见 `src/lib/llm/prompts.ts`。

---

## 七、预留扩展

- **JCR IF**：`JournalIf` 表可对接 Journal Citation Reports 导入
- **邮件订阅**：`Subscription` 模型已建，SMTP 环境变量已预留
- **微信 / Telegram**：`.env.example` 已预留 Webhook
- **RAG / 向量库**：可在 `Article` 表增加 embedding 字段 + pgvector

---

## 八、生产部署

```bash
docker compose up -d
```

包含：`postgres`、`redis`、`app`（Next.js）、`worker`（BullMQ）。

---

## 免责声明

本平台内容来自公开学术数据库，经 AI 辅助整理，仅供科研学习参考，不构成医疗诊断或治疗建议。
