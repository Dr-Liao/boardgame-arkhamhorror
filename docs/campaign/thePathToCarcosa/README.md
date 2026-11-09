# 二循环《卡尔克萨之路》战役文档（The Path to Carcosa）

> 本目录归档《卡尔克萨之路》战役的文档、证据索引与扫描产物。
> 运行事实以代码、`tests/` 与 `audit/` 账本为准，本文不替代那些证据。

## 1. 战役范围

| 项 | 值 |
| --- | --- |
| 战役标识 | `thePathToCarcosa`（`content/campaigns/thePathToCarcosa/manifest.js`） |
| 卡号段 | `03xxx`（`03001`–`03342`，见 `content/packs/*/manifest.js`） |
| 卡包 | `core`、`carcosaCampaign`、`carcosaInvestigators`、`carcosaPlayer` |
| 章节 | 8 章：`curtainCall`、`theLastKing`、`echoesOfThePast`、`theUnspeakableOath`、`aPhantomOfTruth`、`thePallidMask`、`blackStarsRise`、`dimCarcosa` |
| 内容状态 | `playable` + `earlyAccess`（账本 `audit/carcosa-migration.json`），不宣称规则等价 |

## 2. 权威证据入口

- 总账本：`audit/carcosa-migration.json`
- 逐卡/调查员/关卡验收：`audit/carcosa-all-card-acceptance.json`、`audit/carcosa-player-acceptance.json`、`audit/carcosa-scenario-acceptance.json`
- 行为实现：玩家卡 `src/cards/entries/03xxx.js`；非玩家卡 `src/cards/encounter-entries/thePathToCarcosa/**`
- 回归测试：`tests/carcosa-*.test.mjs`、`tests/carcosa-*.browser.mjs`
- 冒险指南：`web/scenario-guides/<scenarioId>.json`（8/8 章）

## 3. 扫描产物

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `full-scan.md` | 未执行 | 尚无本目录独立全量扫描；现有结论以 `audit/carcosa-*.json` 为准 |
| `fix-plan.md` | 未执行 | 待 `full-scan.md` 生成后派生 |

## 4. 相关规范

- [架构说明](../../../ARCHITECTURE.md)
- [内容迁移规范](../../arkham-content-migration.md)
- [一卡一文件操作手册](../../card-entry-files.md)
- [卡牌模型](../../card-model.md)
- [冒险指南要求](../../scenario-guides.md)
