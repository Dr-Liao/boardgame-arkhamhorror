# 四循环《万象无终》战役文档（The Circle Undone）

> 本目录归档四循环《万象无终》的文档、证据索引与全量扫描产物。
> 运行事实以代码、`tests/` 与 `audit/` 账本为准，本文不替代那些证据。

## 1. 战役范围

| 项 | 值 |
| --- | --- |
| 战役标识 | `theCircleUndone`（`content/campaigns/theCircleUndone/manifest.js`） |
| 卡号段 | `05xxx`（`05001`–`05346`，见 `content/packs/{tcuCampaign,tcuInvestigators,tcuPlayer}/manifest.js`） |
| 卡包 | `core`、`tcuCampaign`、`tcuInvestigators`、`tcuPlayer` |
| 章节 | 9 章：`disappearanceAtTheTwilightEstate`（序章）、`theWitchingHour`、`atDeathsDoorstep`、`theSecretName`、`theWagesOfSin`、`forTheGreaterGood`、`unionAndDisillusion`、`inTheClutchesOfChaos`、`beforeTheBlackThrone` |
| 特殊机制 | 闹鬼（haunted）、幽灵/幽灵牌库（spectral）、圆圈（circle）、塔罗牌与塔罗槽（tarot/tarotSlot）、羁绊（bonded）、遗物记忆（memento） |
| 内容状态 | `playable`（大厅可启动 9 章），逐卡账本见下 |

## 2. 权威证据入口

- 总账本：`audit/tcu-migration.json`
- 逐卡/调查员/玩家卡/关卡：`audit/tcu-all-card-acceptance.json`、`audit/tcu-card-behavior-audit.json`、`audit/tcu-player-acceptance.json`、`audit/tcu-scenario-acceptance.json`
- 浏览器/完成度/来源锁：`audit/tcu-browser-acceptance.json`、`audit/tcu-completion-review.json`、`audit/tcu-scenario-source-lock.json`
- 行为实现：玩家卡 `src/cards/entries/05xxx.js`；非玩家卡 `src/cards/encounter-entries/theCircleUndone/**`
- 内容层：`content/campaigns/theCircleUndone/**`（`manifest.js`、`chapters.js`、`scenarios/**`、`keywords.js`、`tarot.js`、`tcu-chaos.js`）
- 回归测试：`tests/tcu-*.test.mjs`、`tests/tcu-*.browser.mjs`
- 冒险指南：`web/scenario-guides/<scenarioId>.json`（9/9 章）

## 3. 扫描产物

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| [`full-scan.md`](full-scan.md) | 已完成（2026-11-09） | 独立全量扫描结果：逐卡逐子句实现 vs 描述、原语合规、复用/重印、9 章真实引擎可跑通性、交互可感知 |
| [`fix-plan.md`](fix-plan.md) | 扫描单已完成；**P0 4 项 + P1 全部 16 组已修复（2026-11-09）** | 由扫描结果派生的修复步骤（P0/P1/P2、文件定位、验收条件）；§0.1–§0.6 P0/P1 执行记录与验收证据 |

> 已修复部分涉及：P0（05130 崩溃/翻面保留线索/变体分组/05201 反应）、P1 全部 16 组
> （05246 V4、05072、05015 不能取消、05190/05191 criteria、05230 目标枚举、05282 countsAs、
> 05024/05152/05156、05002/05009 牌库底、spawnPrinted 数值、05095 入场毁灭、tokenMeanings 接线、
> 05104 投入费用时机、05311 breachOnEnter、D2 观察投影与前端、9 章真实引擎冒烟、**R1 直写清零**
> （51 个条目上收 + 区域/实例字段/毁灭/战役记录等原语补齐，含 `api.doomOn`/`api.setCampaignRecord`
> 能力面缺口这类真实 bug）、**P1-16 ICC 卡号表结构性迁移**（16 地点规则迁回单卡条目、5 诡计改声明
> `resolveRule` 通用分派；守卫基线卡号表 121→100、behavior.js 33773→33475 行））。
> **剩余**：P2 的账本基线/i18n/复用/原语队列项（见 fix-plan §0.5/§P2）。新增回归：
> `tests/tcu-p0-regressions.test.mjs`、`tests/tcu-p1-regressions.test.mjs`、
> `tests/tcu-chapters-smoke.test.mjs`；钩子级测试共用区域 API 替身 `tests/tcu-zone-api.mjs`。

## 3.1 关间升级窗与调查纪事排序（2026-11-17 用户实测修复）

**用户报告**：第 2 关《巫异时刻》（序章之后的下一关）结算后直接跳到第 3 关《死亡门前》的准备页，
没有升级（经验花不出去）；调查纪事默认展开的又是序章私密故事「杰罗姆·戴维斯的命运」，故事引导不对。

**规则口径**（参考实现 `Campaigns/TheCircleUndone.hs` 的 `nextStep`）：

| 流程节点 | 参考实现 | 升级窗 |
| --- | --- | --- |
| 序章 → 巫异时刻 | `ChooseDecksStep <$> continueNoUpgrade TheWitchingHour` | 无（序章不给经验） |
| 巫异时刻 → 死亡门前 | `continue AtDeathsDoorstep` | 有 |
| 死亡门前 → 隐秘之名 | `continue TheSecretName`（逃出时先读幕间二） | 有（幕间二读完后再升级） |
| 隐秘之名 → 恶罪报应 | `continue TheWagesOfSin` | 有 |
| 恶罪报应 → 崇高利益 | `continue ForTheGreaterGood` | 有 |
| 崇高利益 → 聚合幻灭 | `continue UnionAndDisillusion`（入职时先读幕间三） | 有（幕间三读完后再升级） |
| 聚合幻灭 → 混沌魔掌 | `continue InTheClutchesOfChaos` | 有 |
| 混沌魔掌 → 黑色王座 | 先读幕间四，再 `continue BeforeTheBlackThrone` | 有（幕间四读完后再升级） |
| 黑色王座 → 尾声 | `continue EpilogueStep` | 无 |

**修复**：`manifest.flow` 新增 7 个无正文的 `interlude` 关间升级窗（`restAfterWitchingHour`、
`restBeforeTheSecretName`、`restBeforeTheWagesOfSin`、`restBeforeForTheGreaterGood`、
`restBeforeUnionAndDisillusion`、`restBeforeInTheClutchesOfChaos`、`restBeforeBlackThrone`），
并把幕间二/三/四改成 `upgrades: false` 的叙事停顿窗（读完正文/回答选择后才在下一关前升级，这样
幕间里发的经验也能在同一个关间花掉）。调查纪事侧：私密故事写入时记录流程位置（`nodeId` + `visit`），
观察投影把它排回实际发生的章节（序章导入之后、序章结算之前）；旧存档的 `tcuPrologue*` 按
《暮色庄园失踪事件》回填，结算页默认展开本关结算、准备页默认展开下一关导入。

**三选一（draft）模式的连带问题（2026-11-18 用户存档实测）**：《巫异时刻》介绍 2 把「高塔·XVI」
「权杖王牌」作为**不计入牌组张数**的战役奖赏加入牌组（`campaignCardChange(..., { deckSlot: false })`
→ `record.campaignCards`）。三选一模式的 30 张校验必须扣掉这些卡，否则牌组会变成 31 张、
`hubBeginScenario` 永远被「请先补足所有调查员的牌组」挡住。`draftDeckStatus` / `draftLegalMoves`
与关间替换池都按 `campaignCards` 扣除；旧存档没有这个标记时由存档迁移按
「已接受命运 + 牌组含权杖王牌」回填。同一次迁移还会把「旧流程直接落在下一关准备页」的存档
**回退到漏掉的关间升级窗**（不丢已结算经验/记录，三选一模式同时进入补牌/升级阶段）。

**证据**：`tests/tcu-interlude-windows.test.mjs`（真实 hub 流程：巫异时刻结算 → 关间升级 → 死亡门前；
死亡门前 r1/r2 两条出口的升级窗；三选一模式奖赏卡不计张数；旧存档迁移回退升级窗并补记奖赏卡）、
`tests/tcu-story.test.mjs`（flow 契约 + 私密故事排序）、
`node --test tests/tcu-chapters-smoke.test.mjs`（九章真实引擎冒烟）与 `node tools/audit-tcu.mjs --check`
（flow 节点 41、剧情测试 19/19）。

## 4. 相关规范

- [架构说明](../../../ARCHITECTURE.md)
- [内容迁移规范](../../arkham-content-migration.md)
- [一卡一文件操作手册](../../card-entry-files.md)
- [卡牌模型](../../card-model.md)
- [冒险指南要求](../../scenario-guides.md)
