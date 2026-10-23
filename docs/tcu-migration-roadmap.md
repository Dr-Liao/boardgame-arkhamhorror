# 万象无终（四循环）迁移路线图

> 适用：`games/arkhamhorror` 第四循环 **The Circle Undone**（`05xxx`，代号 `tcu`，中文《万象无终》）。
> 编制：2026-10-23。依据 [`arkham-content-migration.md`](arkham-content-migration.md) 的六步顺序、[`../ARCHITECTURE.md`](../ARCHITECTURE.md) 的稳态架构、第三循环《失落的时代》的迁移账本与实测，以及截至当日的参考资源盘点。
> 性质：规划稿。本文锁定**顺序、范围、产物、门禁与风险**，不替代迁移规范；也不把「目录已收录」「代码里出现卡号」当成已实现。

## 0. 一页结论

| 项目 | 结论 |
| --- | --- |
| 目标 | 9 章全部可玩、三组确认（剧本／关键词／规则书）全部 `verified`，战役 `playable` 且可从大厅启动；若沿用第三循环的 `earlyAccess` 口径，必须逐条列出 `remaining`，不得宣称规则等价 |
| 范围 | **343 张主卡 + 34 张关联面 = 377 条印刷记录**；三个包：战役 237 / 调查员 19 / 玩家 87；6 位正式调查员 + 4 位序章故事调查员 |
| 关键新机制 | 闹鬼（Haunted）、幽灵界（Spectral 第二遭遇牌堆 + 双面/单面地点）、塔罗牌组（22 张大阿卡纳）与塔罗槽位、阵法（Circle 多技能检定）、通用谈判（Parley）、遗留记忆（Memento）、看守人（Watcher）、序章无牌组调查员、绑定（Bonded）、裂口／火盆等地点状态、异端者多面与放逐、Cosmos 牌库、机关盒与钥匙 |
| 执行顺序 | 固定为规范 §4 六步：**M0 锁定范围 → 扫描机制 → 拆分原语 → 关键词与规则书 → 新增交互 → 批量卡牌 → 测试验收**。M0–M5 是内容阶段，不是执行顺序 |
| 批次 | P0–P10 共 11 个可独立验收的批次；关键路径 **P0 → P1 → P2 → P3 → P5 → P8 → P10** |
| 体量 | 以第三循环《失落的时代》为 1.0，本轮约 **1.1–1.3×**：调查员批次约 1.7×（6 + 4 位），机制批次约 1.2–1.4×，剧本批次约 0.9–1.1×（9 章但源码更短），玩家卡批次约 1.0× |
| 首个垂直切片 | 序章《暮色庄园失踪事件》+《巫异时刻》：一次打通塔罗牌组、无牌组调查员、闹鬼、看守人、第一组战役记录与两个剧本 |
| 最大风险 | ① 第三循环的门禁与证据本身有坏账（工具已坏、浏览器证据是手工提交的）；② 闹鬼的自动结算；③ 幽灵界第二牌堆；④ 塔罗 22 分支；⑤ 序章无牌组模式；⑥ 多子进程协议此前从未真正跑过 |
| 完成判据 | 三组确认全真 + `cards:check` / `cards:encounter-check` + 全量回归 + 桌面 1440／移动 390 浏览器 + 存读档与隐私投影；不以 Node 单测替代浏览器验收 |

---

## 1. 现状与复用基线

### 1.1 已完成的三个循环提供了什么

- **目录与卡包契约**：`content/packs/<cycle>Campaign|Investigators|Player/manifest.js` 三分包、`catalog-only → development → playable` 状态机、`content/registered.js` 单一装配点。
- **战役骨架**：`content/campaigns/theForgottenAge/` 已有 `manifest / shared / chapters / story-text / keywords / record-labels / story-roles / interludes / encounter-rules / card-data / scenarios/*` 的完整分层；`thePathToCarcosa` 提供另一套战役插件写法。
- **工具链**：`tools/audit-tfa.mjs`、`tools/audit-tfa-scenarios.mjs`、`tools/import-tfa-story.mjs`、`tools/replay-fixtures.mjs`、`tools/scaffold-card.mjs`、两个索引生成器。
- **测试与浏览器**：`tests/tfa-*.test.mjs` 覆盖调查员、玩家卡、十章、剧情、关键词、规则书；Playwright 规则书桌面／移动用例已跑通。
- **内容层与引擎的边界**：卡行为只写单卡描述子；战役原语走 `src/cards/campaign-plugin.js` + `src/cards/campaign-state.js` + `src/cards/campaign-view.js`；关卡行为走 `scenarioRuntime`，引擎不出现战役名。

### 1.2 当前仓库基线（2026-10-23）

| 指标 | 实测 |
| --- | --- |
| 卡面数据 | `src/cards/cards-data.js` 收录 5,930 张卡；05 号段 **343 主码 + 34 链接面 = 377 条** |
| 单卡行为文件 | `entries/` 470 个、`encounter-entries/` 532 个 |
| `fast` 回归 | 2026-10-23 实测 **2,337 例全部通过**（2026-10-22 基线 2,311；此后新增用例须保持 0 失败） |
| golden replay | 13 局真实对局、786 步、799 个逐步指纹（`ARCHITECTURE.md` §5.3） |
| 第三循环测试体量 | 27 个测试文件、约 608 例，全部在 fast tier；账本 1/10 章 `verified` |
| 已开放循环 | 核心／夜之狂热、敦威治、卡尔克萨、失落的时代（后两者为 `playable`；TFA 账本 `earlyAccess`） |

### 1.3 TCU 已经存在的少量资产

| 资产 | 现状 | 处理 |
| --- | --- | --- |
| 卡面数据 | 343 主码 + 34 链接面已导入，含中文名、卡文、图片字段 | M0 复核，不重新导入 |
| 已有单卡文件 | `05023 宝剑王牌`、`05025 串联线索`、`05028 良好人脉`、`05112 魔法手势`、`05115 .45 汤姆逊冲锋枪` | 能力层试点样本，**全部 `catalog-only`**；05112 标了 `simplified`。M2 必须重新逐卡验收，不能算 M2 已完成的 5 张 |
| 塔罗槽位 | `engine.js` 的 `SLOT_CAPACITY` 已含 `tarot: 1`；`web/game-ui.js` 已有槽位顺序、中文标签与图标 | 复用；TCU 只需补卡、额外槽位、开局入手与构筑合法性 |
| 卡图 | 英文覆盖 376/377（缺 `05217` 正面）、中文覆盖 377/377；本地文件 539 英文 / 527 中文（含背面与变体） | 按 [`card-image-translation.md`](card-image-translation.md) 逐卡确认回退；不得手工改名副本 |
| 中文剧情 | `参考资源/.../locales/zh/theCircleUndone/` 共 10 个 JSON、约 201 KB（`base.json` + 9 章） | 作为唯一剧情来源，M3-C 生成 `story-text.js` |
| 参考实现 | 9 个剧本 Haskell 文件约 2.4k 行；另有战役流程、记录键、Memento、混乱袋 | 只读锁定并记录 SHA-256 |
| 战役展示素材 | **缺** `web/img/campaigns/theCircleUndone/` 与 `web/audio/music/campaigns/theCircleUndone/`；共享曲库可用，但 `web/scenario-music.js` 无 TCU 条目 | M5 或提前补；展示检查不通过不能发布 |

### 1.4 与第三循环收尾的关系（必须先处理）

第三循环留下了三类会影响 TCU 的债务，不能照抄：

1. **章节审计工具（2026-10-23 已修复）**：修复前 `node tools/audit-tfa-scenarios.mjs --check` 退出码 1，报 `encounter-rules.js does not provide an export named 'implementedEnemies'`；该导出在 2026-10-22 的重构中被删除，替代读点是 `src/cards/card-rules.js` 的 `implementedFor(code)`。当时 `audit-tfa.mjs` 仍退出 0，是因为它只映射已冻结的 `audit/tfa-scenario-acceptance.json`，**工具与生成器已经分离**。现已改为从单卡条目读「是否已实现」，并重锁 TFA 两本账本。
2. **浏览器证据不可复现（部分修复）**：`audit/tfa-browser-acceptance.json` 没有任何生成器写入，仍是手工提交的 4/4 JSON；`audit-tfa.mjs` 的 `remaining` 已改为从逐章 `checks` 计算（2026-10-23），不再出现「checks 全 true 但 remaining 仍写 browserAcceptance 为 false」的自相矛盾，但浏览器证据本身仍需 runner 生成（TCU 的硬要求）。
3. **多子进程协议从未在真实迁移中跑过**：`docs/arkham-content-migration.md` 的 §4.6 是在 TFA 交付之后、随「一卡一文件」重构补写的；TFA 实际是按批次手写。TCU 若声称按 §4.6 执行，必须新造 `shards.json`、`primitive-requests/`、`workers/` 与合并报告，并先做一个小分片试点。

> **P0 决策**：TCU 开工前先修 TFA 的 `audit-tfa-scenarios --check`（补回 `implementedEnemies` 或改为读同一事实源），并把「浏览器证据由 runner 生成、`remaining` 由计算得出」定为 TCU 审计工具的硬要求。否则 TCU 会复制同一种坏账。

> **P0 状态（2026-10-23）**：TFA 两个审计命令均退出 0；14 条审计命令、文档链接与 golden replay 计数固化在 `audit/baseline.json`，用 `npm run baseline:check` 复算，文档链接用 `npm run docs:check`。第 2 条仍是 TCU 审计工具的硬要求，未因本次修复而放宽。

---

## 2. 范围锁定（M0）

### 2.1 产品与章节

TCU 是「豪华包 3 个剧本 + 6 个神话包各 1 个剧本」的结构，共 **9 章**（序章 + 8 章），另有尾声与 4 段幕间文本。

| # | 目录 id | 中文名 | 参考剧本卡 | pack | 主要遭遇组（含复用的核心组） | 章节核心机制 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `disappearanceAtTheTwilightEstate` | 暮色庄园失踪事件（序章） | 05043 | `tcu` | disappearance、inexorableFate、realmOfDeath、spectralPredators、trappedSpirits、theWatcher、chillingCold | 4 位无牌组故事调查员、22 张塔罗牌组、失踪人口与证据、幽灵看守人 |
| 1 | `theWitchingHour` | 巫异时刻 | 05050 | `tcu` | theWitchingHour、anettesCoven、cityOfSins、witchcraft、ancientEvils、strikingFear | 女巫集会、Anette Mason、Witches' Circle、塔罗占卜、agentsOfShubNiggurath/agentsOfAzathoth 放在一边 |
| 2 | `atDeathsDoorstep` | 死亡门前 | 05065 | `tcu` | atDeathsDoorstep、silverTwilightLodge、spectralPredators、trappedSpirits、inexorableFate、realmOfDeath、theWatcher、chillingCold | 幽灵地点、Josef Meiger、银暮秘社、毁灭标记、幽光谱 |
| 3 | `theSecretName` | 隐秘之名 | 05120 | `tsn` | theSecretName、cityOfSins、inexorableFate、realmOfDeath、witchcraft、rats | Keziah Mason、Nahab、异次元地点、遗留记忆、黑书 |
| 4 | `theWagesOfSin` | 罪恶报应 | 05161 | `wos` | theWagesOfSin、anettesCoven、cityOfSins、inexorableFate、realmOfDeath、trappedSpirits、witchcraft、theWatcher | 第二遭遇牌堆（幽灵牌堆）、双面幽灵地点、异端者多面/放逐、未了之事 |
| 5 | `forTheGreaterGood` | 崇高利益 | 05197 | `fgg` | forTheGreaterGood、cityOfSins、silverTwilightLodge、ancientEvils、darkCult、lockedDoors | 秘社内斗、Nathan Wick、机关盒与四把钥匙、异教徒身上的毁灭、陷阱守卫者 |
| 6 | `unionAndDisillusion` | 聚合幻灭 | 05238 | `uad` | unionAndDisillusion、inexorableFate、realmOfDeath、spectralPredators、ancientEvils、chillingCold、anettesCoven/silverTwilightLodge/theWatcher 放在一边 | 秘社与女巫集会二选一、阵法（Circle）双技能检定、火盆、4 张命运故事卡、幽灵敌人 |
| 7 | `inTheClutchesOfChaos` | 混沌魔掌 | 05284 | `icc` | inTheClutchesOfChaos、agentsOfAzathoth、nightgaunts、musicOfTheDamned、anettesCoven、cityOfSins、witchcraft、secretsOfTheUniverse、silverTwilightLodge、strikingFear | 阿卡姆地图、裂口/入侵（Breach/Incursion）、毁灭、Azathoth 的吹笛人、双变体子剧本 |
| 8 | `beforeTheBlackThrone` | 黑色王座 | 05325 | `bbt` | beforeTheBlackThrone、agentsOfAzathoth、inexorableFate、ancientEvils、darkCult | 阿撒托斯、黑色王座、Cosmos 牌库/Void 地点、毁灭计时、夜魇坐骑 |

流程：序章 → 巫异时刻 → 死亡门前 → 幕间 2《进步的代价》→ 隐秘之名 → 罪恶报应 → 崇高利益 → 幕间 3《核心圈》→ 聚合幻灭 → 混沌魔掌 → 幕间 4《扭转命运》→ 黑色王座 → 尾声。
幕间 1《失者名录》不是独立流程节点，而是序章结算中「失踪人口」的呈现；实现时不要硬塞一个空的幕间节点。

### 2.2 卡包与卡数

| 包 | 数量 | 构成 | M0 初始状态 |
| --- | --- | --- | --- |
| `tcuCampaign` | **237** | 9 张剧本参考卡、4 位故事调查员、4 张命运故事卡、94 个地点、27 个敌人、42 张诡计、30 张幕、19 张议程、8 张战役资产 | `catalog-only` |
| `tcuInvestigators` | **19** | 6 位正式调查员 + 7 张专属非弱点卡 + 6 张专属弱点 | `catalog-only` |
| `tcuPlayer` | **87** | 85 张普通玩家卡（50 支援 / 30 事件 / 5 技能）+ 2 张基础弱点 | `catalog-only` |
| 合计 | **343 主卡 + 34 关联面 = 377 印刷记录** | | 不重叠分区 |

商品包有 7 个（`tcu / wos / tsn / fgg / icc / uad / bbt`），但内容包按迁移契约合并为 3 个；`encounter_code` 是归包依据。

注意：4 位故事调查员（05046–05049）属于战役包，不属于 `tcuInvestigators`；他们只在序章可用，不进入选人列表、不参与构筑、不参与升级。

34 个关联面（b/c/… 码）是 M0 必须逐卡决定的事项：双面地点、异端者的 12 个状态面、命运故事卡等，行为不同就按自己的 `code` 建单卡文件；只是同一张卡的背面文本，则用 `card-identity.js` 的关联面/别名解析，不重复建行为文件。不要按「有 b 码就建 34 个空文件」处理。

### 2.3 调查员

| 调查员 | 职业 | 专属卡 | 专属弱点 |
| --- | --- | --- | --- |
| 05001 卡洛琳·弗恩 | 守护者 | 05007 催眠疗法 | 05008 理性思考 |
| 05002 乔·戴蒙德 | 探求者 | 05009 侦探的柯尔特1911式手枪 | 05010 悬案 |
| 05003 普雷斯顿·费尔蒙特 | 流浪者 | 05011 家族遗产 | 05012 秘社“债务” |
| 05004 黛安娜·史丹利 | 潜修者 | 05013 银暮匕首 / 05014 黑暗洞察 | 05015 可怕的秘密 |
| 05005 丽塔·杨 | 求生者 | 05016“我不会再逃了！” | 05017 兜帽人 |
| 05006 玛丽·朗博 | 潜修者 | 05018 神秘乐曲 | 05019 安息日男爵 |
| 05046 加弗瑞拉·米兹拉克 | 中立（故事） | — | — |
| 05047 杰罗姆·戴维斯 | 中立（故事） | — | — |
| 05048 瓦伦蒂诺·里瓦斯 | 中立（故事） | — | — |
| 05049 佩妮·怀特 | 中立（故事） | — | — |

牌库张数：卡洛琳 30、乔 40、普雷斯顿 30、黛安娜 35、丽塔 30、玛丽 30。乔的「直觉牌库（hunch deck，11 张洞察事件）」与黛安娜的「开局额外卡（黑暗洞察）」是 M1 的重点，不要按普通 30 张调查员处理。

基础弱点：05041《第十三幻象》、05042《高塔·XVI》。05042 同时是塔罗牌（基础弱点），实现时不要把它排除在塔罗槽规则之外。

审计口径：`tcuInvestigators` 的 19 张（6 位正式 + 7 张专属非弱点 + 6 张专属弱点）与 `tcuCampaign` 的 4 张序章故事调查员分开记；后者不计入选人、构筑、升级验收，也不计入「可构筑调查员」。

### 2.4 来源与锁定

M0 必须记录根目录、相对路径、SHA-256 与资源策略：

- 卡牌字段：`参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json`（中文）与 `cards.json`（英文主表）。
- 规则行为：`参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/` 下 `Campaigns/TheCircleUndone/`、`Scenario/Scenarios/TheCircleUndone/`、`{Act,Agenda,Asset,Enemy,Event,Location,Skill,Story,Treachery}/CardDefs/TheCircleUndone/`。
- 中文剧情：`参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone/`（10 个 JSON）。
- 剧本元数据：`参考资源/ArkhamHorror-main/frontend/src/arkham/data/theCircleUndone.json`（剧本 id、ReturnTo 映射、settings）。
- 卡图：`games/arkhamhorror/web/img/cards/05*` 与 `web/img/zh/cards/05*`；保留远程回退，不建循环专属目录。
- 参考项目只读；运行时不得依赖 `参考资源/`。

### 2.5 明确排除

- `Return to The Circle Undone`（54xxx）及其 9 个 ReturnTo 剧本；`54001` 等塔罗资产不进入本轮。
- 独立剧本（如《午夜假面舞会》等）与其他循环的卡。
- 任何「近似卡文」「看起来一样」的静默实现；未知机制默认阻断。

### 2.6 M0 产物与门禁

产物：

```text
artifacts/migration/tcu/
├─ scope.json                 # 卡号范围、来源哈希、基线、分片草案
├─ mechanism-scan.json        # 第 1 步
├─ primitive-plan.json        # 第 2 步
├─ primitive-catalog.json     # 主进程维护的原语快照
├─ primitive-requests/        # 子进程请求
├─ workers/<id>.json          # 子进程进度/阻塞
└─ reports/                   # 合并、队列、验收报告
```

登记项：

- `content/campaigns/theCircleUndone/manifest.js`、`shared.js`、`chapters.js` 占位（`buildCatalogChapter`）。
- `content/packs/tcuCampaign|tcuInvestigators|tcuPlayer/manifest.js`，全部 `catalog-only`。
- `content/registered.js` 注册 1 个战役 + 3 个包 + 9 个占位关卡；`assertLaunchable` 必须失败（战役不可启动，图鉴可见）。
- `content/mechanics.js` 暂不登记 `tcu*` 机制，或只登记已实现项。
- `tools/audit-tcu.mjs` 骨架（`--write/--check`）、`audit/tcu-migration.json` 骨架、`tests/tcu-migration.test.mjs` 骨架。
- 基线：`git rev-parse HEAD`、`npm run test:fast`、`npm run replay:fixtures`、来源哈希；当前 golden replay 为 13 局 / 786 步，M0 采的基线必须与它一致，差异逐条记账。

门禁：

- 377 条印刷记录全部有归属，三个包无重叠、无遗漏。
- 每个包 `cards[]` 的 `code` 与目录一致；`tcuCampaign` 的 `encounterGroupIds` 覆盖 21 个 TCU 遭遇组；`requiredPackIds` 只引用存在的包。
- 战役与 9 章均不可启动；未确认内容不得写成 `playable`。
- `scope.json` 可重复生成；来源变更时 `--check` 失败。

> **P1 状态（2026-10-23，完成）**
>
> - 产物：`artifacts/migration/tcu/scope.json`（377 条记录归属、来源 SHA-256、规则版本与 golden replay 基线、分片草案）、
>   `audit/tcu-migration.json`（P1 骨架：三包/战役/9 章状态、遭遇组、confirmations 空表、remaining 清单）、
>   `tools/scan-tcu-scope.mjs` 与 `tools/audit-tcu.mjs`（均 `--write/--check`，逐字节复算）。
> - 登记：`content/campaigns/theCircleUndone/{manifest,shared,chapters}.js`（9 章 `buildCatalogChapter` 占位）、
>   `content/packs/tcuCampaign|tcuInvestigators|tcuPlayer/manifest.js`（**237 / 19 / 87**，全部 `catalog-only`、
>   `rulesImplemented=0`、`deckbuilding=0`）、`content/registered.js` 注册 1 战役 + 3 包 + 9 占位关卡。
> - 归属：343 主卡（237 战役 + 19 调查员 + 87 玩家）+ 34 张关联面（按 `encounterCode` 归到战役包）= 377，无重叠无遗漏；
>   21 个遭遇组登记在 `tcuCampaign`（9 章组 + 12 共享组，camelCase id 与章节 id 一致）。
> - 门禁实测：`npm run scan:tcu:scope:check`、`npm run audit:tcu:check` 均退出 0 且 gate pass；
>   战役与 9 章全部 `catalog-only`，`assertLaunchableCampaign('theCircleUndone')` 抛「发布状态 catalog-only 不可启动」；
>   `tests/tcu-migration.test.mjs` 5 例通过；`npm run test:fast` 2458 例全绿；replay 13 局 / 786 步零变化。
> - 说明：本机 PATH 没有 git，`scope.json` 的 `gitHead` 记为 `null` 并附原因；基线以规则版本 + golden replay 计数 + 来源哈希固定。
>   `content/mechanics.js` 未登记任何 `tcu*` 机制（P4 才登记已实现关键词）。

---

## 3. 第 1 步：扫描新增机制

先扫描、不写卡。每个机制条目记录代表卡号、来源、是否已有通用实现、缺口、候选原语、风险。TCU 的机制分两层：**循环级**（跨章复用）与**章节专属**（只服务一章）。

### 3.1 循环级机制

| 机制 | 卡面/来源证据 | 现状 | 缺口与候选原语 | 风险 |
| --- | --- | --- | --- | --- |
| **闹鬼 Haunted** | 中文 40 张 / 英文 54 张卡面含 `Haunted -` / `闹鬼 -`；地点、诡计、议程都会写「结算你所在地点的所有闹鬼能力」 | 引擎无读点；只有 Carcosa 03094 留下的 `location.haunted = true` 死字段 | 需要「地点闹鬼能力」声明 + 失败检定窗口（调查失败；部分剧本还要求战斗/躲避失败或石板标记触发）+ `resolveHaunted(seat, locationId, times)`；支持「所有」「两次」「取消/替代」「无合法目标」 | **高**：自动结算、复数能力顺序、取消窗口、存档重放 |
| **幽灵界 Spectral** | 70 张卡面/特性命中；The Wages of Sin 有独立 `SpectralEncounterDeck`；幽灵地点带幽灵面（双面地点），序章也用到单面幽灵地点；部分幽灵敌人（如异端者）在非幽灵地点上不能交战/受伤 | 引擎只有 `encounterDeck` + `explorationDeck` 两堆；无 `spectral` 标识 | 第二遭遇牌堆（setup/deck-ops/look/encounter/api）+ 地点翻到幽灵面 + 双面/单面地点数据 + 牌堆面板 | **高**：牌堆抽取/洗回/弃牌、地点翻面、目标限制、UI |
| **塔罗牌组 Tarot Deck** | 序章 22 个大阿卡纳分支（The Fool 0 → The World XXI）；巫异时刻还有一次「塔罗占卜」选择 | 无；玩家塔罗槽位是另一件事 | 剧本级 22 张牌组（不是 05 卡表）+ 确定性洗牌 + 抽取/选择 + 正逆位 + 结果表 + 存档；`state.scenarioDecks.tarot` | **高**：22 分支、唯一性、确定性、UI |
| **塔罗槽位 Tarot Slot** | 7 张玩家卡（05023/05027/05031/05035/05039/05040/05042）；Anna Kaslow 给 2 个额外槽；Moon Pendant 给 1 个；开局入手效果 | 槽位容量、UI、图标已支持；卡牌与额外槽位、开局入手、构筑合法性未做 | 用 `modifiers.js` 的 `add:slot`（value `tarot`）做额外槽位，**不要写 `slot:tarot`**（不在 `MODIFIER_TARGETS`，注册期会抛错）；补「开局时若在起始手牌则入场」与 `The Tower` 的「在手牌中不能投入」 | 中：槽位与开局时机 |
| **阵法 Circle** | 15 张中文 / 8 张英文命中（05250–05257 等，集中在《聚合幻灭》）；`[action]: Circle.` + 多技能相加（2–4 项，最高 05257 的四技能合计 20） | 引擎无 `circle`；`performTest` 只接受单技能 | 多技能合成检定原语 + `actionKind: 'circle'`（借机攻击/行动计数沿用现有 `actionKind` 钩子）+ 地点行动入口 | 中高：检定值合成、难度、失败分支、AI |
| **通用谈判 Parley** | 16 张英文 / 19 张中文卡面；现有 `parley` 只是三个硬编码动作（`parley`/`parleyCultist`/`parleyLita`） | 行动种类已支持，敌人/地点上的通用「Parley - …」能力通道未打通 | 把谈判做成 `kind: 'action'` + `actionKind: 'parley'` 的通用能力；允许敌人/地点/剧情资产声明；补构筑「cards with parley」筛选（Preston） | 中：目标、失败分支、借机攻击豁免 |
| **遗留记忆 Memento** | 10 个 Memento（Mesmerizing Flute…Bloody Tree Carvings）；**不是印刷关键词**，是战役日志集合；《隐秘之名》《罪恶报应》发现；幕间与 `ThePathWindsBeforeYou` 按数量计分 | 记录层支持 `string[]` / `recordUnion` / `recordRemove` | 加 `mementosDiscovered: 'string[]'` + 中文名 + 发现/划掉 + 面板；不需要新引擎原语 | 低中：记录与 UI |
| **看守人 Watcher** | 13 张卡面；`YouAreBeingHunted` 记录；《看守人之拥》《看守人的掌握》；跨章出现 | 记录/分支支持；没有「战役敌人跨章追踪」的模式 | 用 `missingPersons`/`youAreBeingHunted` 记录 + 关卡 behavior 生成；需要「不因攻击而横置」等修正；补战役面板公开提示 | 中：跨章状态与公开信息 |
| **序章故事调查员** | 05046–05049；每位玩家选 1 位；少于 4 人时划掉未选者；无牌组、无弃牌堆、不能抽牌/与牌组互动 | 无 `storyInvestigator`/无牌组模式；调查员来自 `PLAYABLE_INVESTIGATOR_CODES` + `deckBuilderData()` | 新 `campaign effect`（选人/划掉）+ 临时调查员入口（固定属性、专属设置卡、无牌组）+ 初始化/存档/观察投影 | **高**：建局、AI、大厅、存档、UI |
| **绑定 Bonded** | 2 组：圣化之镜/舒缓旋律、密教辞典/鲜血仪式；每组 1 张主卡 + 3 份绑定副本 | 数据有 `bondedCards/bondedTo/bondedCount`；引擎无行为 | 绑定卡放在场外集合；入场检索 3 张、1 张入手 2 张洗回；离场收回；牌堆计数不入 30 张 | 中：集合、检索、洗回、UI |
| **裂口 Breach / 入侵 Incursion** | 《混沌魔掌》30 张；地点/幕上的裂口计数器，沿连接传播；骷髅值 = 裂口 + 毁灭 | 地点毁灭已支持；裂口/入侵是新计数器 | 地点 `breaches` 字段 + 增减/读取 + 幕/议程阈值 + 标记 UI | 中：计数器与剧本流程 |
| **异端者多面与放逐** | 《罪恶报应》6 个异端者、12 个面；`Unfinished Business` 可在敌人与威胁区剧情之间翻面；「不能以任何方式被击败」「放逐」 | 敌人多面/翻转/放逐无通用支持 | 敌人 `sides`/`flip`/`banish`/胜利区；也可以先在 `behavior.js` 用单章逻辑，登记为 `escape` | 中高：单章复杂度 |
| **Cosmos 牌库 / Void 地点** | 《黑色王座》11 张；面朝下地点牌库，抽 X 选 1，Void 地点可洗回；在场调查员/敌人一并搬走 | 无第三套地点牌库 | `scenarioDeck('cosmos')`、抽/选/放置、`shuffleLocationIntoDeck` | 高：牌库与地点搬移 |
| **火盆 Brazier** | 《聚合幻灭》17 张；地点布尔状态（点燃/熄灭）决定推进哪一版幕 | 地点没有通用布尔量 | `locationFlag('brazier')` + 目标/幕条件 + 标记 UI | 中：状态与幕分叉 |
| **战役资产入牌组** | 机关盒、黑书、四把钥匙；`addCampaignCardToDeck`（不洗入） | 有战役记录与资产，但「加入牌组/团队控制权转移/钥匙标记」的通用路径未确认 | `campaign-effects` 新 type 或 `scenarioRuntime` 原语；进牌组但不占 30 张 | 中 |
| **混乱袋** | 战役基础袋四档均 13 枚（仅 `skull×2`）；`cultist/tablet/elder_thing` 由剧本与幕间按分支加入（如巫异时刻、隐秘之名、幕间 2） | TFA 已支持四难度袋与运行时增删 | 写 `shared.js` 的 `CHAOS_BAGS` 为 13 枚基础袋；每章 `tcu-chaos.js` 负责符号取值与增删；不要照静态 16 枚表 | 中：数值与符号触发 |

### 3.2 章节专属机制

| 章节 | 专属内容 | 实现提示 |
| --- | --- | --- |
| 序章 | 22 张塔罗牌组、4 位故事调查员、失踪人口/证据、幽灵看守人、单面幽灵地点 | 与《巫异时刻》组成第一个垂直切片 |
| 巫异时刻 | 女巫集会、Anette Mason、Witches' Circle、塔罗占卜、Agents of Shub-Niggurath/Azathoth 放在一边 | 复用闹鬼 + 塔罗牌组 |
| 死亡门前 | 幽灵酒窖、Josef Meiger、银暮秘社、毁灭标记、幽光谱 | 复用幽灵界 |
| 隐秘之名 | 异次元地点、Keziah Mason/Nahab、Memento、黑书 | 复用 Memento/战役资产 |
| 罪恶报应 | 幽灵遭遇牌堆、双面幽灵地点、异端者多面/放逐、未了之事 | 幽灵界的最重章节 |
| 崇高利益 | 机关盒、四把钥匙、异教徒毁灭、陷阱守卫者、秘社内部选择 | 复用毁灭 + 战役资产 |
| 聚合幻灭 | 阵法行动、火盆、秘社/女巫集会阵营、4 张命运故事卡、幽灵敌人 | 新 `circle` + `locationFlag` |
| 混沌魔掌 | 阿卡姆地图、裂口/入侵、毁灭、Azathoth 吹笛人；双变体子剧本（受诅咒的歌声/宇宙之秘） | 新 `breach` 计数 |
| 黑色王座 | 阿撒托斯、黑色王座、Cosmos 牌库、Void 地点、毁灭计时、夜魇坐骑 | 大量一次性 script；允许 `resolve` 逃生口并登记 |

### 3.3 复用清单（不要重做）

| 已支持 | 用途 |
| --- | --- |
| `parley` 行动种类与借机攻击豁免 | 通用谈判的基础 |
| 地点/敌人上的毁灭标记（`doomCards` / `placeDoomOnCard`） | 死亡门前、崇高利益、混沌魔掌、黑色王座 |
| `string[]` 记录 + `recordUnion`/`recordRemove` | Memento、失踪人口、被看守人抓走、被幽灵夺走 |
| 双面地点 `frontCode/backCode` + `revealLocation`/`flipScenarioLocation` | 幽灵界地点翻面 |
| 战役 `flow` 的 `branch`/`record`/`includes` | 看守人、阵营、结局分支 |
| 现有核心/前循环遭遇组 | `chillingCold`、`ancientEvils`、`darkCult`、`rats`、`strikingFear`、`lockedDoors`、`nightgaunts`、`agentsOfShubNiggurath`、`theMidnightMasks`（2 张）已在项目中；TCU 只引用，不重写 |

### 3.4 扫描产物与门禁

- 产物：`artifacts/migration/tcu/mechanism-scan.json`。
- 每张 05 卡至少出现在一个机制条目；未分类卡为 0。
- `type=primitive` 的条目全部进入 §4；`type=keyword/rulebook` 进入 §5；`type=interaction` 进入 §6；`type=scenario` 进入 §7.3。
- 未知机制默认阻断，不得用近似卡文静默过关。

---

## 4. 第 2 步：拆分原语与通用层改动

原则不变：**先原语、后卡牌**；卡只能使用已登记原语；需要新原语时按规范 §4.6.3 排队给主进程。TCU 不新增 `ability.js` 的 kind（`architecture-guard` 冻结 12 种），优先用现有 kind + 新窗口 + 新 `ctx.api` / `scenarioRuntime` 原语。

### 4.1 原语实现顺序

| 序 | 原语 | 落点 | 最小 API/读点 | 必测 |
| --- | --- | --- | --- | --- |
| P2.1 | 闹鬼结算 | `windows.js` + `scenario-runtime.js` + 地点描述子 | `resolveHaunted(seat, { locationId, times })`；失败窗口区分 investigate/fight/evade | 调查失败触发、复数能力顺序、取消、两次、无能力、存档 |
| P2.2 | 幽灵界第二牌堆 | `setup.js`/`deck-ops.js`/`encounter.js`/`look.js` + `scenarioRuntime` | `setExtraEncounterDeck(state, id, cards)`、`drawFromDeck('spectral')`、`shuffleInto('spectral')`；牌堆公开张数 | 建堆、抽牌、洗回、弃牌、存档、隐私 |
| P2.3 | 幽灵地点与翻面 | `locations.js` + `scenario-manifest.js` + `presentation-state.js` | `locationRule.back` 或 `flipLocationToSpectral`；双面/单面幽灵地点数据；非幽灵地点目标限制 | 翻面、连接、线索/毁灭保留、离开、存档 |
| P2.4 | 塔罗牌组 | `src/cards/campaign-plugin.js` + `campaign-state.js` + `scenarioRuntime` | `drawTarot(seat, { count, mode })`、`chooseTarot`、`upright/reverse`、22 张唯一 | 洗牌确定性、重复抽取、选择、存档、桌面/移动投影 |
| P2.5 | 阵法行动 | `tests.js`/`moves.js`/`table-decisions.js` | 多技能（2–4 项）合成检定 + `actionKind:'circle'` + 地点行动入口 | 合法/非法、技能值合成、难度、失败、借机攻击 |
| P2.6 | 序章故事调查员 | `campaign-effects` + `setup.js` + `availability` 的临时入口 | `kind:'storyInvestigators'`：选人、划掉未选、固定属性、无牌组、专属设置卡 | 1–4 人、重复选择、存档、观察投影、AI |
| P2.7 | 通用谈判 | `ability.js` 的 `action` + `actionKind` + `moves.js` | 敌人/地点/剧情资产声明 `Parley`；目标 + 检定 + 失败分支 | 合法目标、失败、借机攻击、AI |
| P2.8 | 绑定 | `zones.js` + `deck-ops.js` + `look.js` + `api-card.js` | 场外绑定集合、检索 3 张、洗回、离场收回 | 入场/离场、牌堆计数、存档、UI |
| P2.9 | 塔罗槽位补全 | `modifiers.js` + `deckbuilding.js` + 单卡条目 | `add:slot` value `tarot`；开局入手入场；`The Tower` 禁止投入 | 1–4 个槽、超槽、开局、构筑、非法投入 |
| P2.10 | Memento/看守人/战役资产 | `campaign-plugin.js` + `campaign-state.js` + `campaign-effects.js` | `recordUnion('mementosDiscovered')`、`addCampaignCardToDeck`、看守人修正 | 发现/划掉、数量分支、牌组、跨章 |
| P2.11 | 裂口与地点状态 | `rules-state.js` + `locations.js` + `presentation-state.js` | `addBreach/removeBreach`、`locationFlag('brazier')`、地点毁灭读点、幕/议程阈值 | 增减、上限、骷髅值、火盆、UI |
| P2.12 | 异端者多面/放逐 | `enemies.js` + `zones.js` + 单章 `behavior.js` | `flipEnemy`/`banishEnemy`/胜利区；先允许 `resolve` 逃生口 | 翻面、不能击败、放逐、胜利区、存档 |
| P2.13 | Cosmos 牌库 | `scenario-runtime.js` + `deck-ops.js` + `look.js` + `presentation-state.js` | `scenarioDeck('cosmos')`、抽 X 选 1、`shuffleLocationIntoDeck`、在场单位搬移 | 建堆、抽取、洗回、地点搬移、存档 |

### 4.2 每个新原语的五件套

按规范 §4.3，每个 `new` 原语必须同时具备：

1. 通用实现（`effects.js` / `api-*.js` / `ability.js` / `modifiers.js` / `scenario-runtime.js`，按所属层）；
2. 注册期校验（参数形状、未知目标、未知窗口在加载时失败）；
3. Node 单测：正常、无合法目标、费用/条件不足、存档往返；
4. 文档条目（写进 `primitive-plan.json` 的 `docs`；稳定原语再补引擎模块注释或 `docs/card-entry-files.md`）；
5. 对既有卡零行为变化（`replay-fixtures --compare`）。

### 4.3 逃生口

允许留在 `resolve(ctx)` 的一次性逻辑，必须在 `primitive-plan.json` 的 `escape` 登记卡号与理由，例如：

- 《黑色王座》的阿撒托斯终局脚本；
- 《罪恶报应》单个异端者面的特殊分支；
- 《聚合幻灭》命运故事卡的单卡分支。

不得把可复用的闹鬼/幽灵界/塔罗/阵法写成 `resolve` 来绕过队列。

### 4.4 门禁

- 所有 `new` 原语 `status=done` 且有测试；`reuse` 的引用在 `EFFECT_PRIMITIVES` / `ctx.api` / `scenarioRuntime` 中可查。
- `escape` 只含单卡/单章逻辑，且有理由。
- `engine.js` 无 05 卡号分支；`src/engine` 不出现 `tcu|theCircleUndone` 字样（`phase6-guard`）。
- `src/cards` 与 `content` 不得 import `engine/engine.js`；`web/**` 只能从 `web/` 内相对导入（`architecture-guard`）。
- `npm run test:fast` 无新增失败；`replay-fixtures --compare` 行为零变化。
- `primitive-catalog.json` 更新，worker 只读。

> **P3 状态（2026-10-23，完成：13/13）**
>
> - 账本工具已落地：`tools/tcu-primitive-spec.mjs`（计划）+ `tools/audit-tcu-primitives.mjs`（`--write/--check`），生成
>   `artifacts/migration/tcu/primitive-plan.json` 与 `primitive-catalog.json`。状态由代码读点枚举 + `node --test` 实跑 + 文件哈希
>   计算，不手写；`--check` 逐字节复算，门禁不通过即非零退出（`npm run audit:tcu:primitives`）。
> - **已完成 P2.1–P2.13（全部原语）**（按 §4.1 顺序）：
>   - P2.1 闹鬼：`src/engine/haunted.js`、`haunted` 窗口、调查失败接线、开局/注册期校验、`scenarioRuntime.haunted/hauntedAt/hauntedIs/grantHaunted/clearHauntedGrants`；
>   - P2.2 第二遭遇牌堆：`src/engine/alt-decks.js`、`drawEncounter(..., { deck: 'spectral' })`、`scenarioRuntime.extraDeck/drawExtra/...`、公开投影只在建堆关卡出现；
>   - P2.3 幽灵地点：`spectralFaceOf`/`isSpectralLocation`、`flipLocationFace`（`back` 面数据 + 保留线索/毁灭）、注册期校验、`flipSpectral/isSpectral`；
>   - P2.4 塔罗牌组：`src/engine/tarot.js`（22 张、正逆位、抽 N 选 1、洗回/弃置）、`api.tarot.*`、投影；
>   - P2.5 阵法：`performTest` 接受 2–4 个技能（求和）、`normalizeTestSkills`/`testSkillLabel`、`actionKind` 记录、单技能零变化；
   - P2.6 无牌组故事调查员：`src/engine/story-investigators.js`（每座位选人/划掉/换回/无牌组准备）、`setup.js` 在 `prepareInvestigator` 之前选人、
     `drawCards` 与换牌跳过、`setup.storyInvestigators` 关卡声明、注册期校验、公开投影；
   - P2.7 通用谈判：`src/engine/parley.js`（读点/枚举/目标校验）、实体条目 `kind:'action' + actionKind:'parley'`、
     `doEntityAbility` 走同一条 `executeDescriptor` 管线、借机攻击豁免、`isParleyCard` 构筑读点；
   - P2.8 绑定：`src/engine/bonded.js`（卡面 bondedCards/bondedTo 解析、场外集合、入场 1+2、离场收回、`returnAllBonded` 兜底）、
     `ctx.api.bonded`、章节开始时收回散落副本、公开投影；
   - P2.9 塔罗槽位与开局入场：`src/engine/tarot-slot.js`（槽位读数、开局入场、手牌封锁、换牌保护）、
     `setup.js`/`tests.js`/`table-decisions.js`/`ability.js` 四个读点；
   - P2.10 遗留记忆/看守人/战役资产：`src/campaign/mementos.js`、`addCampaignCardToDeck` 战役效果、`api.campaignCard`、公开投影；
   - P2.11 裂口与地点布尔状态：`src/engine/location-state.js`（breaches/flags/skullValue/投影）、`api.breach/locationFlag`；
   - P2.12 异端者多面与放逐：`src/engine/enemy-faces.js`（面表/换面/放逐/不能击败）、`api.flipEnemy/banish/enemyFace`；
   - P2.13 Cosmos / 未知地点牌库：`alt-decks.js` 的地点牌库（建堆/抽 X 选 1/洗回/弃置）、`api.cosmos/locationDeck`。
>   测试：13 个 `tests/tcu-primitives-*.test.mjs` 共 116 例；文档 [`tcu-primitives.md`](tcu-primitives.md)。
>   **`npm run audit:tcu:primitives` 门禁已通过（13/13 done、19/20 机制由原语覆盖、engineBoundary 通过）**；
> - 覆盖率：20 个 `type=primitive` 机制中 19 个由原语覆盖；`hunchDeck` 记为 `deferredTo: 'P6'`（调查员专属牌库，不进引擎通用层）。
> - 已复核的门禁：`npm run test:fast` **2453 例全绿**（基线 2337 + 116 新例）；`replay-fixtures --compare` 13 局 / 786 步逐条一致；
>   `phase6-guard`（含 `tcu` 禁词）通过；`audit/ability-coverage.json` 的 `windows` 56 → 57（新增 `haunted` 窗口，随迁移提交）；
>   `baseline:check` 14/14 审计、docLinks 与 golden replay 一致。
> - 未做：`state.hauntedGaps` 还没有审计读点（P8 逐章验收时接进 `literalCardBehavior`/`gaps`）；原语队列（`primitive-requests/`）
>   与 worker 协议仍属 P7/P8 的试点内容；P1（三包 + 9 章占位 + `audit/tcu-migration.json` 骨架）仍未建立。

---

## 5. 第 3 步：关键词与规则书

### 5.1 关键词事实源

TCU 的关键词清单集中在 `content/campaigns/theCircleUndone/keywords.js`，作为审计、测试、规则书共用的唯一事实源。建议：

| id | 印刷词 | 中文 | ruleId | 代表卡号 | 实现要点 |
| --- | --- | --- | --- | --- | --- |
| `haunted` | Haunted | 闹鬼 | `tcuHaunted` | 05043/05050/05065/05161/05238 等 | 地点失败检定后结算；支持复数与两次 |
| `spectral` | Spectral | 幽灵 | `tcuSpectral` | 05065/05161/05238/05055b 等 | 第二遭遇牌堆 + 双面/单面地点 + 目标限制 |
| `circle` | Circle | 阵法 | `tcuCircle` | 05250–05257 | 多技能合成检定（2–4 项） |
| `tarotDeck` | Tarot | 塔罗 | `tcuTarot` | 序章 + 巫异时刻（22 张大阿卡纳） | 剧本牌组，不是玩家卡 |
| `tarotSlot` | Tarot | 塔罗 | `tcuTarotSlot` | 05023/05027/05031/05035/05039/05040/05042、05283 | 槽位与额外槽位 |
| `parley` | Parley | 谈判 | **已有 `parley` 规则条目** | 05020/05076/05085/05095/05096/05097/05217/05218 等 | 只补卡文直达与行为，不新建重复条目 |
| `bonded` | Bonded | 绑定 | `tcuBonded` | 05313/05314、05316/05317 | 场外绑定集合与检索 |
| `memento` | Memento | 遗留记忆 | `tcuMemento` | 10 个 Memento、幕间/结局、`ThePathWindsBeforeYou` 计分 | 记录集合与数量分支 |
| `watcher` | Watcher | 看守人 | `tcuWatcher` | 13 张卡、`YouAreBeingHunted` | 跨章敌人/记录 |
| `storyInvestigator` | — | 序章调查员 | `tcuPrologue` | 05046–05049 | 无牌组、选人、划掉 |
| `breach` | Breach | 裂口 | `tcuBreaches` | 混沌魔掌地点/幕 | 计数与阈值 |

> 说明：`memento`、`watcher`、`storyInvestigator` **不是卡面印刷关键词**，是机制 id；`spectral` 是特性；`haunted`、`circle`、`parley`、`bonded` 是印刷词。审计与规则书仍把它们单列，避免「卡牌特殊效果」把机制吞掉。

规则书条目建议 11 条：`tcuCampaign`、`tcuHaunted`、`tcuSpectral`、`tcuCircle`、`tcuTarot`、`tcuTarotSlot`、`tcuBonded`、`tcuMemento`、`tcuWatcher`、`tcuPrologue`、`tcuBreaches`；`tcuChaos` 可单独一条讲混乱符号。每条必须：

- 卡面来源（代表卡号）；
- 引擎行为（模块/函数/窗口）；
- Node 验收（成功、失败、时机冲突、存档）；
- 规则书条目；
- 卡文与详情页直达；
- 桌面 1440 与移动 390 可读、可跳转、可返回。

### 5.2 规则书实现位置

- `web/rulebook-data.js` 的 `RULES` 增加 `entry(...)`；
- **必须**同步 `RULE_PINYIN`，否则 `RULE_INDEX` 建索引时会读 `[0]` 抛错；
- `cardRuleIds` 增加 `^05\d{3}` 分支（照 04 分支），让 05 剧本卡/幕/议程/地点/敌人/诡计直达条目；
- `web/ui-cards.js` 的 `scenarioCards` 补 9 张剧本参考卡；
- 规则描述以当前实现为准，不得把未实现的原版规则写成可用。

### 5.3 门禁

- 关键词全部 `verified`；规则书 `campaignOverview / scenarioMechanics / keywordEntries / cardLinks / desktopBrowser / mobileBrowser` 全真。
- 规则书搜索、关联跳转、移动端返回有 Playwright 用例；截图放 `artifacts/tcu-migration/`。
- 未确认的关键词不得在卡牌文件里使用。

> **P4 状态（2026-10-23，完成）**
>
> - 产物：`content/campaigns/theCircleUndone/keywords.js`（**唯一事实源**，16 行：
>   11 个路线图关键词 + 5 个在第 1 步扫描里同样声明了 `ruleId` 的机制/规则条目 `chaos / heretic / cosmos / brazier / campaignAsset`；
>   每行带 `mechanismId`、`ruleId`、卡面判据 `pattern`、代表卡号、引擎读点与 `implemented` 标记）；
>   `web/rulebook-data.js` 的 16 条「万象无终」规则条目 + 拼音索引 + `^05` 卡文直达分支；
>   `web/ui-cards.js` 的 9 张剧本参考卡与 `rulebookReferences`（序章调查员/设置卡/战役资产的卡号表，
>   浏览器端唯一的卡号来源）；`content/mechanics.js` 登记 14 个 `tcu*` 机制（`tcuChaos` 留到 P8）；
>   文档 [`tcu-rules.md`](tcu-rules.md)。
> - 事实源对齐：关键词表的 `mechanismId`/`ruleId` 与 `artifacts/migration/tcu/mechanism-scan.json` 逐条一致；
>   卡文直达的判据与 `keywords.js` 的 `pattern` 同一套，测试对 **377 条印刷记录逐张**验证
>   「卡面命中判据 ⇒ 必须已连到该条目」，并禁止 05 卡连到其他循环条目（只允许 `parley`/`script`）。
> - 门禁实测：`npm run test:tcu:rules` **13 例全绿**；`npm run audit:tcu:check` 复算一致（关键词 16/16 `verified`、
>   规则书 6 项全真、13/13 原语、14 个机制登记、`nodeAcceptance` 实跑 13/13）；
>   `npm run scan:tcu:scope:check`、`npm run scan:tcu:check`、`npm run audit:tcu:primitives` 均退出 0；
>   `npm run test:fast` **2471 例全绿**（= P1 状态记录的 2458 + 第 3 步新增的 13 例；P3 状态里的 2453 是该批次
>   统计时的旧口径，以本次实测为准）；`replay-fixtures --compare` 13 局 / 786 步零变化；
>   文档链接 0 失效。
> - 浏览器证据**由 runner 生成**：`tests/tcu-rules.browser.mjs` 四条用例（桌面 1440×950 / 移动 390×844 各两条：
>   目录/搜索/关联跳转/返回、图鉴卡牌规则链接与焦点恢复）全部通过，截图
>   `artifacts/tcu-migration/p4-rulebook-{desktop,mobile}.png`，经 `tools/playwright-tcu-reporter.mjs`
>   写成 `audit/tcu-browser-acceptance.json`（不含耗时/时间戳，同一命令复跑逐字节相同）。
> - 顺带修掉一个既有缺陷：图鉴详情此前把 `detail.def` 传给 `cardRuleIds`，而 `def` 没有卡文，
>   `^04`/`^05` 这类按卡文判定的条目会被通用条目挤出前 10 个名额；现在改为传已加载的卡面
>   `{ ...detail.def, ...card }`，战役条目优先显示（TFA/Carcosa 同样受益）。
> - 未做：`tcuChaos` 的逐章符号效果（P8 的 `tcu-chaos.js`）——规则书条目已显式写「尚未实现」，
>   `content/mechanics.js` 也**没有**登记它；9 章剧本、其余卡牌与剧情仍属 P8/P7/P9。

---

## 6. 第 4 步：新增交互与界面

批量写卡之前完成。TCU 的交互比 TFA 多，且集中在「牌桌状态 + 选择面板」，应尽量复用现有组件。

| 交互 | 触发 | 复用/新增 | 状态与验收 |
| --- | --- | --- | --- |
| 塔罗抽牌/选择 | 序章、巫异时刻 | 新增 `pickTarot` choice kind；复用 `observation` 的 `pendingChoice` 与 hub 的 `pendingChoicePane`/`supply-picker` 样式 | 正/逆位、牌面、已抽集合、确认/取消；桌面/移动 |
| 序章选调查员 | 序章开始 | 新增 campaign effect + choice；复用 `expeditionLeader`/`pickSupplies` 的选择面板 | 1–4 人、划掉未选者、无牌组提示；桌面/移动 |
| 闹鬼结算 | 调查失败后 | 复用 `choice`/`pendingChoice`；新增「地点闹鬼」提示与来源高亮 | 单个/多个能力、顺序、取消、两次、无合法目标 |
| 幽灵界 | 进入/翻开幽灵地点、抽幽灵牌 | 复用 `revealLocation` 翻面动画、`table-regions` 地图区；新增第二牌堆面板/幽灵标记 | 牌堆张数、弃牌、翻面、非幽灵地点限制 |
| 阵法 | 地点行动 | 复用 `legalMoves` 动作按钮；新增多技能检定面板（2–4 个技能值 + 合计） | 合法/非法、技能组合、难度、失败 |
| 谈判 | 敌人/地点 | 复用 `entityMoves`/`targetMoves` 与 `actionKind` | 目标、失败、借机攻击提示 |
| 遗留记忆/记录 | 发现/划掉、幕间 | 复用 `campaign-records.js`（`string[]` 已能显示） | 列表、中文名、数量分支 |
| 看守人/战役面板 | 跨章 | 复用战役面板与 `agentHints`；只投影公开信息 | 是否被追捕、公开提示，不泄露私有分支 |
| 裂口/毁灭 | 地点 | 复用 `placedCardMarkers`/`doomClockLabel` | 逐地点标记、幕/议程合计 |
| 异端者翻面/放逐 | 罪恶报应 | 复用翻面动画与详情背面 | 多面、不能击败、胜利区 |
| 塔罗槽位 | 构筑/牌桌 | 现有槽位 UI 直接复用 | 1–4 个槽、超槽提示、开局入场 |

统一要求：

- 只使用 `web/` 现有组件、CSS 变量、间距/字号/圆角/颜色/动画；不得写死颜色或卡号分支。
- 交互状态由服务端 `requestChoice`/`presentation-state`/观察投影产生；浏览器只提交合法动作。
- 可用、不可用（带原因）、空候选、提交中、失败重试、取消恢复齐全；键盘/触屏都可操作。
- 桌面 1440×900、移动 390×844 各至少一张截图；截图放 `artifacts/tcu-migration/`，不进运行目录。
- 新交互在卡牌批次前跑 Playwright；至少覆盖桌面和移动各一条真实路径。

> **P5 状态（2026-10-23，完成交互层）**
>
> - 产物：`web/tcu-ui.js`（四个面板模型 + 四个渲染函数 + 地点徽标/异端者面/多技能读数）与 `web/tcu-panels.css`；
>   接进 `web/game-ui.js` 的桌面待决选择区（塔罗 / 序章选人 / 闹鬼）、`web/hub.js` 的大厅待决选择区与档案页
>   （遗留记忆胶囊、看守人公开提示）、`web/situation-view.js` 的「剧本状态」块、地点卡徽标与敌人面标签。
> - 服务端协议：`chooseTarot` 产出 `kind: 'pickTarot'` 选择，选项带编号/正逆位/中英文名；
>   `selectStoryInvestigators` 的选择带 `seatCount` 与职业/属性/生命理智；`resolveHaunted` 的 `source`
>   带 `locationId`/`abilityId`/`text`。界面只发 `legalMoves` 里的 `choose`，没有动作的选项置灰并写明原因。
> - 顺带修掉两个既有缺陷：① `campaignProjection` 的 `locations` 会覆盖观察投影里的地点数组（一出现裂口/火盆
>   就会把整张地图变成 id 表），已改名 `locationStates` 并加回归断言；② 图鉴详情的规则链接此前拿不到卡文，
>   已改为传已加载的卡面（P4 修复，P5 复用）。
> - 门禁实测：`npm run test:tcu:interactions` **6 例全绿**；`npm run test:tcu:interactions:browser`
>   规则书 4 条 + 交互 2 条全部通过（桌面 1440×950 / 移动 390×844），截图
>   `artifacts/tcu-migration/p5-interactions-{desktop,mobile}.png`；`npm run audit:tcu:check` 复算一致
>   （`interactionsVerified` 11/11、`confirmations.interactions.checks` 全真）；
>   `npm run test:fast` **2477 例全绿**（P4 的 2471 + 交互 6 例）；`replay-fixtures --compare` 13 局 / 786 步零变化；
>   TFA/Carcosa 的规则书与补给品浏览器用例 10 条复跑通过（共享 UI 改动无回归）。
> - **如实说明（未满足本批「真实路径」判据）**：战役与 9 章仍是 `catalog-only`，序章/章节内容属 P8，
>   所以当前的浏览器证据是**组件级**的——真实模块、真实样式表、引擎现场产出的会话状态、真实提交动作，
>   但不是从大厅进入剧情后的实机路径。该缺口由账本的 `remaining` 自动列出（「交互实机路径待 P8」），
>   P8 接通序章后必须补跑并把 `desktopBrowser`/`mobileBrowser` 换成实机路径证据。
> - 已知边界：火盆只记录「已点燃」（熄灭 = 清除标记），徽标只在点燃时出现；章节需要显示「熄灭」时要在
>   地点数据里声明火盆（P8）。幽灵敌人的目标限制仍由章节 `canFightEnemy` 读 `isSpectral`（P8）。
> - 文档：[`tcu-interactions.md`](tcu-interactions.md)。

---

## 7. 第 5 步：批量迁移内容（M1–M3）

### 7.1 M1 调查员

批次建议：

- **M1-A**：05001 卡洛琳、05002 乔 + 各自专属/弱点；先验证「治疗恐惧 → 资源」「直觉牌库/开局额外卡」类能力与开局。
- **M1-B**：05003 普雷斯顿、05004 黛安娜 + 专属/弱点；验证「金钱/家族遗产」「黑暗洞察/银暮匕首」与额外开局卡。
- **M1-C**：05005 丽塔、05006 玛丽 + 专属/弱点；验证「闪避/移动」「法术/神秘乐曲」。
- **M1-D**：4 位序章故事调查员；只做序章建局、设置卡、无牌组限制与记录，不做选人/构筑/升级。

每位正式调查员必须通过：初始化、主能力、旧印、构筑规则、专属卡、专属弱点、存档恢复、负面路径（1–4 人、非法目标、重复触发）。完成前不得加入选人列表。

> **P6 状态（2026-10-23，完成 M1）**
>
> - 产物：6 位正式调查员 + 13 张专属卡 + 4 位序章故事调查员的单卡文件
>   （`src/cards/entries/05001–05019`、`05046–05049`）；三个调查员专属读点模块
>   `src/engine/hunch-deck.js`（直觉牌库）、`src/engine/resource-bank.js`（资源寄存）、
>   `src/engine/spell-actions.js`（法术专用额外行动），以及 `src/engine/cancel-note.js`（取消记账）；
>   文档 [`tcu-investigators.md`](tcu-investigators.md)；`tests/tcu-investigators.test.mjs` **33 例**。
> - 选人与构筑：`PLAYABLE_INVESTIGATOR_CODES` 增加 6 位（05001–05006），13 张专属卡进
>   `SIGNATURES_BY_INVESTIGATOR` 且只作依赖；牌组张数 30/40/30/35/30/30，专属卡与随机基础弱点按卡面；
>   构筑规则补上卡表里的三种新写法——`not: true` 的**排除项**（无高等级武器／无违法卡）、
>   `text` 正则 + `hh` / `st` 标签（「治愈……恐惧」与[[法术]]），以及乔的「至少 11 张[[洞察]]事件」配额
>   （自动构筑先放配额、手动构筑缺额报错）。
> - 四个新窗口：`horrorHealed`（治疗恐惧的唯一入口 `healHorrorFrom`）、`cardCancelled`
>   （`executeDescriptor` 记录 `_resolvingCardCode`，取消方卡号不靠调用点传）、`enemyAttacked`、
>   `agendaWouldAdvance`（05018 神秘乐曲的「本阶段不因毁灭阈值推进」）。
> - 逐人验收：卡洛琳（治疗触发资源／理性思考吸收恐惧并封锁资源）、乔（11 张洞察、揭示、-2 费用、
>   洗回、悬案改入威胁区域、旧印回收洞察）、普雷斯顿（寄存 4/回合开始、回合结束弃掉、旧印花 2 资源自动成功）、
>   黛安娜（底下每张 +1 意志、取消后压卡+抽牌+资源、5 张上限）、丽塔（躲避后伤害／移动、每轮一次、
>   旧印放开限制）、玛丽（有毁灭标记才给的**只能用于法术**的额外行动、旧印增减毁灭）。
>   序章 4 位故事调查员仍不进选人、无牌组，卡面能力与旧印同样验收。
> - 门禁实测：`npm run test:tcu:investigators` 33 例全绿；`npm run audit:tcu:check` 复算一致
>   （`gate.investigatorsVerified` 6/6 + 4/4 + 13/13、`gate.packsByPhase` 调查员包 `verified` 19/19、
>   战役包 `catalog-only` + 4 张故事调查员、玩家包 0）；`npm run plan:tcu:primitives` **14/14 done**
>   （原本 `deferredTo: 'P6'` 的 `hunchDeck` 已登记为第 14 个原语，机制覆盖 20/20）；
>   `npm run test:fast` **2510 例全绿**；`replay-fixtures` 13 局 / 786 步零变化；文档链接 0 失效。
> - **如实说明（显式简化 5 条，已进 `remaining`）**：05009 的「最多 2 张[[工具]]不占双手」、
>   05010 的「游戏结束少 2 XP」、05012 的「仍在手牌则 1 点精神创伤」（本引擎弱点抽到即结算，不可达）、
>   05013 的「把黛安娜底下的卡当手牌打出/投入」、05019 的「少于 3 个毁灭标记不能离场」尚未实现，
>   逐条写在条目 `note` 与账本 `remaining` 里，不宣称规则等价。
> - 未做：M2 的 87 张玩家卡与 2 张基础弱点（05041/05042 仍不进构筑池，P7）；序章的故事调查员**场景**选人、
>   塔罗抽牌与记录属 P8；浏览器实机路径仍待 P8。

### 7.2 M2 玩家卡（87 张）

按职业/机制分 4–5 波（每波约 17–34 张；超过 25 张的波次再切子片），逐卡验收：

| 波次 | 内容 | 重点 |
| --- | --- | --- |
| M2-A | 塔罗组（7 张）+ 已有 5 张样本复核 + 中立/基础弱点 | 塔罗槽位、开局入手、`The Tower` 禁止投入、05112 的简化是否补齐 |
| M2-B | 守护者 + 探求者 | 武器/子弹、治疗/恐惧、调查加成、经验升级 |
| M2-C | 流浪者 + 潜修者 | 谈判、法术、充能、额外行动 |
| M2-D | 求生者 + 绑定/永久/卓越/升级 | 绑定（圣化之镜/密教辞典）、永久卡、卓越卡、升级路径 |

每张卡必须登记费用、槽位、使用次数、时机、目标、检定、升级、永久、卓越、放逐；有行为测试与审计账本证据。可构筑数以 `availability` 验收后为准（预计 85 张，2 张基础弱点只作依赖）。

### 7.3 M3 剧本（9 章，3 波）

| 波次 | 章节 | 目的 | 主要交付 |
| --- | --- | --- | --- |
| **M3-1（垂直切片）** | 序章、巫异时刻、死亡门前 | 先打通「塔罗牌组 + 无牌组调查员 + 闹鬼 + 幽灵界 + 看守人 + 第一组记录」 | 3 章 `definition/layout/behavior/index`、遭遇组对照、混乱表、结局、章节测试、首个可玩路线 |
| **M3-2** | 隐秘之名、罪恶报应、崇高利益 | 加 Memento、幽灵第二牌堆、异端者多面/放逐、机关盒 | 3 章 + 第二牌堆/多面敌人测试 |
| **M3-3** | 聚合幻灭、混沌魔掌、黑色王座 | 加阵法、火盆、裂口、Cosmos、阿撒托斯终局 | 3 章 + 终局/结局/记录测试 |

每章统一交付：

```text
content/campaigns/theCircleUndone/scenarios/<id>/
├─ index.js        # 装配：scenario/identities/layout/behavior + manifest
├─ definition.js   # 地点/幕/议程/敌人/诡计/剧情资产/遭遇牌堆/结局/scriptCards
├─ layout.js       # 只做展示坐标与连线
└─ behavior.js     # 只放钩子；按需拆 helper
```

每章验收 12 项：`sourceLocked / identityRegistered / setupAndZones / actsAndAgendas / locationsAndConnections / encounterBehaviors / literalCardBehavior / chaosEffects / resolutionsAndRecords / storyText / saveReplay / browserAcceptance`。`literalCardBehavior` 必须逐张核对卡面，不得用「卡号出现在代码里」充数。

剧本卡行动归属：幕/议程上的 `[action]`/`[free]` 行动（包括阵法、撤退、点燃火盆等）必须在关卡定义里通过 `scenario.scriptCards` 或显式 `scriptCard` 标成 `act`/`agenda`；地点/敌人的行动用 `locationId`/`enemyId`，不得占用剧本区。

### 7.4 多子进程批量方案

TCU 是第一次真正执行规范 §4.6 的循环，先做**小分片试点**（1 个玩家卡分片 + 1 个非玩家卡分片），再全量。

| 角色 | 范围 |
| --- | --- |
| 主进程 | 3 个包清单、campaign 全部共享文件、两个索引、引擎/原语、`content/mechanics.js`、`docs/`、`audit/`、`artifacts/migration/tcu/` |
| 玩家卡 worker | 每片 20–25 张，`scaffold-card --entry --no-index`，只写 `entries/<code>.js` |
| 非玩家卡 worker | 每片 20–35 张，`scaffold-card --encounter --no-index`，只写 `encounter-entries/<归属目录>/<code>.js` |
| 原语队列 | 子进程写 `primitive-requests/*.json`；主进程去重、实现、补测试、回写 `done`；子进程轮询 |

分片草案：

- 玩家卡 87 → 4 片（约 22/片）。
- 战役卡 237 → 9 片（每章一片，约 26/片）；`shared/` 与 `campaign/_shared/` 的跨章遭遇组由主进程统一落点，不按 scope 切。
- 每个 worker 启动时只读 `mechanism-scan.json`、`primitive-plan.json`、`primitive-catalog.json`、本轮卡牌清单。
- 分片清单写入 `shards.json`，含 worker、codes、起止时间、输入快照哈希；两两交集为空。
- 索引只由主进程合并后重建一次（两个索引都重建）；worker 不得运行 `build-*-index`。
- 合并门禁：`cards:check`、`cards:encounter-check`、replay 一致、`test:fast` 无新增失败、队列无悬挂。

### 7.5 剧情（M3-C）

- 生成器：`tools/import-tcu-story.mjs --write/--check`，只读锁定的 10 个中文 JSON，生成 `content/campaigns/theCircleUndone/story-text.js`；运行时不读 `参考资源/`。
- 覆盖：序章、每章导入、4 段幕间、全部结局、尾声；序章还要保留 4 位调查员的独立引言与 22 个塔罗结果文本，只显示玩家实际选择/抽到的分支。
- 运行时：按进入该章时的战役记录选择分支；结局按实际结局键；幕间按该次访问保存的选择；仅指定调查员可见的正文必须座位级过滤。
- 测试：生成物与 `--check` 一致；每章有导入正文；每个可达结局有正文；无 HTML 控制标记；未触发分支不泄露；私密段落按座位过滤；旧存档不重写历史正文；序章只显示所选调查员的引言。
- 若某结局源文只有摘要，必须回退到可读正文并在账本登记，不得空字符串。

### 7.6 战役流程与记录

- `manifest.flow` 节点：序章（story + 塔罗/选人/记录）→ 9 章 → 3 个独立幕间节点 → 尾声；`endings` 逐条登记（阿撒托斯吞食宇宙、阿撒托斯沉睡、女巫集会掌控世界、调查员音讯全无、加入吹笛人、签署黑书、逆转咒语等，按参考 `Key.hs` 对账）。
- 参考 `Key.hs` **64 个键**；中文 `base.json.key` 只有 **63 个**，缺 `TheInvestigatorsReversedTheIncantation`，M0 补译名并逐键登记。
- `shared.js` 的 `recordTypes` 覆盖 64 个键；`MementosDiscovered`、`MissingPersons`、`WasTakenByTheWatcher`、`WasClaimedBySpecters`、`DisappearedIntoTheMist`、`WasPulledIntoTheSpectralRealm` 用 `string[]`；`PiecesOfEvidenceWereLeftBehind`、`ThePathWindsBeforeYou` 用 `number`；其余布尔。
- `recordLabels` 全部中文名；`recordDefaults` 与类型一致。
- Memento 10 项没有现成中文名（参考实现只有英文枚举），M0 补译名后写入 `recordLabels` 与故事资产；不要直接把英文枚举显示给玩家。
- 中文译名对账：`wos` 产品名「恶罪报应」vs 遭遇组「罪恶报应」、`tsn`「隐密之名」vs「隐秘之名」、05326 议程无译名；统一后写入 `recordLabels`/`story-text`/规则书，并在审计中记录取舍。
- 幕间 2/3/4 的选择、XP、混乱袋增删、记录写入必须由 `campaign-effects` 统一结算，不得混入叙事正文。
- 混乱袋：基础袋四档均 13 枚（仅 `skull×2`）；`cultist/tablet/elder_thing` 由剧本/幕间按分支加入。以每章 setup 为准写 `CHAOS_BAGS` 与 `tcu-chaos.js`，不硬编码在卡里。

---

## 8. 第 6 步：测试与验收（M5）

### 8.1 阶段矩阵

| 阶段 | 必跑 | 通过标准 |
| --- | --- | --- |
| 原语 | 新原语单测 + `npm run test:fast` | 正常/无目标/费用不足/存档往返；无新增失败 |
| 关键词/规则书 | `npm run audit:tcu` + 规则书浏览器 | 关键词/规则条目 `verified`；桌面/移动可读、可跳转 |
| 交互 | Playwright 桌面 1440 / 移动 390 | 可用、不可用原因、空状态、取消/重试；视觉与既有界面一致 |
| 批量卡牌 | `cards:check` + `cards:encounter-check` + replay + `test:fast` | 索引一致；行为零变化；无新增失败 |
| 剧本 | `npm run test:tcu:scenarios` + 逐章测试 + 存档回放 | 9 章 `development`；12 项检查有证据；无非法路线 |
| 发布 | `npm run test:tcu`、`npm run replay:fixtures`、`npm test`、`npm run presentation:check`、`npm run test:browser` | 三组确认 `verified`；全量回归；桌面/移动/联机 |

### 8.2 新增命令与产物

```powershell
npm run cards:check
npm run cards:encounter-check
npm run test:fast
node tools/replay-fixtures.mjs --baseline artifacts/migration/tcu/replay-before.json
node tools/replay-fixtures.mjs --compare  artifacts/migration/tcu/replay-before.json
npm run test:tcu
npm run test:tcu:scenarios
npm run test:tcu:investigators
npm run test:tcu:player
npm run test:tcu:mechanics
npm run test:tcu:story
npm run test:tcu:rules
npm run test:tcu:rules:browser
npm run audit:tcu
npm run audit:tcu:scenarios
npm run import:tcu-story:check
npm run replay:fixtures
npm test
npm run presentation:check
npm run test:browser
```

审计产物：

- `audit/tcu-migration.json`：`schemaVersion/milestone/campaignId/status/playable/launchEnabled/earlyAccess/equivalenceCertified/verifiedScope/catalog/playerCards/mechanics/scenarios/story/chapters/chaosBags/recordSchema/sources/resources/confirmations/tests/remaining`。
- `audit/tcu-scenario-acceptance.json`：9 章逐章 12 项 checks、inventory、文件哈希、`gaps`、`pendingEncounterCodes`、`testFile`。
- `audit/tcu-browser-acceptance.json`：**由 Playwright runner 生成**，记录桌面/移动用例、截图路径、通过状态；不得手工提交。
- `artifacts/migration/tcu/reports/{workers,primitive-queue,merge}.json`。

### 8.3 证据规则（从 TFA 的坏账吸取）

1. **一个事实源**：审计工具从 `content/`、卡文件、测试与浏览器报告计算，不读冻结 JSON 再复制；`--check` 必须能独立重算。
2. **账本形状抄 Carcosa，不抄 TFA**：采用 `audit/carcosa-migration.json` 的多组结构（investigators/playerCards/allCards 等）与 `carcosa-all-card-acceptance.json` 式逐卡账本；审计工具应 `spawnSync` 执行逐卡验收测试并哈希实现文件，而不是用 `testSource.includes(...)` 字符串匹配。TFA 的 `saveReplay` 就是后者，不能作为 TCU 模板。
3. **`remaining` 由计算得出**：从 `checks` 为 false 的项、`gaps`、`pendingEncounterCodes`、`blocked` 卡与未完成原语汇总；不得硬编码。
4. **浏览器证据可复现**：Playwright 输出 JSON → 账本；干净检出跑同一命令应得到同一结论。
5. **`literalCardBehavior` 必须逐卡**：不能用卡号搜索、`rulesPending:false`、文本非空、函数源码含卡号代替；参考 Carcosa 的 `literal-behavior / pending-encounters / implementation-gaps` 三个测试。
6. **简化显式**：`simplified: true` + `note` + 待实现清单；不得静默通过。
7. **区分失败**：报告区分「本轮新增失败」「可复现既有失败」「blocked 卡」「未完成原语」；任何 `blocked`/`rejected` 不能写成已迁移。

### 8.4 发布门禁

- 三组确认（剧本/关键词/规则书）全部 `verified` + `assertLaunchable('theCircleUndone')` 通过 + 大厅可见 + 桌面/移动浏览器通过 → `playable`。
- 若沿用 `earlyAccess`：`playable: true` + `earlyAccess: true` + `equivalenceCertified: false` + 完整 `remaining`；不得描述为规则等价。
- 发布前同步：`README.md` 进度表、`ARCHITECTURE.md` 当前边界、`content/registered.js`、`content/mechanics.js`、`src/deck/availability.js`、`src/deck/card-pool.js`、`web/deck-rules.js` 的 `CAMPAIGN_CYCLES`（`theCircleUndone: 5`）、`web/rulebook-data.js`、`web/ui-cards.js`、`web/campaign-presentation.js`。
- 卡池开放顺序：先调查员（M1）→ 再玩家卡（M2）→ 再战役启动（M3 全章）→ M5 全量开放；不得提前把目录卡放进构筑池。

---

## 9. 批次、依赖与关键路径

### 9.1 批次表

| 批次 | 内容 | 主要产物 | 完成判据 | 依赖 | 相对点数 |
| --- | --- | --- | --- | --- | --- |
| **P0** | 修基线 + 文档引用体检 | TFA `audit-tfa-scenarios --check` 恢复；`phase4-replay.md`/`architecture-refactor-roadmap.md` 等失效引用修复或改指向；基线快照 | `test:fast` 全绿；TFA 两个审计命令退出 0；文档链接无 404 | — | 0.3 |
| **P1** | M0 范围/来源/骨架 | `scope.json`、3 个 pack、campaign 占位、9 章占位、注册、审计骨架 | 377 条记录有归属；战役不可启动；哈希可复现 | P0 | 0.6 |
| **P2** | 机制扫描 | `mechanism-scan.json` | 每卡至少一个机制；未分类 0 | P1 | 0.4 |
| **P3** | 原语拆分与实现 | `primitive-plan.json`、`primitive-catalog.json`、引擎/内容层原语与测试 | 所有 new 原语 done；replay 零变化；`test:fast` 无新增失败 | P2 | 2.8 |
| **P4** | 关键词与规则书 | `keywords.js`、`rulebook-data.js`、桌面/移动用例 | 关键词全 verified；规则书 6 项全真 | P3（可部分并行） | 1.2 |
| **P5** | 交互与界面 | 塔罗/幽灵界/闹鬼/序章选人/阵法/记录面板 + 浏览器用例 | 桌面/移动各一条真实路径；无卡号 UI 分支 | P3 | 1.8 |
| **P6** | M1 调查员 | 6 位正式 + 4 位故事调查员、专属卡、测试 | 选人/构筑/存档/负面路径通过 | P3 | 1.7 |
| **P7** | M2 玩家卡 | 87 张逐卡验收、4–5 波、审计账本 | 87/87 verified；可构筑数确认 | P3/P4 | 1.0 |
| **P8** | M3 剧本 | 9 章三波、遭遇组、混乱表、结局、章节测试 | 9 章 development；12 项检查有证据 | P3/P5 | 3.8 |
| **P9** | M3-C 剧情 | `import-tcu-story.mjs`、`story-text.js`、隐私/分支测试 | `--check` 稳定；未触发分支不泄露；座位过滤 | P1（可与 P3 并行） | 0.9 |
| **P10** | M5 验收/发布 | 审计账本、浏览器报告、README/架构同步、全量回归 | 三组 verified；`assertLaunchable`；全量绿 | P4/P6/P7/P8/P9 | 1.8 |

合计约 **16.3 点**；以 TFA 为 1.0（约 14 点），TCU 约 **1.1–1.3×**。点数只用于排序与拆分，不换算成人日；实际吞吐取决于主进程与 worker 数。

规模对照：主卡 338→343、关联面 23→34、印刷记录 361→377；战役卡 231→237；调查员侧 16→23（10 位调查员 + 13 张专属）；玩家卡 91→87；章节 10→9；TCU 遭遇组 21（TFA 25）；剧本源码约 0.8×TFA。测试体量：TFA 27 个文件 / 约 608 例；TCU 预计 30+ 文件 / 700+ 例（9 章逐章 + 10 位调查员 + 87 张玩家卡 + 原语/规则/剧情/浏览器）。

### 9.2 关键路径与并行

```text
P0 → P1 → P2 → P3 → P5 → P8 → P10
                    ├→ P4 ──────┘
                    ├→ P6 ──────┘
                    ├→ P7 ──────┘
P1 ─────────────────→ P9 ──────┘
```

- **关键路径**：P0 → P1 → P2 → P3 → P5 → P8 → P10。
- **可并行**：P4（规则书）、P6（M1）、P7（M2）、P9（剧情）在 P3 部分完成后即可启动；P8 的 M3-1 垂直切片应优先，以便尽早暴露塔罗/幽灵界/无牌组调查员的风险。
- **不建议**：M2 与 M3 同时全量铺开；先把 M3-1 跑通再扩 M2，否则交互缺口会在批量写卡时反复返工。

### 9.3 建议的提交窗口

1. **窗口 A（P0–P2）**：基线、范围、扫描；只改文档、占位与审计骨架，不改行为。
2. **窗口 B（P3）**：原语；按 P2.1→P2.2→P2.3→P2.4→P2.5→P2.6→P2.7→P2.8→P2.9→P2.10→P2.11→P2.12→P2.13 分批提交，每批带测试与 replay 对比。
3. **窗口 C（P4–P6）**：规则书、交互、调查员；与窗口 B 后半段可交叉。
4. **窗口 D（P7–P9）**：玩家卡、剧本、剧情；先小分片试点，再全量。
5. **窗口 E（P10）**：验收、发布、文档同步。
6. **提交粒度 = 批次**：一阶段一提交，账本 `milestone` 与提交哈希对应；不要重演 TFA「219 个文件一个提交、里程碑只是字符串」的不可审计状态。

### 9.4 与 M0–M5 / 六步的对应

| 内容阶段 | 对应批次 | 说明 |
| --- | --- | --- |
| M0 目录与来源基线 | P1 | 三个包 `catalog-only`、9 章占位、来源哈希、审计骨架 |
| M1 调查员 | P6 | 6 位正式 + 4 位故事调查员；正式调查员逐人验收后才进选人 |
| M2 玩家卡 | P7 | 87 张 4–5 波；逐卡验收后才进构筑 |
| M3 剧本 | P8 + P9 | 9 章三波 + 剧情全文；章节可 `development`，战役全部确认前不可启动 |
| M4 关键词与规则书 | P4 | 关键词全 `verified`、规则书 6 项全真 |
| M5 发布 | P10 | 三组 `verified` + 全量回归 + 浏览器 + 大厅 |

| 六步 | 对应批次 |
| --- | --- |
| 第 0 步 锁定范围与基线 | P1 |
| 第 1 步 扫描新增机制 | P2 |
| 第 2 步 拆分原语 | P3 |
| 第 3 步 实现关键字与规则手册 | P4 |
| 第 4 步 实现新增交互与界面 | P5 |
| 第 5 步 批量迁移卡牌 | P7 + P8（多子进程 + 原语队列） |
| 第 6 步 测试与验收 | P10（各批也按 §8.1 阶段跑） |

---

## 10. 风险、决策点与缓解

| # | 风险 | 触发条件 | 影响 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | 复制 TFA 的坏账 | 直接照抄 `audit-tfa-scenarios` / 手工浏览器 JSON / 硬编码 `remaining` / 用 `gaps` 自报和 `testSource.includes` 代替证据 | TCU 账本不可复现，发布结论不可信 | P0 修工具；账本抄 Carcosa 的多组结构与逐卡账本；审计由单一事实源计算；浏览器证据由 runner 生成 |
| R2 | 闹鬼自动结算 | 复数能力、取消、两次、无目标、失败分支 | 大量剧本错误/卡死 | 先做通用窗口与原语；用 5–8 张代表卡做原语测试，再批量写卡 |
| R3 | 幽灵界第二牌堆 | 抽牌/洗回/弃牌/地点翻面/目标限制 | 《罪恶报应》等章节无法正确运行 | P2.2/P2.3 先于 M3；用《死亡门前》和《罪恶报应》两章验证 |
| R4 | 塔罗 22 分支 | 重复抽取、正逆位、确定性、UI | 序章结局/记录错误 | 22 张牌组数据化；确定性洗牌走 `randomValue`；抽取/选择测试；存档往返 |
| R5 | 序章无牌组调查员 | 建局、AI、大厅、存档、观察投影 | 序章无法开始或泄露/崩溃 | 先做 P2.6 垂直切片；1–4 人、重复选择、非法抽牌/弃牌全部测试 |
| R6 | 阵法多技能检定 | 检定值合成、难度、失败、借机攻击 | 《聚合幻灭》地点行动不可用 | 在 `tests.js` 加多技能合成原语；先测 05250–05257 |
| R7 | 绑定/塔罗槽位 | 场外集合、检索、额外槽位、开局入手 | 玩家卡不可用或构筑非法 | 先做 P2.8/P2.9；用 05313/05316/05283 做验收 |
| R8 | 看守人跨章 | 记录、生成、修正、公开投影 | 后续章节缺少关键敌人/提示 | 用 `string[]` 记录 + `branch`；先做公开信息投影 |
| R9 | 异端者多面/放逐 | 翻面、不能击败、胜利区、存档 | 《罪恶报应》核心流程阻塞 | 允许单章 `resolve` 并登记 escape；不为一张卡扩通用层 |
| R10 | 混乱袋构成对账 | 基础 13 枚 vs 剧本临时加入符号/静态 16 枚表 | 难度/胜率错误 | M0 逐章对账；基础袋写 `shared.js`，符号增删写每章 `tcu-chaos.js` |
| R11 | 卡图缺口与 catalog 标记滞后 | 英文缺 `05217` 正面；21 个 b 面在 catalog 标 `unresolved` 但文件存在 | 测试/展示缺图或误报 | 逐卡确认回退；不手工改名；M0 对账后重生成 catalog 标记 |
| R12 | 战役展示素材缺失 | 无 `web/img/campaigns/theCircleUndone` / 音频 | M5 展示检查失败 | 提前准备占位或正式素材；不晚于 P10 |
| R13 | 多子进程越界/索引冲突 | worker 写共享文件、重建索引 | 合并失败/覆盖 | 小分片试点；`--no-index`；主进程唯一写索引；`shards.json` 交集检查 |
| R14 | 审计哈希漂移 | 改测试/引擎后证据过期 | `--check` 失败 | 统一 `rehash` 流程；证据由生成器计算；干净检出复跑 |
| R15 | 测试运行时间膨胀 | 9 章 + 100+ 卡 + 新原语 | `fast` 变慢，反馈周期变长 | 逐章测试放 fast；全量/随机放 slow；浏览器单独 tier |
| R16 | 范围蔓延 | 把 ReturnTo/独立剧本/其他循环拉进来 | 无限扩大 | 本文 §2.5 明确排除；变更需单独评审 |
| R17 | 章节专属状态过多（火盆/裂口/Cosmos/机关盒/钥匙） | 每章一套地点布尔量、计数器或牌库 | `behavior.js` 膨胀、回归变慢 | 优先收敛 `locationFlag`/`breach`/`scenarioDeck` 三个通用读点；单章一次性逻辑走 `escape` 并登记 |

### 决策点

- **D1 发布口径**：优先「三组全 verified 的正式 `playable`」；若时间/证据不足，允许 TFA 式 `earlyAccess`，但必须 `equivalenceCertified: false` + 完整 `remaining`。**建议目标：正式 verified；earlyAccess 只作为退路。**
- **D2 是否包含 ReturnTo**：不包含。54xxx 卡与 9 个 ReturnTo 剧本留到五循环之后。
- **D3 故事调查员是否可选**：不。只在序章出现，不进入选人/构筑/升级。
- **D4 塔罗牌组建模**：作为剧本级 22 张牌组，不建 05 卡号、不复用玩家塔罗槽资产。
- **D5 核心遭遇组**：`chillingCold`、`ancientEvils`、`darkCult`、`rats`、`strikingFear`、`lockedDoors`、`nightgaunts`、`agentsOfShubNiggurath`、`theMidnightMasks` 已在项目中，TCU 只引用并纳入章节验收，不重写。
- **D6 TFA 修不修**：修。TFA 的 `audit-tfa-scenarios --check` 是 TCU 的模板；不修就会把坏模板复制一遍。

---

## 11. 完成定义与退出标准

### 11.1 每批 DoD

1. 代码/内容/测试/文档同一次提交；新增测试登记进 `tests/suites.mjs` 与 `tests/node-suite.mjs`。
2. `npm run test:fast` 无新增失败；行为改动有 `replay-fixtures --baseline/--compare`。
3. 审计工具 `--write` 重生成、`--check` 通过；不手改账本。
4. `README.md` 进度表、`ARCHITECTURE.md` 边界、`audit/tcu-migration.json` 的 `milestone/verifiedScope/remaining` 同步。
5. 简化/未覆盖分支写进 `remaining`/`gaps`，对应 `literalCardBehavior` 保持 `false`。

### 11.2 M5 退出标准

- 9 章全部 `development` 以上，且 `confirmations.scenarios.items[].checks` 的 12 项（含 `literalCardBehavior`、`browserAcceptance`）全真。
- 关键词全部 `verified`；规则书 6 项全真；桌面/移动浏览器用例通过。
- `assertLaunchable('theCircleUndone')` 通过；大厅出现战役；1–4 人开局均可。
- 完整合法路线、失败路线、存档恢复、多人/AI、桌面/移动端浏览器验收通过。
- `npm test`、`npm run replay:fixtures`、`npm run presentation:check`、`npm run test:browser` 全绿（既有失败单独记账）。
- 所有 `blocked`/`rejected` 卡与未完成原语单列，不计入已完成。
- 不以「卡号出现在代码/测试/definition」作为功能证据；以可执行路径与测试为准。

### 11.3 不能宣称的内容

- 未逐条等价 → 不写「规则等价」「完全还原」；`equivalenceCertified` 保持 `false`。
- 未做浏览器验收 → 不写「交互完成」。
- 目录已收录但未实现 → 不写「已迁移」。
- `earlyAccess` → 明确写「入口开放，逐卡核对/浏览器验收未完成」。

---

## 12. 附录

### A. 章节与遭遇组对照

TCU 共 21 个遭遇组：9 个章节专属（`disappearance_at_the_twilight_estate`、`the_witching_hour`、`at_deaths_doorstep`、`the_secret_name`、`the_wages_of_sin`、`for_the_greater_good`、`union_and_disillusion`、`in_the_clutches_of_chaos`、`before_the_black_throne`）+ 12 个 TCU 专属组（`the_watcher`、`agents_of_azathoth`、`anettes_coven`、`witchcraft`、`silver_twilight_lodge`、`city_of_sins`、`spectral_predators`、`trapped_spirits`、`realm_of_death`、`inexorable_fate`、`music_of_the_damned`、`secrets_of_the_universe`）。这 12 组中部分跨章复用（落 `campaign/_shared`），部分只在单章出现（落关卡目录）；按归属算法判定。另有 9 个核心/前循环遭遇组被引用（含 `theMidnightMasks` 的 2 张），不重写。

章节 → 遭遇组见 §2.1 表；M0 需在 `tcuCampaign/manifest.js` 的 `encounterGroupIds` 中全部登记，关卡 `requiredEncounterGroupIds` 只能引用已登记 ID。

### B. 新增文件清单

```text
content/campaigns/theCircleUndone/
├─ manifest.js
├─ shared.js
├─ chapters.js
├─ story-text.js          # 生成物
├─ keywords.js
├─ record-labels.js
├─ story-roles.js
├─ interludes.js
├─ encounter-rules.js
├─ card-data.js
├─ tarot.js               # 22 张大阿卡纳与结果表
├─ tcu-chaos.js           # 四难度袋与符号
└─ scenarios/<9 章>/{index,definition,layout,behavior}.js

content/packs/
├─ tcuCampaign/manifest.js
├─ tcuInvestigators/manifest.js
└─ tcuPlayer/manifest.js

tools/
├─ audit-tcu.mjs
├─ audit-tcu-scenarios.mjs
└─ import-tcu-story.mjs

tests/
├─ tcu-migration.test.mjs
├─ tcu-investigators.test.mjs
├─ tcu-player-acceptance.test.mjs
├─ tcu-mechanics.test.mjs
├─ tcu-scenario-acceptance.test.mjs
├─ tcu-<9 章>.test.mjs
├─ tcu-story.test.mjs
├─ tcu-rules.test.mjs
├─ tcu-rules.browser.mjs
└─ script-actions-tcu.browser.mjs

audit/
├─ tcu-migration.json
├─ tcu-scenario-acceptance.json
├─ tcu-browser-acceptance.json   # 生成物
└─ tcu-all-card-acceptance.json  # 逐卡账本（照 Carcosa 的多组结构）
```

另需修改：`content/registered.js`、`content/mechanics.js`、`src/deck/availability.js`、`src/deck/card-pool.js`、`web/rulebook-data.js`、`web/ui-cards.js`、`web/campaign-presentation.js`、`web/deck-rules.js`。

### C. 参考来源

| 来源 | 用途 |
| --- | --- |
| `参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json` | 中文卡名/卡文/字段 |
| `参考资源/ArkhamHorror-main/frontend/public/cards.json` | 英文主表 |
| `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Campaigns/TheCircleUndone/` | 战役流程、记录键、Memento、混乱袋 |
| 同上 `Scenario/Scenarios/TheCircleUndone/` | 9 章 setup/规则/结局（约 2.4k 行） |
| 同上 `{Act,Agenda,Asset,Enemy,Event,Location,Skill,Story,Treachery}/CardDefs/TheCircleUndone/` | 卡牌定义 |
| `参考资源/ArkhamHorror-main/frontend/src/locales/zh/theCircleUndone/` | 中文剧情（10 个 JSON） |
| `参考资源/ArkhamHorror-main/frontend/src/arkham/data/theCircleUndone.json` | 剧本 id / ReturnTo 映射 / settings |
| `web/img/cards/05*`、`web/img/zh/cards/05*` | 本地卡图与回退验证 |

### D. 术语表

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Haunted | 闹鬼 | 地点关键词；失败检定后结算该地点的闹鬼能力 |
| Spectral | 幽灵 | 特性；幽灵地点/敌人/第二遭遇牌堆 |
| Circle | 阵法 | 地点行动；2–4 个技能相加的检定 |
| Tarot | 塔罗 | 序章/巫异时刻的 22 张牌组；玩家塔罗槽位是另一套 |
| Parley | 谈判 | 行动种类；TCU 大量敌人/地点上的谈判能力 |
| Memento | 遗留记忆 | 战役记录集合；10 个 |
| Watcher | 看守人 | 跨章敌人/记录「你被追捕」 |
| Breach | 裂口 | 《混沌魔掌》地点计数器 |
| Bonded | 绑定 | 场外绑定卡组（圣化之镜/密教辞典） |
| Story Investigator | 序章调查员 | 05046–05049；无牌组，只在序章使用 |

---

> 下一步：P0 / P1 / P2 / P3 / P4 已完成，P5 的交互层已完成但**实机路径未验收**，P6（M1 调查员）已完成——
> P1 锁定 377 条记录与三包骨架（`scan:tcu:scope:check`），第 1 步机制扫描产出 `mechanism-scan.json`
> （`scan:tcu:check`），第 2 步 14/14 原语通过 `audit:tcu:primitives`（P6 把 `hunchDeck` 补成第 14 个），
> 第 3 步关键词 16/16 `verified` 且规则书 6 项全真（`test:tcu:rules` / `test:tcu:rules:browser`），
> 第 4 步 11 条交互全部接线并有组件级浏览器证据（`test:tcu:interactions` / `test:tcu:interactions:browser`），
> 第 5 步的 M1 交付了 6 位正式 + 4 位故事调查员、13 张专属卡与 33 例逐人验收（`test:tcu:investigators`）；
> 全量账本 `audit:tcu:check` 通过，`remaining` 里明确列着「交互实机路径待 P8」与 5 条显式简化。
> 按 §9 关键路径，接下来是 **P8**（剧本）：先做 M3-1 垂直切片（序章 + 巫异时刻 + 死亡门前），
> 把塔罗抽牌、无牌组调查员、闹鬼与看守人从「组件可用」推进到「大厅可走通」，并补跑实机浏览器验收；
> P7（M2 玩家卡）与 P9（M3-C 剧情）可并行启动。本文不替代逐卡审计；所有「已支持」结论都要用当前代码复核，
> 因为参考实现与当前引擎都可能在这份路线图编制后继续变化。
