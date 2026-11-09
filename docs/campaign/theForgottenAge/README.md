# 三循环《失落的时代》战役文档（The Forgotten Age）

> 本目录归档《失落的时代》战役的文档、证据索引与扫描产物。
> 运行事实以代码、`tests/` 与 `audit/` 账本为准，本文不替代那些证据。

## 1. 战役范围

| 项 | 值 |
| --- | --- |
| 战役标识 | `theForgottenAge`（`content/campaigns/theForgottenAge/manifest.js`） |
| 卡号段 | `04xxx`（`04001`–`04347`，见 `content/packs/*/manifest.js`） |
| 卡包 | `core`、`tfaCampaign`、`tfaInvestigators`、`tfaPlayer` |
| 章节 | 10 章：`theUntamedWilds`、`theDoomOfEztli`、`threadsOfFate`、`theBoundaryBeyond`、`heartOfTheEldersPart1`、`heartOfTheEldersPart2`、`theCityOfArchives`、`theDepthsOfYoth`、`shatteredAeons`、`turnBackTime` |
| 内容状态 | `playable`，`equivalenceCertified: true`（账本 `audit/tfa-migration.json`）；序幕补给品与逐章验收已完成 |

## 2. 权威证据入口

- 总账本：`audit/tfa-migration.json`
- 关卡/浏览器验收：`audit/tfa-scenario-acceptance.json`、`audit/tfa-browser-acceptance.json`
- 行为实现：玩家卡 `src/cards/entries/04xxx.js`；非玩家卡 `src/cards/encounter-entries/theForgottenAge/**`
- 回归测试：`tests/tfa-*.test.mjs`、`tests/tfa-*.browser.mjs`
- 冒险指南：`web/scenario-guides/<scenarioId>.json`（10/10 章）

## 3. 扫描产物

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `full-scan.md` | 未执行 | 尚无本目录独立全量扫描；现有结论以 `audit/tfa-*.json` 为准 |
| `fix-plan.md` | 未执行 | 待 `full-scan.md` 生成后派生 |

## 4. 相关规范

- [架构说明](../../../ARCHITECTURE.md)
- [内容迁移规范](../../arkham-content-migration.md)
- [一卡一文件操作手册](../../card-entry-files.md)
- [卡牌模型](../../card-model.md)
- [冒险指南要求](../../scenario-guides.md)
