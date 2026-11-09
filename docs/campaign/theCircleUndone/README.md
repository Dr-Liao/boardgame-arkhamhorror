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

## 4. 相关规范

- [架构说明](../../../ARCHITECTURE.md)
- [内容迁移规范](../../arkham-content-migration.md)
- [一卡一文件操作手册](../../card-entry-files.md)
- [卡牌模型](../../card-model.md)
- [冒险指南要求](../../scenario-guides.md)
