# 战役文档目录（docs/campaign）

本目录按战役/循环归档战役级文档：迁移路线图、验收口径、原语契约、全量扫描结果与修复步骤。
运行事实（规则、卡牌行为、关卡状态）以代码、`tests/` 与 `audit/` 账本为准，本目录文档不替代那些证据。

## 目录约定

- 每个循环一个文件夹，文件夹名 = 内容层战役标识（`content/campaigns/<id>`），例如 `theCircleUndone`、`nightOfTheZealot`。
- 文件夹内固定文件约定：
  - `README.md`：本循环文档索引、范围与权威证据入口（每个文件夹必须有）。
  - `full-scan.md`：独立全量扫描结果（逐卡逐子句 + 真实引擎探针 + 机械审计 + 对抗式复核）。
  - `fix-plan.md`：由扫描结果派生的修复步骤（P0/P1/P2、文件定位与验收条件）。
  - 其余文件为该循环的路线图/验收/原语/发布记录（历史文档保留原名）。
- 扫描产物只记录本轮复核对当前工作区源码的判定，不代表规则等价；账本口径见
  [`../arkham-content-migration.md`](../arkham-content-migration.md) 与 [`../card-model.md`](../card-model.md)。

## 循环索引

| 序号 | 循环 | 文件夹 | 内容状态 | 说明 |
| --- | --- | --- | --- | --- |
| 核心包 | 《夜之狂热》Night of the Zealot | [`nightOfTheZealot/`](nightOfTheZealot/README.md) | `playable` | 3 章（`01xxx`） |
| 1 | 《敦威治遗产》The Dunwich Legacy | [`theDunwichLegacy/`](theDunwichLegacy/README.md) | `playable` | 8 章（`02xxx`） |
| 2 | 《卡尔克萨之路》The Path to Carcosa | [`thePathToCarcosa/`](thePathToCarcosa/README.md) | `playable` | 8 章（`03xxx`） |
| 3 | 《失落的时代》The Forgotten Age | [`theForgottenAge/`](theForgottenAge/README.md) | `playable` | 10 章（`04xxx`） |
| 4 | 《万象无终》The Circle Undone | [`theCircleUndone/`](theCircleUndone/README.md) | `playable` | 9 章（`05xxx`）；本轮独立全量扫描对象 |
| 5 | 《食梦者》The Dream Eaters | [`theDreamEaters/`](theDreamEaters/README.md) | `playable` | 8 章（`06xxx`），双线/多模式 |
| 6 | 《印斯茅斯暗潮》The Innsmouth Conspiracy | [`theInnsmouthConspiracy/`](theInnsmouthConspiracy/README.md) | `playable` | 8 章（`07xxx`） |
| 7 | 《地球边缘》Edge of the Earth | `docs/edgeOfTheEarth/`（未迁入） | `playable` | 8 章（`08xxx`）；独立全量扫描已完成，见 [`../edgeOfTheEarth/full-scan.md`](../edgeOfTheEarth/full-scan.md) |
| 8 | 《绯红密钥》The Scarlet Keys | [`theScarletKeys/`](theScarletKeys/README.md) | `catalog-only`（P0–P5 完成） | 10 章（`09xxx`）；439 条记录范围/基线/机制扫描已锁，77 项原语、29 关键词/17 条双语规则、6 组交互、6 位调查员与 14 张专属依赖已交付，进入 P6 一般玩家卡 |
| 9 | 《铁杉谷盛宴》The Feast of Hemlock Vale | [`theFeastOfHemlockVale/`](theFeastOfHemlockVale/README.md) | 未实现（路线图） | 迁移路线图 |

## 相关规范

- [架构说明](../../ARCHITECTURE.md)
- [内容迁移规范](../arkham-content-migration.md)
- [一卡一文件操作手册](../card-entry-files.md)
- [卡牌模型](../card-model.md)
- [冒险指南要求](../scenario-guides.md)
