# 《食梦者》P4 收尾报告：关键词与规则书（2026-10-29）

> **口径**：P4 = 规范第 3 步「关键词与规则书」。本轮把 7 个关键词逐条确认到 `verified`（5 项检查），落地 17 条规则书条目（6 项检查），388/388 张 06 卡接通卡文直达，并在核对官方规则时**更正了 P3 的 2 条原语口径**。
> 账本：[`audit/tde-rules.json`](../audit/tde-rules.json)（`npm run audit:tde:rules:write` / `npm run audit:tde:rules`）；关键词事实源 [`keywords.js`](../content/campaigns/theDreamEaters/keywords.js)；规则正文 [`web/rulebook-data.js`](../web/rulebook-data.js)。
> 手册：[`tde-rules.md`](./tde-rules.md)；原语：[`tde-primitives.md`](./tde-primitives.md)；路线图 §6 / §13。

## 1. 一页结论

| 项 | 结论 |
| --- | --- |
| 关键词 | **7/7 verified**：Myriad / Swarming X / Veiled / Researched（新增）+ Alert / Hidden / Bonded（确认）；每条都有卡面来源、引擎读点、Node 证据、规则条目、卡文直达 |
| 规则书 | **17 条 verified**（原建议 16 条；D5 决定 Bonded 新立 `tdeBonded`，见 §3） |
| 卡文直达 | **388/388** 张 06 卡连到 `tdeCampaign`；0 张连到其他循环条目；关键词判据逐张对齐 |
| P3 更正 | `location.veiled` 与 `location.doom` 两条原语与官方规则冲突，已改实现/测试/文档/账本（§4） |
| 机制登记 | 11 个 `tde*` 能力项登记；6 条战役层条目**不提前登记**（P5/P8） |
| Node | `tests/tde-rules.test.mjs` **15 例**，0 失败（审计工具实跑） |
| 浏览器 | 桌面 1440 / 移动 390 共 **4 条**用例通过，截图 2 张；账本由 runner 生成 |
| 门禁 | `audit:tde:rules` 复算一致，`gate.pass=true`；原语账本重算后 `new 17/17 done`、`gate.pass=true`；replay 13 局零漂移 |
| 诚实边界 | 敌人形态隐私、蜂拥实体、翻面动作、剧情正文等仍未接线，逐条写进关键词 `deferred` 与本文 §8 |

## 2. 交付物

| 类别 | 文件 |
| --- | --- |
| 事实源 | [`content/campaigns/theDreamEaters/keywords.js`](../content/campaigns/theDreamEaters/keywords.js)（7 关键词 + 17 规则 id + 两袋事实） |
| 规则正文 | [`web/rulebook-data.js`](../web/rulebook-data.js)（17 条条目、拼音索引、06 卡判据与卡号直达） |
| 卡号表 | [`web/ui-cards.js`](../web/ui-cards.js)（`rulebookReferences` 增补 8 章参考卡、8 张剧情支援、7 张地点毁灭卡） |
| 机制登记 | [`content/mechanics.js`](../content/mechanics.js) |
| 原语更正 | [`src/engine/veiled.js`](../src/engine/veiled.js)、[`src/engine/location-doom.js`](../src/engine/location-doom.js)、`scenario-runtime-extras.js`、`tools/tde-primitive-spec.mjs` |
| Node 验收 | [`tests/tde-rules.test.mjs`](../tests/tde-rules.test.mjs)（15 例） |
| 浏览器验收 | [`tests/tde-rules.browser.mjs`](../tests/tde-rules.browser.mjs) + [`playwright.tde.config.mjs`](../playwright.tde.config.mjs) + [`tools/playwright-tde-reporter.mjs`](../tools/playwright-tde-reporter.mjs) |
| 审计 | [`tools/audit-tde-rules.mjs`](../tools/audit-tde-rules.mjs) + `audit/tde-rules.json` + `audit/tde-browser-acceptance.json` |
| 命令 | `package.json`：`test:tde:rules` / `test:tde:rules:browser` / `audit:tde:rules` / `audit:tde:rules:write` |
| 文档 | 本文件、[`tde-rules.md`](./tde-rules.md)、[`tde-primitives.md`](./tde-primitives.md) 修订、路线图 §6/§10.3/§12/§13 |

## 3. 关键词结论（7 条）

| 关键词 | 中文 | 卡数 | 规则条目 | 结论 |
| --- | --- | ---: | --- | --- |
| Myriad | 多重 | 14 | `tdeMyriad` | 构筑期同名至多 3 张（按标题跨卡号共享），只拦 Myriad；界面显示属 P7 |
| Swarming X | 蜂拥 | 11 敌 | `tdeSwarming` | 蜂拥卡=独立实例、单一实体移动/交战/横置、清空前头领不可击败、溢出伤害逐张扣、Victory 只算头领；X 四种口径 |
| Veiled | 掩藏 | 23 地点 | `tdeVeiled` | 已揭示面入场、无线索时 [fast] 翻面、翻过一次不能再翻；~~B3 翻面后洗回是另一件事~~ **P8 更正：官方规则无洗回（初勘错误）** |
| Researched | 研究完成 | 3 | `tdeResearched` | 购入限制：战役日志记下研究结果后才能购入；复用既有 `researchRequirement` 门禁 |
| Alert | 警戒 | 5 敌 | `alert`（复用核心） | 核心读点够用；与 Swarming/Massive 的组合留给 P8 逐卡确认 |
| Hidden | 隐私 | 18 | `hidden`（复用核心） | 核心语义已交付；敌人形态在手牌被攻击/躲避属 P8（写入 `deferred`） |
| Bonded | 绑定 | 27 | `tdeBonded`（新立） | 场外绑定、每种只放发行张数（《梦的本质》1 张）、地点绑定与绑定弱点敌人属 P8 |

**D5 决策（2026-10-29）**：Bonded 不再复用 `tcuBonded`，新立 `tdeBonded`。理由：①②本循环多了地点绑定（06015a/b 与 06013/06014）与绑定弱点敌人（06025/06283）；②《梦的本质》「每种绑定卡只放 1 张」的 FAQ 例子必须在 TDE 名下讲清；③TCU 条目分组是「万象无终」，TDE 玩家在目录里找不到。代价：规则条目从 16 → 17，已同步路线图 §6/§10.3。

**新增关键词的 deferred（不隐藏）**：
- Swarming：真实蜂拥实体在场景中的生成/攻击/交战（P8）、蜂拥面板（P5 交互第 3 条）。
- Veiled：翻面动作接进调查/移动与故事卡阅读器（P8）、A2 的 b 面正文（P8-T）。
- Researched：三张梦境日记的 `researchRequirement` 声明（P7）。
- Bonded：06025/06283 的绑定关系只在卡文、`cards-data` 无 `bonded` 字段（P7 单卡声明）；绑定弱点敌人的场外实体（P8）。
- Alert：Alert+Swarming 反击归属、Alert+Massive 顺序（P8 逐卡）。
- Hidden：敌人形态在手牌的战斗/躲避入口、隐私投影（P8/P5）。

## 4. 核对官方规则时发现的两条 P3 原语错误（本轮更正）

P4 的职责是让「规则书说的」与「引擎做的」一致；逐句核对 en 剧本来源后发现两处冲突，按「口径冲突先裁决」处理。

| 原语 | P3 实现 | 官方规则（证据） | P4 处置 |
| --- | --- | --- | --- |
| `location.veiled` | `veiledBlocksInvestigation`：未揭示的掩藏地点不能调查；`revealVeiledLocation` 翻面 | `theSearchForKadath` / `pointOfNoReturn` 的 `rules.locations`：掩藏地点**没有未揭示面**，以已揭示面入场并按线索值放置线索；`rules.veiled`：位于该地点且**地点上没有线索**的调查员可以作为一个 [fast] 能力把它翻面；翻过一次不能再翻 | 删除 `veiledBlocksInvestigation` / `revealVeiledLocation`；新增 `veiledFlipBlockedReason` / `canFlipVeiledLocation` / `flipVeiledLocation`；测试重写为 10 例 |
| `location.doom` | `locationDoomThreshold` / `shouldDestroyLocation` / `destroyLocation`：毁灭达到阈值就移除地点，并把毁灭加到议程 | 06341–06354 的「地点上的毁灭」就是毁灭（计入议程阈值、被 06333 骷髅读取，X=单地点最高毁灭；硬/专取全部地点之和）；06 段没有任何「毁灭地点」规则 | 删除阈值/移除三函数；新增 `removeLocationDoom` / `highestLocationDoom`；`normalizeLocationDoom` 改为校验非负整数；测试重写为 7 例 |

- 影响面：`scenario-runtime-extras.js` 的 `veiled` / `locationDoom` 窄接口同步改名；`tools/tde-primitive-spec.mjs` 的 api/checks/note 同步；`plan:tde:primitives --write` 重算账本后 `gate.pass=true`。
- **为什么 P3 的测试没抓出来**：P3 的测试证明的是「实现与自己的注释一致」，不是「实现与官方规则一致」。P4 把官方规则文本与卡面证据写进手册后，这类冲突才会暴露。这也是「关键词与规则书必须先于卡牌批次」的原因。
- **引擎边界**：更正后的注释不含循环名（`tde` / `theDreamEaters`），`engineBoundary` 保持 0。

## 5. 卡文直达与机制登记

- 判据写在两处且必须同步：`keywords.js` 的 `pattern` 与 `web/rulebook-data.js` 的 `TDE_CARD_RULES`。测试对 388 张逐张比对「卡面命中判据 ⇒ 必须连到条目」。
- 章节参考卡按线连 `tdeDreamQuest` / `tdeWebOfDreams`；8 张剧情支援（06059/06079/06080/06144/06189/06224/06225/06266）与 7 张地点毁灭卡（06333/06341–06354）按卡号登记在 `rulebookReferences`。
- **没有**加章节 id → `UI_CARDS.scenarioCards` 映射：战役仍 `catalog-only`，`campaign-experience.test.mjs` 的守卫会拒绝未注册章节的映射；该映射属 P8。
- 机制登记 11 项（见 [`tde-rules.md`](./tde-rules.md) §5）；`tdeCampaign` / `tdeDreamQuest` / `tdeWebOfDreams` / `tdeChaos` / `tdeRecords` / `tdeEpilogue` 明确**不登记**（P5/P8 接线后才登记），测试显式断言它们不在 `supportedMechanics`。

## 6. 门禁实测

| gate | 结果 |
| --- | --- |
| `keywordsVerified` | 7 / 7 |
| `rulebookVerified` | 6 / 6 检查通过（17 条） |
| `keywordScanAligned` | 7 条机制 id 与 P2 扫描完全一致，`ruleId` 逐条一致 |
| `rulebookEntries` | 17 条：present 17、missing 0、orphan 0、unindexed 0、badRelated 0 |
| `nodeAcceptance` | `tests/tde-rules.test.mjs` 15 例 / 0 失败 |
| 浏览器 | `desktopBrowser=true`、`mobileBrowser=true`（用例通过 + 截图存在） |
| 卡文直达 | 388 / 388，外循环链接 0 |
| `audit:tde:rules` | 复算一致 |
| `test:fast` | **3875 tests / 3872 pass / 3 skipped / 0 fail**（`artifacts/migration/tde/reports/p4-fast.log`，含本批 15 例与外部提交新增用例） |
| `docs:check` | 35 文件 / 243 本地链接全部可解析（文件数下降属外部删文档，见 §7） |
| `plan:tde:primitives` / `audit:tde:primitives` | `new 17/17 done`、`deferredPrimitives` 空、`engineBoundary 0/0`、`gate.pass=true` |
| replay | `replay-fixtures --compare artifacts/migration/tde/replay-before.json` → 13 局逐条一致 |

命令（可复算）：

```bash
npm run test:tde:rules
npm run test:tde:rules:browser
npm run audit:tde:rules:write    # 审阅 diff 后
npm run audit:tde:rules
npm run plan:tde:primitives
npm run audit:tde:primitives
node tools/replay-fixtures.mjs --compare artifacts/migration/tde/replay-before.json
npm run test:fast
npm run docs:check
```

## 7. 副作用与账本处置

- **原语账本在 P4 开工时已是 stale**：`audit:tde:primitives --check` 报 `primitive-plan.json 与代码不一致`。逐字段比对后确认根因是外部提交（`42aa746 chore: sync all modules`）改了 `src/engine/scenario-runtime.js`：`scenario-runtime` 键数从 190 → 241，与 P3 账本记录不符。P4 的重算同时吸收该外部变化与两条口径更正；diff 只含哈希、`checks.detail` 的键数与 veiled/locationDoom 的 api 变化，没有其他原语的行为改动。
- `tests/suites.mjs` 新增 `tde-rules.test.mjs` 会让把 `tests/suites.mjs` 计入哈希的 TCU 账本 stale（P3 已记录同一现象），按同一 remedy 重算 `audit-tcu-player --write` → `audit-tcu --write` 并复跑 `audit:tcu:check`；diff 只含哈希/包状态，不改卡牌行为。
- 浏览器验收的账本 `audit/tde-browser-acceptance.json` **由 runner 生成**；`--write` 与 `--check` 都不会手写补齐缺失项（`desktopBrowser` / `mobileBrowser` 缺失时记账为 false）。
- **预存 docs:check 断链**：P4 开工时 `npm run docs:check` 已有 5 条失效链接，全部指向当天外部编辑留下的 `docs/p2-4-quick-event-channel.md`（仓库内不存在该文件，也没有历史可查）。处置：把 5 处引用改指向真实存在的同名口径段落（`card-model.md` §7.3 与迁移规范 §4.6.10），**没有新建文档**、没有改规则内容；改后 `docs:check` 为 `35 个文件、243 条本地链接全部可解析`。
- **`scan:tde:scope:check` 预存漂移**：外部提交把 HEAD 从 `6f60771` 推到 `5faa702`，`scope.json` 的 `baseline.git` 随之失效（工具自己的注释写「不把 gitHead 纳入比对」，但 `--check` 实际逐字节比对整份账本）。处置：按工具确定性重算（`scan:tde:scope --write`），diff **只有** `baseline.git.head` 一个字段；`scope` 复算一致（388 条记录、43 个来源）。工具契约与实现不一致记作遗留项，P4 不改 P1 工具行为。
- **docs:check 的文件数下降（外部原因）**：P4 实测 `docs:check` 为 `35 个文件 / 243 条链接`，低于 P0 记录的 `43 文件 / 376 链接`——因为外部同步再次删掉了 9 篇 TCU 文档（`docs/` 下已无 `tcu-*.md`）。P4 不重建非 TDE 文档，也不改 `docs:check` 口径；TDE 新增/修改的文档链接全部可解析。

## 8. 诚实清单（仍未完成）

| 项 | 归属 |
| --- | --- |
| 敌人形态隐私卡在手牌中的攻击/躲避入口、隐私投影 | P8 / P5 |
| 蜂拥实体生成、交战、攻击、清空判定接线；蜂拥面板 | P8 / P5 |
| 掩藏翻面的调查/移动接线与故事卡阅读器 | P8（正文 P8-T） |
| 三张梦境日记的 `researchRequirement` 记录键；构筑界面 n/3 | P7 |
| 绑定弱点敌人的场外实体与「无主卡在场放回场外」 | P8 |
| 章节 id → `scenarioCards` 映射 | P8 |
| 战役层 6 条机制登记 | P5 / P8 |
| 规则书剧情段落与完整中文（自译，非官方中文） | P8-T |
| 关键词 `alert` / `hidden` 的组合分支（Alert+Swarming、Alert+Massive、Hidden 敌人形态） | P8 逐卡确认 |

## 9. 维护规则

1. 关键词或规则条目改动：`test:tde:rules` → `audit:tde:rules:write` → 审阅 diff → `audit:tde:rules`。
2. 判据（`pattern`）与 `TDE_CARD_RULES` 必须同时改；否则 388 张的逐张检查会红。
3. 浏览器用例改动后重跑 `test:tde:rules:browser`；账本不能手写。
4. 规则条目增删要同步 `TDE_RULE_IDS`、拼音表与 `tde-rules.md` §3 的表。
5. 再发现 P3 口径与官方规则冲突时，按本文件 §4 的顺序处理（先裁决规则 → 改实现与测试 → 改文档 → 重算账本）。
