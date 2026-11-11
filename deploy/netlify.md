# Netlify 部署

当前优先站点为 https://qsxshixu-ai.netlify.app ，项目 ID 为 `51b22dd9-7d6d-4f65-afda-7bacfaa9ae72`。使用 Free 团队计划和本地 CLI 部署，源码仓库为 qzqoxygen/shixu-ai。原 Vercel 项目 qsxshixu-ai 保留备用。

## 构建与发布

使用 Node.js 24 和 Netlify 官方 CLI。根目录的 `netlify.toml` 声明 `npm run build` 和 `.next`，官方 OpenNext 适配器会生成服务端函数、路由规则及实际静态发布目录。App Router、案例接口、DeepSeek 问答和灵感生成均运行在完整 Next.js 环境。

```powershell
npm.cmd ci
npx.cmd netlify-cli login
npx.cmd netlify-cli link --id 51b22dd9-7d6d-4f65-afda-7bacfaa9ae72
npx.cmd netlify-cli deploy --prod --build --context production
```

构建和上传须在同一次 `deploy --build` 中完成，以应用适配器生成的静态发布目录。已有独立 `netlify build` 后直接 `deploy --no-build` 曾出现动态页面正常、脚本与图片 404 的问题。首次验证使用 CLI 27.17.0、Netlify Build 37.7.6、Next.js Runtime 5.16.6，项目不固定运行时适配器版本。

环境变量在 Netlify 项目设置中独立配置，必须覆盖 Functions 运行范围。

| 变量 | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek 官方聊天和搜索密钥 |
| `SHIXU_TRUST_NETLIFY=1` | 限流采用 Netlify 提供的访客 IP |

本地 `.env.local` 保持私密。运行时密钥配置更新后重新部署。部署目录排除本地密钥文件和 `.netlify` 之外的账号配置。服务器模板使用的 `SHIXU_STANDALONE` 与 `SHIXU_TRUST_PROXY` 在此站点保持未设置。

项目配置的 Visitor access 必须允许匿名访客。本次首次创建时继承了团队登录保护，已为此项目取消。浏览器未登录时打开首页应返回 200。账号管理与 GitHub 登录仍遵循 Netlify 原有设置。

## 验收与恢复

```powershell
python scripts/check-public-access.py --host qsxshixu-ai.netlify.app --carrier unknown --output access.json
node scripts/check-public-ai.mjs https://qsxshixu-ai.netlify.app
node tests/cultural-cases-http.mjs https://qsxshixu-ai.netlify.app
```

第一条默认连续20轮，只读请求。运营商标签仅在已确认当前使用的移动、联通或电信线路时填写对应值，标签来自执行者自报。第二条会发起三次真实 AI 访客请求，含两路并发及一次联网问答，会使用服务端 DeepSeek 额度。第三条验证文化案例集合和错误响应。

关闭设备 VPN 和网络代理后，以实体手机和电脑分别打开首页、四时、知时和造物。检查照片、字体、地图省份选择、案例详情、来源链接、AI 回答及生成结果。跨地区和不同时段重复记录，探针首页结果与真机功能验收分别保留。

生产部署和测试证据保存在 `deploy/verification/`。登录保护和缺失静态资源阶段的失败记录分别命名，修复后复测记录单独保存。大陆探针出现过一次电信连接重置，现场网络和实体手机的稳定性仍需人工复验。

本轮全部指标、失败次数及验证边界见 [验收记录](verification/netlify-summary-20261111.md)。当前 Windows 设备的多资源直连也有间歇性连接重置，验收状态为部分通过。

回滚时可在 Netlify Deploys 中选取已验收部署并发布，或检出对应 Git 提交后重复完整发布命令。回滚源代码时，环境变量继续由项目设置管理。备份网址为 https://qsxshixu-ai.vercel.app ，其大陆直连访问仍有失败记录。

[Netlify 官方 Next.js 说明](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) · [CLI 说明](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
