# 五循环《食梦者》战役文档（The Dream Eaters）

> 本目录归档《食梦者》战役的文档、证据索引与扫描产物。
> 运行事实以代码、`tests/` 与 `audit/` 账本为准，本文不替代那些证据。

## 1. 战役范围

| 项 | 值 |
| --- | --- |
| 战役标识 | `theDreamEaters`（`content/campaigns/theDreamEaters/manifest.js`） |
| 卡号段 | `06xxx`（`06001`–`06354`，见 `content/packs/*/manifest.js`） |
| 卡包 | `core`、`tdeCampaign`、`tdeInvestigators`、`tdePlayer` |
| 章节 | 8 章：`beyondTheGatesOfSleep`、`wakingNightmare`、`theSearchForKadath`、`aThousandShapesOfHorror`、`darkSideOfTheMoon`、`pointOfNoReturn`、`whereTheGodsDwell`、`weaverOfTheCosmos` |
| 特殊结构 | 双线（梦境线/现实线）+ 多模式、并行幕间 II/III 与尾声矩阵（`manifest.modes` / `flows` / `epilogueMatrix`） |
| 内容状态 | `playable`，`equivalenceCertified: true`（账本 `audit/tde-migration.json`） |

## 2. 权威证据入口

- 总账本：`audit/tde-migration.json`
- 逐卡/调查员/玩家卡/关卡：`audit/tde-all-card-acceptance.json`、`audit/tde-investigators.json`、`audit/tde-player-acceptance.json`、`audit/tde-scenario-acceptance.json`
- 双线并行/剧情/浏览器：`audit/tde-parallel-acceptance.json`、`audit/tde-story-acceptance.json`、`audit/tde-browser-acceptance.json`
- 行为实现：玩家卡 `src/cards/entries/06xxx.js`；非玩家卡 `src/cards/encounter-entries/theDreamEaters/**`
- 回归测试：`tests/tde-*.test.mjs`、`tests/tde-*.browser.mjs`（含 `tde-scenario-*` 逐章）
- 冒险指南：`web/scenario-guides/<scenarioId>.json`（8/8 章）

## 3. 扫描产物

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `full-scan.md` | 未执行 | 尚无本目录独立全量扫描；现有结论以 `audit/tde-*.json` 为准 |
| `fix-plan.md` | 未执行 | 待 `full-scan.md` 生成后派生 |

## 4. 相关规范

- [架构说明](../../../ARCHITECTURE.md)
- [内容迁移规范](../../arkham-content-migration.md)
- [一卡一文件操作手册](../../card-entry-files.md)
- [卡牌模型](../../card-model.md)
- [冒险指南要求](../../scenario-guides.md)
