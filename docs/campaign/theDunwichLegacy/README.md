# 一循环《敦威治遗产》战役文档（The Dunwich Legacy）

> 本目录归档《敦威治遗产》战役的文档、证据索引与扫描产物。
> 运行事实以代码、`tests/` 与 `audit/` 账本为准，本文不替代那些证据。

## 1. 战役范围

| 项 | 值 |
| --- | --- |
| 战役标识 | `theDunwichLegacy`（`content/campaigns/theDunwichLegacy/manifest.js`） |
| 卡号段 | `02xxx`（`02001`–`02350`，见 `content/packs/*/manifest.js`） |
| 卡包 | `core`、`dunwichCampaign`、`dunwichInvestigators`、`dunwichPlayer`、`dunwichSupport` |
| 章节 | 8 章：`extracurricularActivity`、`theHouseAlwaysWins`、`theMiskatonicMuseum`、`theEssexCountyExpress`、`bloodOnTheAltar`、`undimensionedAndUnseen`、`whereDoomAwaits`、`lostInTimeAndSpace` |
| 内容状态 | `playable`；简化实现边界与残余项见账本 `remaining`，不宣称规则等价 |

## 2. 权威证据入口

- 总账本：`audit/dunwich-migration.json`
- 验收账本：`audit/dunwich-acceptance.json`
- 行为实现：玩家卡 `src/cards/entries/02xxx.js`；非玩家卡 `src/cards/encounter-entries/theDunwichLegacy/**`
- 回归测试：`tests/dunwich-*.test.mjs`、`tests/dunwich-acceptance.browser.mjs`
- 冒险指南：`web/scenario-guides/<scenarioId>.json`（8/8 章）

## 3. 扫描产物

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `full-scan.md` | 未执行 | 尚无本目录独立全量扫描；现有结论以 `audit/dunwich-*.json` 为准 |
| `fix-plan.md` | 未执行 | 待 `full-scan.md` 生成后派生 |

## 4. 相关规范

- [架构说明](../../../ARCHITECTURE.md)
- [内容迁移规范](../../arkham-content-migration.md)
- [一卡一文件操作手册](../../card-entry-files.md)
- [卡牌模型](../../card-model.md)
- [冒险指南要求](../../scenario-guides.md)
