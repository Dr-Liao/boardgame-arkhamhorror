# 《绯红密钥》关键词与规则书（P3 交付说明）

本文件汇总 P3（规范第 3 步：关键词与规则书）的交付口径。机器可复算的账本在
`audit/tsk-rules.json`（`confirmations.keywords` / `confirmations.rulebook`），
规则正文在 `web/tsk-rules.js`，关键词身份在 `content/campaigns/theScarletKeys/keywords.js`。

## 1. 关键词清单（29 个，全部 verified）

关键词身份与 P1 机制扫描（`audit/tsk-mechanism-scan.json` 里 29 个 `type: keyword` 机制）逐条一致：
`cardCodes` 由与扫描器相同的语料（卡名 + 副名 + 正文 + 背面 + 定制栏 + 定制变更 + 特质）复算，
不手写卡号；每个关键词的候选原语都在 P2 原语计划里 `done`。

| 类别 | 关键词 | 规则条目 |
| --- | --- | --- |
| 本循环新增 | 隐匿（Concealed X）、变换（Shift）、空洞（Hollow）、定制升级（Customizable）、巡逻（Patrol）、稳定面／动荡面（Stable / Unstable）、异界（Otherworld） | `tskConcealed`、`tskShift`、`tskHollow`、`tskCustomizable`、`tskPatrol`、`tskKeys`、`tskOtherworld` |
| 复用基础关键词 | 猎手、冷漠、庞大、反击、警戒、涌动、险境、隐藏、显现、胜利点、猎物、生成、谈判、快速、永久、卓越、精英、使用次数、毁灭标记 | 基础规则条目（`hunter`…`uses`/`doom`） |
| 本循环单独成条 | 目标（Objective）、撤退（Resign）、绑定（Bonded） | `tskObjective`、`tskResign`、`tskBonded` |

## 2. 规则书条目（17 条，中英双语，全部 verified）

`web/tsk-rules.js` 只写规则本身，不写实现/引擎/验证状态；条目注册进 `web/rulebook-data.js`
（`ruleById` / `RULE_INDEX` / `matchingRules`），支持中文标题、英文标题与拼音首字母检索。

| 条目 | 中文标题 | 关联 |
| --- | --- | --- |
| `tskCampaign` | 《绯红密钥》战役概览 | 世界地图、状况报告、密档、混乱袋 |
| `tskChaos` | 混乱袋与标记 | 战役概览、状况报告 |
| `tskMap` | 世界地图与时间标记 | 战役概览、状况报告、密档、异界 |
| `tskStatusReports` | 状况报告（α–ω） | 世界地图、同志会、密钥、混乱袋 |
| `tskConcealed` | 阴影与隐匿迷你卡（Concealed X） | 战役概览、空洞、密钥 |
| `tskHollow` | 空洞与存在抹除 | 隐匿、战役概览、密钥 |
| `tskKeys` | 绯红密钥 | 变换、战役概览、状况报告 |
| `tskShift` | 变换（Shift） | 密钥、战役概览 |
| `tskCustomizable` | 定制升级卡（Customizable） | 战役概览、升级、构筑 |
| `tskCoterie` | 红色同志会 | 状况报告、战役概览、巡逻 |
| `tskPatrol` | 巡逻（Patrol） | 猎手、同志会、战役概览 |
| `tskOtherworld` | 异界（Otherworld） | 世界地图、隐藏、密档 |
| `tskDossiers` | 地图密档 | 世界地图、战役概览、异界 |
| `tskInvestigator` | 调查员特殊行动与标记 | 战役概览、定制升级、伤害 |
| `tskObjective` | 目标（Objective） | 幕与议程、线索、毁灭、战役概览 |
| `tskResign` | 撤退（Resign） | 创伤、战役概览 |
| `tskBonded` | 绑定（Bonded） | 构筑、弱点、永久、战役概览 |

## 3. 卡文直达

- 每张 09 卡都至少连到 `tskCampaign`；439/439 全部有规则链接（审计 `cardLinks.unlinked = []`）。
- 关键词卡按同一判据连到对应关键词规则条目（29 个关键词的 `cardCodes` 逐张核对）。
- 类型直达：调查员卡 → `tskInvestigator`；密钥卡 → `tskKeys`；章节卡 → `tskMap`；
  幕／议程／地点／敌人／诡计 → `tskChaos`（本关混乱符号表）。
- 卡面命中哪个 pattern 就必须连到对应条目，测试与审计双向核对（`tests/tsk-rules.test.mjs`）。

## 4. 验收与证据

```powershell
node tools/run-tsk-browser.mjs       # 桌面 1440 / 移动 390 × 中英：目录、搜索、阅读、返回、卡文直达
npm run plan:tsk:rules               # 生成 audit/tsk-rules.json（含 confirmations）
npm run audit:tsk:rules              # 只复算不重写（关键词/规则/证据漂移即失败）
node --test tests/tsk-rules.test.mjs # Node 验收：清单一致性、双语、卡文直达、账本复算
```

- `audit/tsk-rules.json`：`confirmations.keywords`（29/29 verified）、`confirmations.rulebook`（17 条 verified），
  门禁全真；来源 SHA-256 全部登记。
- `audit/tsk-browser-acceptance.json`：6 个浏览器用例通过（desktop/mobile × zh-CN/en、卡文直达），
  六项 checks 全真（`desktop` / `mobile` / `zh` / `en` / `cardLink` / `noHorizontalScroll`），
  截图在 `artifacts/migration/tsk/reports/screenshots/`。
- 测试数量与耗时以 `node tools/run-tests.mjs fast` 实时输出为准，不在文档里写死。

## 5. 边界

P3 只交付「关键词身份 + 规则条目 + 卡文直达 + 验收证据」。单卡字面行为仍在 P5–P7 逐卡实现；
规则书条目只描述 P2 已实现的通用规则与基础规则，不描述未实现行为。
