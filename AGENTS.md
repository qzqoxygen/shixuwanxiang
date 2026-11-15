# 时序 AI：后续任务必读

这是参加传智杯 AI 赛道的二十四节气文化探索与创作项目，使用 Next.js App Router、TypeScript 和 DeepSeek 官方 API。当前能力与证据以 [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) 为项目记忆入口；开始任务先阅读，再核对当前 Git 状态及相关代码。README、协议草案和旧验收报告包含历史状态，不能据其重复开发或断言已上线。

- 保留中国风设计、六个页面（含 `/visit` 节气探访）、24 节气书册及导读、真实省级地图、文化案例、知时问答、造物编辑与导出；仅按本轮授权范围修改，不顺手重构。
- 所有大语言模型调用统一走服务端 `lib/server/deepseek.ts`，当前配置 `deepseek-flash`、`https://api.deepseek.com`、`DEEPSEEK_API_KEY`。不得擅自换服务商、读取并展示密钥，或把服务端密钥放入客户端、日志和版本库；保留 `.env.local` 及其忽略规则。
- `data/cultural-cases/cases.json` 是案例运行数据源。只公开及提供 AI 使用 verified，pending 详情返回 404；保持稳定 ID、来源和地域限定，不造数据补空结果，不加入未授权图片。`primary.json` 是编辑台账；补充数据须维护完整导入审核链。
- 已有六个真实 Agent 工具、聊天 V1 核心协议、地区比较、用户确认的白名单地图批次，以及案例卡定位和制卡入口。复用现有闭环；地图操作须两端校验、原子应用，并用 revision 拒绝过期批次。非流式工具结果不等于执行中的实时事件流。
- 普通知识、归档案例和实时搜索来源要明确区分。保留真实搜索与失败降级；没有本轮搜索结果不得声称已联网，不用模拟回答替代真实 AI 请求。
- 本地检索采用轻量规则、中文分词与别名，称为“基于本地知识库的检索增强生成”，不是向量 RAG。证据检查只证明 canonical 实体字段、归属和引用关联，不能宣称逐句历史解释已经证实。
- 新聊天依据仅对 V1 `includeEvidence:true` 请求返回，保留旧客户端响应结构；只复用本请求内成功且参数相同的只读工具，地图动作仍由用户确认。评测入口 `npm run eval:ai` 默认不调用模型；`--live` 才消耗真实额度，失败及复测须分别保存。
- Netlify 是当前优先部署路线，Vercel 保留备用，Docker/Caddy 模板也应保留；不要将动态 Next.js 项目改成纯静态。部署配置、云端发布与 Git 提交/推送/合并按用户本轮授权执行。
- 先理解再修改，保持改动简单且范围精确，按目标验证。报告分别写明本地实现、模拟测试、真实 API、浏览器/真机和公网部署状态；不得用构建通过替代这些验收。
- 新增、修改、移除或停用重要功能时，同步维护 `docs/PROJECT_STATUS.md` 的功能状态、代码入口、数据流、测试证据和限制，注明日期及核对提交；历史证据保留原日期，不覆盖失败记录。
- Git 提交、推送、创建 PR、合并与部署以用户当次授权为准；本轮赛前 AI 升级已授权独立分支提交/推送/PR，未授权自动合并或部署。

以下 Next.js 自动维护规则保留，涉及代码修改时仍需遵循。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
