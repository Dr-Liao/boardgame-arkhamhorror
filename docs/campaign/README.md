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
| 7 | 《地球边缘》Edge of the Earth | `docs/edgeOfTheEarth/`（未迁入） | `playable` | 8 章（`08xxx`）；独立全量扫描与 P8 发布验收已完成，见 `audit/eote-release-acceptance.json` |
| 8 | 《绯红密钥》The Scarlet Keys | [`theScarletKeys/`](theScarletKeys/README.md) | `playable`（P0–P8 迁移完成；2026-11-12 独立全量扫描发现 P0/高危缺陷，**2026-11-13 7 项 P0 全部修复：14/14 冻结门禁、637/637 TSK 测试通过**，见 `full-scan.md` / `fix-plan.md`） | 10 章（`09xxx`）；439 条记录逐卡账本 missing=0（verified 160 / disclosed-simplified 121 / scenario-data 148 / 章节参考卡 10），29 关键词/17 条双语规则、6 组交互、6 位调查员与 14 张专属依赖、108 张一般玩家卡（103 可构筑 + 5 基础弱点）、311 张战役卡（301 需条目卡全部覆盖），十章与世界地图启程/逐章推进/状况报告/密档幕间/快捷旅票/通古斯卡终章/尾声均可在真实大厅完成；`confirmations.scenarios/keywords/rulebook` 三组 verified，P8 发布验收账本见 `audit/tsk-migration.json`；**独立全量扫描**（439 卡逐卡 + 真实引擎探针）发现 7 项 P0 与大量 high 偏差，P0 已修复并有 `tests/tsk-p0-regressions.test.mjs` 真实引擎回归，剩余 P1/P2 见 [`fix-plan.md`](theScarletKeys/fix-plan.md)（P1 已完成 17/17 组主体（第二轮 13 组 + 第三轮 P1-11/12/14/15 与 P1-16 单卡批，2026-11-13）） |
| 9 | 《铁杉谷盛宴》The Feast of Hemlock Vale | [`theFeastOfHemlockVale/`](theFeastOfHemlockVale/README.md) | `verified`（P0–P8 完成，完整迁移） | 三个内容包、八章与四段序曲全部完成；P3 交付 6 项关键词与 11 条双语规则；P4 交付 7 组交互；P5 交付 5 位调查员与 15 张专属/绑定依赖；P6 交付 120 条玩家卡记录；P7 交付 291 条单卡条目、12 个场景模块、三天三夜战役流程、1462 叶中英正文与 12 份指南；P8 发布验收：14 项门禁全真、8 例完整战役 E2E、3 phase × 双视口真实大厅浏览器、441 行逐卡账本、441/441 图像本地可展示、`earlyAccess: false`。见 [迁移总账本](../../audit/fhv-migration.json)、[范围账本](../../audit/fhv-scope.json)、[场景审计](../../audit/fhv-scenario-acceptance.json)、[规则书说明](theFeastOfHemlockVale/rulebook.md) |
| 10 | 《沉没之城》The Drowned City | [`theDrownedCity/`](theDrownedCity/README.md) | `catalog-only`（路线图） | 10 个剧本入口（`11xxx`），含东西远征路线、可选墓穴与两部终章 |

## 相关规范

- [架构说明](../../ARCHITECTURE.md)
- [内容迁移规范](../arkham-content-migration.md)
- [一卡一文件操作手册](../card-entry-files.md)
- [卡牌模型](../card-model.md)
- [冒险指南要求](../scenario-guides.md)
