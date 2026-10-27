# 《食梦者》P2 收尾报告：M0 机制扫描（2026-10-27）

> **状态口径**：P2 完成，TDE 仍是 `catalog-only`。本报告只记录**机制条目与逐卡归属**，不代表任何卡牌/章节已实现。
> 账本：`artifacts/migration/tde/mechanism-scan.json`（按 `.gitignore` 逐文件白名单放行，`npm run scan:tde:check` 可复算）。
> 逐卡复核清单：`artifacts/migration/tde/_review.md`（不签入）。路线图：[`tde-migration-roadmap.md`](./tde-migration-roadmap.md) §4；
> 前置：[`tde-p0-report.md`](./tde-p0-report.md)、[`tde-p1-report.md`](./tde-p1-report.md)。

## 1. 一页结论

| 项 | 结论 |
| --- | --- |
| 机制条目 | **38 条 + 1 条 baseline**：keyword 7 / primitive 9 / rulebook 6 / scenario 11 / interaction 2 / content 3 —— 与初勘的类型分布完全一致 |
| 覆盖 | **388 / 388 已分类，未分类 0**；每条印刷记录至少落进一个条目（章节组 / 共享组 / standardRules） |
| 分级 | mechanism **173** / content **151** / standard **64**（初勘 182/156/50；差额集中在调查员专属卡，见 §3.2） |
| 关键词实测 | Myriad 14 · Swarming 11 敌 · Veiled 23 地点 · Researched 3 · Alert 5 敌 · Hidden 18（16 本体 + 2 引用）· Bonded 27 |
| 遭遇组 | 20/20 组都有卡（8 章 253 + 12 共享 30 = 283），与 P1 `scope.json` 逐项一致（`gate.scopeConsistent`） |
| 来源锁 | 参考实现 **91 个文件** SHA-256（CardDefs 55 + 8 章剧本 8 + 双战役 6 + 主流程 1 + en/zh 剧情各 9 + 3 份卡表） |
| watchlist | 6 个「必须不出现」的词全部 0 命中（bless/curse 类标记、concealed、customization、tide、flood）；6 个「同名不同物」已逐条登记 |
| 命令 | `npm run scan:tde` / `scan:tde:check` / `scan:tde:review`，`--check` 复算一致且 `gate.pass=true` |

## 2. 账本 gate（`mechanism-scan.json` 的 `gate`）

| gate | 值 | 说明 |
| --- | --- | --- |
| `printedRecords` / `mainCodes` / `linkedFaces` | 388 / 352 / 36 | 06 号段全量 |
| `classified` / `unclassified` | 388 / 0 | 每张卡都有 `mechanisms[]` 与 `evidence{}` |
| `mechanismCount` | 36 | 不含交互与 baseline |
| `mechanismEntries` | **38** | 36 机制 + 2 交互；路线图口径的 38 |
| `mechanismsWithCards` | 29 | 余下 7 条是战役结构/文案类条目（均带 `zeroCardJustified`） |
| `interactionEntries` | 2 | 开局四选项、按线选人/选牌组 |
| `encounterGroupsInData` / `Expected` | 20 / 20 | 每组都有卡 |
| `coreGroupsReferenced` | 8 | P1 已证实的跨循环组 |
| `scopeConsistent` | true | 与 P1 `scope.json` 的 388/352/36/8/20 逐项一致 |
| `zeroCardEntriesJustified` | true | 8 条零卡条目都有理由（战役结构、记录键、尾声、成就、标签、座位映射、结局矩阵、part 切换） |
| `watchlistViolations` | [] | 6 个 absent 词 0 命中 |

## 3. 关键词：7 条，全部有卡面证据

| 关键词 | 条目 | 实测 | 初勘 | 差异说明 |
| --- | --- | ---: | ---: | --- |
| Myriad 多重 | `myriad` | **14** | 14 | 卡文命中 15 张，多出的 06318「Myriad Forms」是卡名；验收以 `cards-data.myriad=true` 为准 |
| Swarming X 蜂拥 | `swarming` | **11 敌** | 11（英文机检 9） | 英文机检漏了 `[per_investigator]`（06147/06148）与 X 值（06228/06273）；本扫描按「敌人 + 关键字行」计 |
| Veiled 掩藏 | `veiled` | **23 地点** | 23 | 卡文命中 24 张，多出的 06264b 是同一条地点的 b 面故事卡 |
| Researched 研究完成 | `researched` | **3** | 3 | 06236/06237/06238 梦境日记 |
| Alert 警戒 | `alert` | **5 敌** | 5 | 卡文另有 2 张（06103/06111）提到 alert，不是关键字 |
| Hidden 隐私 | `hidden` | **18**（16 + 2） | 18 | 关键字本体 16 张（全部带 Peril）+ 06293/06299 的 hidden card/keyword 引用；卡池 `hidden` 字段是目录隐藏，已排除 |
| Bonded 绑定 | `bonded` | **27 条** | 27 | 14 张 `bondedCards` + 13 张 `bondedTo`；含 2 张地点绑定、2 个弱点绑定敌人 |

### 3.1 与 TCU 的关键差异（写进 P3/P4 的边界）

- **Swarming 的 X 有四种口径**：固定 2/1、`[per_investigator]`（06147/06148）、警报等级（06228）、剧本参考卡伤害数（06273）。原语必须一次覆盖，不能按卡写分支。
- **Veiled 是「未揭示 + 翻面 + 洗回」三件事**：A2 的 15 张翻面出 b 面故事卡；B3 的 8 张翻面后洗回牌堆（06254/06257/06258/06261/06262–06265）。
- **Hidden 的敌人形态**：06306–06310 是「秘密加入手牌、可被攻击/躲避」的敌人，TCU 的 Hidden（威胁区/手牌）没有这条语义。
- **Bonded 的地点变体**：06015a/b 梦境之门是地点绑定（不是场外卡组），06025/06283 是绑定敌人。

### 3.2 分级差异（173/151/64 vs 初勘 182/156/50）

- 本扫描只把「卡面命中关键词/战役机制」计入 `mechanism`，**不预判调查员主能力**。
- 标准卡 64 张的构成：5 位调查员 + 11 张专属卡 + 4 张基础弱点 + 44 张普通玩家卡。差额集中在调查员与专属卡（伤害承接/搜索改写/弃牌循环/梦境之门/牌库循环），P6 逐人验收时按原语队列登记（§8.1），不在 P2 预判。
- 这不是漏卡：`standardRules` 是显式条目，`unclassified=0` 保证没有卡被静默跳过。

## 4. 原语 9 条（全部进入 P3 队列）

| 条目 | 卡 | 现状 | 候选原语 |
| --- | ---: | --- | --- |
| `campaignPart` | 0 | missing | `campaign.setPart` |
| `partRecord` | 12 | partial（记录层有，缺按 part 隔离） | `campaign.recordInPart` / `campaign.partRecord` |
| `seatPartMap` | 0 | missing | `campaign.seatPartMap` |
| `multiPartChaosBag` | 7 | partial（单袋有） | `chaosBag.multiPart` |
| `epilogueMatrix` | 0 | missing | `campaign.epilogueMatrix` |
| `tokenBag` | 10 | missing（只有混乱袋） | `tokenBag.create/reveal/add` |
| `alarmLevel` | 20 | missing | `counter.investigator` / `window.afterAlarmRaised` |
| `verticalChain` | 15 | missing | `location.verticalChain` |
| `dreamGate` | 4 | missing | `location.placeBondedLocation` |

> 与路线图 §5.1 的高风险 7 项对照：`campaignPart` / `partRecord` / `seatPartMap` / `tokenBag` / `alarmLevel` 已登记；
> `swarming` 与 `veiled` 是 keyword 条目（它们的原语候选在同一 `existingImplementation`/`candidatePrimitives` 里），
> `dreamGate`、`verticalChain`、`epilogueMatrix`、`multiPartChaosBag` 是 §5.2 的其余候选中被本扫描提到 primitive 的 4 条。

## 5. 规则书 6 条 / 内容 3 条

| 类型 | 条目 | 卡 | 说明 |
| --- | --- | ---: | --- |
| rulebook | `tdeCampaign` | 0 | 双战役结构、四模式、每座位一套牌组（战役层，卡面不承载） |
| rulebook | `tdeDreamQuest` | 4 | A 线 4 章参考卡（06039/06119/06206/06286） |
| rulebook | `tdeWebOfDreams` | 4 | B 线 4 章参考卡（06063/06168/06247/06333） |
| rulebook | `tdeChaos` | 8 | 逐章混乱符号表 = 8 张剧本参考卡 |
| rulebook | `tdeRecords` | 0 | 55 个记录键在 `Key.hs` 与 P8 数据里，卡面不承载 |
| rulebook | `tdeEpilogue` | 0 | 16 段尾声正文属 P8-T 自译 |
| content | `storyAssets` | 11 | 8 张带 encounterCode 的剧情支援 + 3 处 story asset 引用 |
| content | `achievements` | 0 | 默认 out-of-scope（D4），零卡条目带理由 |
| content | `campaignLabels` | 0 | 55 个记录键的中文标签（P8-T 自译口径） |

## 6. 场景 11 条

| 条目 | 卡 | 说明 |
| --- | ---: | --- |
| 8 个 `scenario:<chapter>` | 26 / 21 / 53 / 28 / 29 / 37 / 37 / 22 | 按 `encounterCode` 归属；每章 gaps 带本章专属机制提示（梦境 setup、滋生袋、掩藏地点、纵向阶梯、警报等级、漆黑之海、Hidden 奈亚、大网） |
| `sharedEncounterSets` | 30 | 12 个共享组，逐组列出引用章节（来自参考实现 gather / gatherAndSetAside） |
| `locationDoom` | 7 | B4 大网地点毁灭 + 毁灭数驱动 [skull] |
| `signsOfTheGods` | 8 | A2 神迹计数（8 张背面故事卡） |

## 7. 战役级机制清单（路线图 §4）的落点

| 路线图要求 | 落点 |
| --- | --- |
| 四种开局 `singleA`/`singleB`/`pick`/`parallel` | `campaignPart` + `ui:modeSelection` |
| 每座位一套牌组 | `campaignPart` + `ui:laneDeckSelection` 的 gaps |
| 房间座位 → 线内连续座位映射 | `seatPartMap` |
| 55 键记录的部分隔离与跨线读写 | `partRecord` + `tdeRecords` |
| 两袋混乱袋与跨部分增删换 | `multiPartChaosBag` + `tdeChaos` |
| 逐章对 gate（4 个二元先手选择） | `campaignPart`（flow 分支在 P3 落） |
| 序章 + 3 幕间 | `tdeCampaign`（幕间节点 P3/P8） |
| 16 段结局矩阵 | `epilogueMatrix` + `tdeEpilogue` |
| 剧情支援入队/离场 | `storyAssets` |
| 成就（默认 out-of-scope） | `achievements`（带 `zeroCardJustified`） |

## 8. 命令与复现

```powershell
cd games/arkhamhorror
npm run scan:tde          # 写 artifacts/migration/tde/mechanism-scan.json
npm run scan:tde:check    # 复算 + gate + 逐字节比对
npm run scan:tde:review   # 逐卡复核清单 → artifacts/migration/tde/_review.md
```

`--check` 的失败语义：卡面/来源漂移、未分类卡出现、零卡条目缺理由、watchlist 出现 absent 词、机制条目不再是 38、与 `scope.json` 的计数不一致。

## 9. 仍未完成（P2 之后）

| 项 | 说明 |
| --- | --- |
| P3 原语计划 | 9 条 primitive + 2 条 keyword 的原语候选进 `plan:tde:primitives`；**前置是 8 篇卫星文档**（见 P0 报告 §10.2 的 TCU 教训） |
| P4 关键词与规则书 | 7 个关键词 × 5 项证据 + 16 条规则书条目（本扫描给了条目入口与代表卡号） |
| P5 交互 | 本扫描只登记 2 条开局交互；其余 8 条来自场景机制，P4 结束前定稿 |
| P8-T 自译 | 关键词解释、16 段尾声、55 记录键中文标签都依赖自译批次 |
| 分级口径 | 调查员/专属卡 16 张的主能力在 P6 登记，届时 tiers 会再移动一次（预期 mechanism +16 左右） |

## 10. 门禁与外部失败（诚实记账）

P2 收尾时 `node tools/run-tests.mjs fast` 出现 **2 条失败**，逐条复核后确认**不是 P2 产生**：

| 失败 | 根因 | 证据 |
| --- | --- | --- |
| `tests/decision-http.test.mjs` → `真实 Arkham 4 座位…` | 大厅侧在 2026-10-27 17:09 被并发修改（`lib/server.js` + 新增 `lib/ai-seats.js`），引入「同一局每个 AI 按 id/名字最多出现一次」的校验；该用例只 mock 1 个 AI（`protocol-test-ai`）却要 3 个 AI 席位，于是返回 `AI 角色不足：本局需要 3 个不同的 AI…` | 根仓库 `git diff lib/server.js` 可见 `assignUniqueAis` / `uniqueAis` 新逻辑（属他人改动，不在 TDE 范围）；P1 收尾（16:54）同一用例为 ✔，P2 收尾（17:10）为 ✖ |
| 父测试 `N3 大厅通用决策协议` | 同上（子用例失败导致父测试失败） | 同上 |

- 这不是 TDE 代码或 P2 账本造成的：P2 只新增 `tools/scan-tde-mechanisms.mjs`、`docs/tde-p2-report.md` 与 `package.json` 三条命令，**没有改** `lib/**`、`src/**`、`content/**` 或任何测试。
- P2 自身的门禁全部独立可复算：`scan:tde:check`、`scan:tde:scope:check`、`docs:check` 均通过（见 §8）。

### 10.1 修复（2026-10-27，对齐大厅新契约）

- **只改测试文件** `tests/decision-http.test.mjs`，不动 `lib/**`：
  - mock 的 AI 名单从 1 个扩成 4 个不同角色（`protocol-test-ai` … `protocol-test-ai-4`，名字也不同——新契约按 **id 和名字** 双向去重）；
  - 新增 `protocolOpponents(count)`，把 `Array(count - 1).fill('protocol-test-ai')` 换成 3 个不同 id（4 座位用例）。
- 结果：`node --test tests/decision-http.test.mjs` → **18/18 通过**（1 座位与 4 座位都绿）；全量 `test:fast` 复跑 **3607 tests / 3604 pass / 3 skipped / 0 fail**（`artifacts/migration/tde/reports/p4-fast.log`）。
- 契约依据：`lib/ai-seats.js` 的 `uniqueAiList`（同 id/同名去重）与 `assignUniqueAis`（角色不足抛 `AI_POOL_EXHAUSTED`）；大厅在 `validateSettings` 里提前返回「AI 角色不足」提示。
