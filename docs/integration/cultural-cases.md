# 文化案例接口联调（V1.0）

本轮基于 `bec7e8e`，开发分支 `codex/cultural-cases`。共享类型、运行时校验、本地读取、列表与详情 GET 已实现；基础聊天、业务工具、页面及样式保持原有行为。本说明与 [协议第 4、5、6、10 节](../contracts/v1.0.md) 配套使用。

## 前端可直接使用的导出

```ts
import {
  CaseListResponseSchema,
  CaseDetailResponseSchema,
  ApiFailureSchema,
  type CulturalCase,
  type VerifiedCulturalCase,
  type CaseListQuery,
  type CaseListResponse,
  type CaseDetailResponse,
} from "@/lib/contracts/cultural-case";
import { SUPPORTED_PROVINCES, type ProvinceCode } from "@/lib/provinces";
import { SOLAR_TERMS, type SolarTermId } from "@/lib/solar-terms";
```

共享模块可供客户端导入，不导入 Node 文件接口、OpenAI、凭据或案例运行数据。省份映射包含 34 个 `{ code, name, featureId }`，与现有地图逐项比对；`100000_JD` 不能作为省份。节气类型直接由现有 `SOLAR_TERMS` 推导。

`CaseListQuery` 是校验后的参数类型，含必有的默认 `offset` / `limit`；构造输入可使用 `CaseListQuerySchema.parse({ solarTermId, provinceCode })`。HTTP query 接受十进制字符串，不能把 `null`、`undefined` 或空的选择值序列化发送；未选择时省略对应参数。

## 调用示例

本地启动：

```powershell
npm.cmd ci
npm.cmd run dev
```

接口不需要 DeepSeek 密钥，不访问模型或来源网站；即使聊天不可用仍可查询。以下 PowerShell 示例假定端口 3000，实际按终端地址调整：

```powershell
# 节气 + 省份 + 类别 + 关键词，条件取交集
$keyword = [uri]::EscapeDataString('青团')
Invoke-RestMethod "http://localhost:3000/api/cultural-cases?solarTermId=qingming&provinceCode=310000&category=food&keyword=$keyword&offset=0&limit=10"

# 详情及来源
Invoke-RestMethod 'http://localhost:3000/api/cultural-cases/shanghai-qingming-qingtuan'

# 合法但尚未收录的条件：200 空列表
Invoke-RestMethod 'http://localhost:3000/api/cultural-cases?solarTermId=qiufen&provinceCode=440000'
```

上海青团请求的完整响应（本批次省略图片字段）：

```json
{
  "version": "1.0",
  "items": [
    {
      "id": "shanghai-qingming-qingtuan",
      "title": "上海清明吃青团",
      "solarTermIds": ["qingming"],
      "provinceCode": "310000",
      "provinceName": "上海市",
      "regionName": "上海市",
      "category": "food",
      "description": "上海有清明食用青团的习俗。资料介绍的一种做法是将草汁与糯米粉拌合，包入甜馅后蒸制，作为清明节令食品。",
      "relationNote": "中国非物质文化遗产网的清明专题文章，在节令食品部分记述上海清明吃青团的习俗。",
      "sources": [
        {
          "title": "梨花落后清明——二十四节气之清明",
          "url": "https://www.ihchina.cn/Article/Index/detail?id=10041",
          "publisher": "中国非物质文化遗产网"
        }
      ],
      "verificationStatus": "verified"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 10
}
```

详情成功为 `{ "version": "1.0", "item": <同一完整案例对象> }`。实际接入时验证 `CaseDetailResponseSchema`，遍历 `item.sources` 展示标题、链接及可选发布者。图片仅在 `item.imageUrl` 存在时展示。

空列表响应：

```json
{ "version": "1.0", "items": [], "total": 0, "offset": 0, "limit": 10 }
```

`offset=100` 等超出末页时 `items` 为空，但 `total` 仍为该筛选条件分页前的真实总数。

`GET /api/cultural-cases?limit=0` 返回 HTTP 400：

```json
{
  "version": "1.0",
  "answer": null,
  "truncated": false,
  "error": { "code": "INVALID_INPUT", "message": "案例查询参数无效，请检查后重试。" }
}
```

`GET /api/cultural-cases/mohe-xiazhi-white-night` 与不存在的 ID 均返回 HTTP 404：

```json
{
  "version": "1.0",
  "answer": null,
  "truncated": false,
  "error": { "code": "CASE_NOT_FOUND", "message": "未找到可公开的文化案例。" }
}
```

内部读取/校验异常返回 HTTP 500 `INTERNAL_ERROR` 和统一提示，不返回底层异常或待核查内容。所有这些 GET 响应均为 JSON，并带 `Cache-Control: no-store`。

## 筛选规则与接入边界

- 仅接受 `solarTermId`、`provinceCode`、`category`、`keyword`、`offset`、`limit`。未知、重复或非法参数返回 400；ID 区分大小写，不自动纠正。
- `offset` 默认为 0，允许十进制非负安全整数；`limit` 默认为 10，范围 1–20。空整数、正负号、浮点与指数写法均不合法。
- `keyword` 去除首尾空白后最长 100 个 UTF-16 单元，空白视为不筛选；仅在标题、地域、描述和节气关联依据四个字段匹配大小写不敏感的字面子串。
- 筛选后按 ID 的 ASCII 升序排序，再分页；`total` 不包含 pending，也不受分页截取影响。
- 详情 ID 由 Next.js 动态路由解码一次后验证；不要在客户端或服务端重复解码。`/%73anmen-jidong` 可定位 `sanmen-jidong`，二次编码后仍含 `%` 的值不合法。ID 不用于拼接文件路径。
- 首批公开 7 条；清明 2、夏至 2、冬至 3、秋分 0。数据整理、待核查及未入库原因见 [12 条资料清单](../cultural-sources/README.md)。空结果只表示当前收录未覆盖，不表示该地区没有文化实践。
- 列表和详情请求随手动选择取消或使用递增序号，防止旧响应覆盖新选择；这一 UI 接线由前端完成，本轮尚未修改探索页面。

## 检查与复现

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build

# 另一终端启动刚构建的服务；不需要 DEEPSEEK_API_KEY
npm.cmd run start -- --hostname 127.0.0.1 --port 3107

# 从本工作树对真实 Next.js HTTP 进行检查
node tests/cultural-cases-http.mjs http://127.0.0.1:3107
```

自动测试使用 Node test runner。人工构造案例只在 `tests/cultural-cases.test.mjs` 中，生产读取只导入 `data/cultural-cases/cases.json`，不接受环境开关或请求参数切换为样例数据。旧聊天、节气和地图测试继续运行。

本轮 [检查记录](cultural-cases-checks.md)：35 项自动测试、类型检查、ESLint、生产构建及 34 次真实 HTTP 检查均通过；它们不代表案例前端 UI 或真实 DeepSeek 聊天已经联调。
