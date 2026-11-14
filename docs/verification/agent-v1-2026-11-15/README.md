# Agent V1 真实联调证据

日期：2026-11-15（北京时间）。本地生产服务 `http://127.0.0.1:3115`，基线 `8206664` 上的本轮开发代码。记录真实网站请求和真实 DeepSeek 调用，不模拟工具执行或模型响应，不自动重复付费请求。这里不代表公网部署、实体手机或大陆运营商验收。

## API 执行记录

- [ai-live.json](ai-live.json)：普通冬至知识问答 HTTP200（约3.2秒），没有地图操作。复杂问题实际执行节气查询、案例查询、比较、地图展示和打开案例，但漏调高亮工具；因此严格断言失败，未把口头“高亮”当作已执行。该轮多轮追问没有继续执行。
- [ai-live-recheck.json](ai-live-recheck.json)：提示词修正后的复杂问题 HTTP200（约7.3秒），真实执行 `get_solar_term_info`、`compare_cultural_cases`、`show_cultural_map`、`highlight_regions`、`open_cultural_case`，返回切换冬至、江苏浙江高亮、打开三门祭冬三条操作，两省案例来源完整。随后饮食类追问 HTTP502 `CASE_ANSWER_UNSUPPORTED`（约7.7秒），拒绝了无法对应本轮案例的引用；未伪造成功结果。
- [followup-recheck.json](followup-recheck.json)：修正多轮旧编号干扰后，仅复测一次饮食类追问，使用上述真实比较回答作为历史，HTTP200（约5.9秒）。实际执行比较工具，引用仅江苏姑苏冬酿酒，明确浙江当前没有符合饮食类别的已核实案例；没有将三门祭冬混入饮食资料。该记录保留 `historyEvidence` 指向原始真实回答。

最终所需 API 场景已分别通过：普通知识见首轮index1，完整多工具场景见复测index2，类别多轮追问见最后单项复测。不是每次请求从未失败的连续稳定性声明；两轮真实失败与对应修正均保留。

运行数据与 Git 基线逐项一致：77 verified、2 pending，归一化 JSON SHA-256 为 `b2443abb1c94fb9b6391cd191a8659bd0664b82119984d3b9ce36c9ffef50f4c`。饮食类别的真实数据边界是江苏姑苏冬酿酒有记录、浙江冬至暂没有 food 类记录，不能把三门祭冬改算饮食案例。

## 浏览器执行记录

- [browser/browser.json](browser/browser.json)：首次在书册照片检查提前停止，没有发起 AI 请求。问题是测试只接受相对 src，而页面正常使用绝对本站 URL；仅修正断言为核对 URL pathname。
- [browser-recheck/browser.json](browser-recheck/browser.json)：修正检查后整轮通过，所有 API 均使用真实服务，没有路由拦截或接口 mock。

已通过的真实交互：

1. 首页、四时、知时、造物、关于均200，所测桌面页面无横向溢出；公开案例总数77，两个 pending 详情404。
2. 四时目录实际切到冬至，对应冬至高清照片。
3. 在云间问四时真实输入复杂问题。模型自主执行比较、地图、节气信息、高亮和打开案例；界面显示实际工具状态、江苏浙江分组及真实原文入口。
4. 实际点击“在地图中查看”，一次应用冬至节气、江苏浙江两省高亮及三门祭冬详情，地区选择为浙江。
5. 将同一真实会话改为393×851手机视口，仍能阅读案例卡并点击制卡；造物页收到三门祭冬/冬至参数，实际点击生成后得到三组 DeepSeek 文案，参考资料只包含三门祭冬。
6. 另一轮真实问题等待期间手动将地图切换清明。回答回来后保留清明选择，旧操作按钮禁用，明确提示基于之前地图选择；没有覆盖新地图。
7. 页面异常0、失败资源0；所测手机页面无整体横向溢出。

已实际查看桌面工具界面和手机案例卡、造物、过期提示截图。聊天内容使用独立滚动区；手机结果是浏览器视口，不能当作实体手机触摸验收。

截图位于 [browser-recheck](browser-recheck/)：`desktop-tools.png`、`desktop-map.png`、`mobile-tools.png`、`mobile-studio.png`、`mobile-stale.png`。

## 复现

```powershell
# 实际AI请求，会消耗模型额度；每次指定新输出，不覆盖历史记录。
node tests/agent-live.mjs http://127.0.0.1:3115 <新的输出JSON路径>

# 单独复测多轮追问，沿用保存的真实比较回答，只发起一次新请求。
node tests/agent-live.mjs http://127.0.0.1:3115 <新的追问输出JSON路径> 3 docs/verification/agent-v1-2026-11-15/ai-live-recheck.json

# 已有Playwright包，不改项目依赖；真实浏览器一轮包含两次聊天和一次造物生成。
$env:PLAYWRIGHT_MODULE_PATH = '<本机已有playwright-core绝对目录>'
node tests/agent-browser.mjs http://127.0.0.1:3115 <新的输出目录>
```

浏览器完整链路在引用修正前的本轮版本通过；最后修正涉及服务端历史来源编号清理及提示词，137项测试、Lint、构建由主任务复查通过，真实类别追问再单独通过，未重复计费重跑整套浏览器。后续修订后的定向复测应追加新文件，保留上述失败。最终验收状态以更新后的项目进度文档及后续记录为准，不能仅凭其中一次200认为每个环节均通过。
