# 核心包《夜之狂热》战役文档（Night of the Zealot）

> 本目录归档核心包（`core` + `notz`）与《夜之狂热》战役的文档、证据索引与扫描产物。
> 运行事实以代码、`tests/` 与 `audit/` 账本为准，本文不替代那些证据。

## 1. 战役范围

| 项 | 值 |
| --- | --- |
| 战役标识 | `nightOfTheZealot`（`content/campaigns/nightOfTheZealot/manifest.js`） |
| 卡号段 | `01xxx`：核心包 `01000`–`01104`，夜之狂热 `01105`–`01141`（见 `content/packs/manifests.js`） |
| 卡包 | `core`、`notz` |
| 章节 | 3 章：`theGathering`、`theMidnightMasks`、`theDevourerBelow` |
| 内容状态 | `playable`（大厅可启动三章战役） |

## 2. 权威证据入口

- 总证据账本：`audit/core-acceptance.json`（逐卡行为测试证据，生成物见 `src/cards/core-acceptance.js`）
- 行为实现：玩家卡 `src/cards/entries/01xxx.js`；非玩家卡 `src/cards/encounter-entries/**/01xxx.js`
- 回归测试：`tests/core-*.test.mjs`、`tests/notz-*.test.mjs`、`tests/core-acceptance.browser.mjs`
- 冒险指南：`web/scenario-guides/theGathering.json` 等三章完整指南
- 大厅启动校验：`assertLaunchableCampaign('nightOfTheZealot')`

## 3. 扫描产物

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `full-scan.md` | 未执行 | 尚无本目录独立全量扫描；现有结论以 `audit/core-acceptance.json` 为准 |
| `fix-plan.md` | 未执行 | 待 `full-scan.md` 生成后派生 |

## 4. 相关规范

- [架构说明](../../../ARCHITECTURE.md)
- [内容迁移规范](../../arkham-content-migration.md)
- [一卡一文件操作手册](../../card-entry-files.md)
- [卡牌模型](../../card-model.md)
- [冒险指南要求](../../scenario-guides.md)
