# 《食梦者》关键词与规则书手册（P4 骨架 · draft）

> **口径**：本文件是 **P4 之前的骨架**（`draft`），只登记关键词/规则书条目的**入口、证据与验收口径**，不含「已实现/已验证」声明。
> 事实来源：[`mechanism-scan.json`](../artifacts/migration/tde/mechanism-scan.json)（P2，`npm run scan:tde:check` 可复算）。
> 路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §6；规范：[`arkham-content-migration.md`](./arkham-content-migration.md) §6–§7。

## 1. 证据口径

每个关键词必须在审计账本 `confirmations.keywords.items` 里给出 5 项：`sourceInventoried / engineBehavior / nodeAcceptance / rulebookEntry / cardLinks`。
规则书必须给出 6 项：`campaignOverview / scenarioMechanics / keywordEntries / cardLinks / desktopBrowser / mobileBrowser`。
状态只有 `pending` 与 `verified`，由校验器按证据计算，不能手写（规范 §8 / 路线图 §11.3 G9）。

## 2. 事实：7 个关键词（P2 实测）

| 关键词 | 中文 | 卡数（实测） | 引擎现状 | 代表卡 |
| --- | --- | ---: | --- | --- |
| `Myriad` | 多重 | 14 | missing（卡池 `myriad`/`deckLimit` 字段在） | 06020 庄严立誓、06241–06243 自我赋能 |
| `Swarming X` | 蜂拥 X | 11 敌 | missing | 06102 蛛群、06145 乌撒之猫、06228 土星猫、06273 漆黑蜘蛛 |
| `Veiled` | 掩藏 | 23 地点 | missing | 06127 乌撒、06143 地图未见之城、06254–06265 漆黑之海 |
| `Researched` | 研究完成 | 3 | missing | 06236/06237/06238 梦境日记 |
| `Alert` | 警戒 | 5 敌 | **reuse**（`src/engine/combat.js:614`） | 06105 冷原名海盗、06227 月缚拜亚基 |
| `Hidden` | 隐私 | 18（16 本体 + 2 引用） | partial（`src/engine/hidden-rules.js`） | 06306–06310 奈亚拉托提普五形态、06314–06321 诡计 |
| `Bonded` | 绑定 | 27 条 | partial（`src/engine/bonded.js`） | 06013 门之匣、06015a/b 梦境之门、06019 嗜血 |

### 2.1 三个「已有待确认」的差异（P4 必须逐条给结论）

- **Alert + Swarming**：警戒反击由 `combat.js` 的敌人攻击结算，蜂群卡是否也触发反击未定；与 Massive 组合的攻击次数也未定。
- **Hidden 敌人形态**：TCU 的 Hidden 是「威胁区/手牌」，TDE 的 06306–06310 要在手牌里可被攻击/躲避；18 张全部带 Peril。
- **Bonded 地点与弱点敌人**：TCU 只覆盖玩家卡场外实体；06015a/b 是地点绑定，06025/06283 是绑定敌人。

## 3. 事实：规则书条目建议 16 条

| # | 条目 id | 内容 | 卡面证据（P2） |
| ---: | --- | --- | --- |
| 1 | `tdeCampaign` | 双战役结构、四种开局、每座位一套牌组 | 0 卡（战役层） |
| 2 | `tdeDreamQuest` | A 线 4 章与逐章规则 | 4 张章节参考卡 |
| 3 | `tdeWebOfDreams` | B 线 4 章与逐章规则 | 4 张章节参考卡 |
| 4 | `tdeChaos` | 两袋混乱袋与逐章符号表 | 8 张剧本参考卡 |
| 5 | `tdeRecords` | 55 个记录键与中文标签 | 0 卡（Key.hs / P8 数据） |
| 6 | `tdeEpilogue` | 16 段尾声判定 | 0 卡（P8-T 自译） |
| 7 | `tdeMyriad` | 多重（同名至多 3 张） | 14 卡 |
| 8 | `tdeSwarming` | 蜂拥 X（四种 X 口径） | 11 敌 |
| 9 | `tdeVeiled` | 掩藏地点与背面故事卡 | 23 地点 |
| 10 | `tdeResearched` | 研究完成与升级门控 | 3 卡 |
| 11 | `tdeDreamGate` | 梦境之门（绑定地点） | 4 卡 |
| 12 | `tdeInfestationBag` | 蛛群滋生袋与 infestation test | 10 卡 |
| 13 | `tdeAlarmLevel` | 警报等级 0–5+ | 20 卡 |
| 14 | `tdeSignsOfTheGods` | 神迹计数（A2） | 8 张背面故事卡 |
| 15 | `tdeStoryAssets` | 剧情支援入队/离场 | 11 卡 |
| 16 | `tdeLocationDoom` | 地点毁灭与 agenda 阈值 | 7 卡 |

> `alert` / `hidden` / `parley` 复用核心条目，不新立（路线图 §6）。

## 4. 待办（P4）

| # | 事项 | 产物 / 验收 |
| ---: | --- | --- |
| 1 | 每个关键词 5 项证据 | `confirmations.keywords.items` 全部 `verified` |
| 2 | 16 条规则书条目 | `web/rulebook-data.js` 分组、拼音索引、卡文直达 |
| 3 | 关键词引擎行为 | 复用/新增读点，`engine.js` 无卡号分支 |
| 4 | Node 验收 | 成功/失败/时机冲突/存档往返；`test:tde:rules` |
| 5 | 浏览器验收 | 桌面 1440 / 移动 390；`test:tde:rules:browser` |
| 6 | 未确认关键词不得在卡牌文件使用 | 卡牌批次门禁 |

## 5. 边界

- 规则书只写规则本身，不写引擎/实现/界面操作/审计状态（规范 §7）；未实现的机制不建条目。
- 中文正文依赖 P8-T 自译（[`tde-story.md`](./tde-story.md)），规则书可先用英文来源校对，但发布前必须有自译中文并标注「自译，非官方中文」。

## 6. 相关手册与维护

- 原语：[`tde-primitives.md`](./tde-primitives.md)；交互：[`tde-interactions.md`](./tde-interactions.md)；剧本：[`tde-scenarios.md`](./tde-scenarios.md)；发布：[`tde-release.md`](./tde-release.md)。
- 维护：关键词/规则书条目落库后跑对应 `--check`；本文件的「卡数」列以 `scan:tde:check` 的输出为准，不手写。
