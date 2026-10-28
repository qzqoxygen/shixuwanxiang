# 时序万象·AI

二十四节气非遗文化探索平台的 V2 基础工程。当前开放节气资料与 DeepSeek 文化问答；地图、技艺交互和创意工坊尚未开发。

## 本地运行

保留本地 .env.local 中的 DEEPSEEK_API_KEY，密钥仅供服务端读取，不应提交到版本库。
首次恢复或获取源码时使用 npm ci；已有依赖无需重复安装。

```powershell
npm.cmd run dev
```

打开终端给出的本地地址。五个页面：/、/seasons、/explore、/studio、/about。
在 /seasons 切换节气；在 /explore 输入“什么是冬至？”，再追问“它和夏至有什么区别？”。
真实聊天需要有效密钥、余额和网络。失败显示真实错误，不返回演示答案。

## 检查

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

测试使用 Node >=22.15（当前本机为 Node 24）和已安装的 TypeScript，无额外依赖。
测试网络为隔离模拟，仅用于校验 SDK 请求序列化和错误分支；产品代码调用真实 DeepSeek。

## 结构与扩展

- app/：五个页面、公共布局和 api/chat 路由。没有 src/。
- components/SiteHeader.tsx：公共导航及当前页面状态。
- components/SolarTermsExplorer.tsx：24节气选择与基础信息。
- lib/solar-terms.ts：独立、稳定的节气 ID，预留 culturalCaseIds 关联字段；没有虚构文化案例。
- components/ChatPanel.tsx：多轮聊天、加载、取消及错误提示。
- lib/ai-agent.ts：保留通用工具注册接口与有限轮次执行流程；当前注册表为空，API不发送tools。后续增加工具需要单独开发、校验和验收。
- app/explore/page.tsx：独立地图占位区域，便于后续替换；当前没有地图数据或地图API。
- tests/：节气数据、聊天、通用执行流程与错误处理测试。

DeepSeek 配置保持 https://api.deepseek.com、deepseek-flash、thinking.type=disabled。
当前只传最近5轮历史与新问题，单次问题最多1000个UTF-16字符单元。聊天内容不写入数据库。

## 安全保存

改造前没有 Git 仓库。2026-10-28 已将30个源码、配置、测试与资源文件备份到：
D:\projects\backups\shixu-demo-pre-v2-20261028\shixu-demo-pre-v2.zip

备份已解压并逐文件核对SHA256，不含.env文件、node_modules或构建缓存。
恢复应先解压到新文件夹，安装锁定依赖，并自行沿用安全保存的环境配置。
建议后续初始化Git并建立本地基线提交；现有.gitignore已排除.env*，本次未创建Git提交。

## 资料来源

- [UNESCO 二十四节气介绍](https://ich.unesco.org/en/RL/00647)
- [香港天文台：二十四节气](https://www.hko.gov.hk/tc/gts/time/24solarterms.htm)

文化案例后续应独立记录地区、出处、链接、整理日期和授权信息；基础知识、模型回答与授权素材应明确区分。
