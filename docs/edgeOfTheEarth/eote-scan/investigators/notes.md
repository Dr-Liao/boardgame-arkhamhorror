# EOTE 调查员审计笔记（inv-auditor）

- 范围：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/shards.json#inv-auditor.codes`，22 张（08001–08018，含 08011a/b–08014a/b 八张双面演武）；只读审计，未改 `games/arkhamhorror/**`。
- 产出：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/investigators/findings.json`（22 卡 clauses/perceivability/tests/issues，含 `priorLedgerConflicts`）+ 本文件 + 运行时探针 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/investigators/probes.mjs`（只读，8 个复现点，P1–P8）。
- 测试：in-process 复跑 5 个文件全部通过 —— daniela 7/7、norman 6/6、monterey 7/7、lily 12/12、bob 7/7（共 39）。浏览器账本（audit/eote-investigators-browser.json、tools/run-eote-investigators-browser.mjs）需要真实大厅 HTTP，沙箱禁 spawn，未复跑（账本该 gate 本次不可验证）。
- 结论分布：match 14 / approximation 5 / gap 3 / blocked 0；accepted 14。issue 31 条：**high 5 / medium 13 / low 13**。

## 一、Top findings（high，均有 file:line + 运行时复现）

1. **08013a 的「下一次检定 +5 / 结束后翻面」按全局检定结束结算，多人局被别人的检定吞掉**（P8）
   - `src/cards/entries/08013a.js:22-33` 用 `api.addEffect({duration:'endOfTest'})` + `flipAfterNextTest`；但过期点 `src/engine/tests.js:1533`、延迟翻面 `src/engine/tests.js:596-600`/`src/engine/eote-investigator-support.js:111-135` 都不校验检定执行者。
   - 复现：陈丽丽使用 08013a 后座位 1 做检定 → `state.effects` 清空、演武变成 08013b，而陈丽丽本人一次检定都没做。卡面只作用于「你」的下一次检定。
2. **08004 强制「揭示到弱点即抽取」被降级为 drawCards 尾部惰性抽取**（P2）
   - `src/engine/deck-ops.js:629-640` 是唯一触发点；`syncPassiveDeckTop`（`src/engine/eote-investigator-support.js:196-220`）揭示弱点时只记录不抽。测试也是用 `drawCards(...,0)` 触发的（`tests/eote-investigator-norman.test.mjs:174`）。
3. **08004「Play with the top card revealed」在打出牌库顶后失效**（P1）
   - `src/engine/play-channels.js:303-318` / `src/engine/eote-deck-top.js:109-118`：deckTop 通道打出后只 consume+markPlayed 删记录，全仓没有在此时机调用 `syncPassiveDeckTop`（唯一同步点：`src/engine/setup.js:357`、`src/engine/turn.js:100`、`src/engine/deck-ops.js:630`）。打出后直到下次抽牌/轮初，牌库顶不揭示、每轮一次打出通道也消失。
4. **08005 第二条 [fast] 投入牌库顶跳过全部合法性检查**（P3a/P3b）
   - `src/engine/eote-investigator-support.js:229-253`：没走 `commit-rules.js:19-54#canCommitToTest`（图标匹配/额外费用/投入限制），icons 用 `Object.values(def.icons)` 全量求和（`src/engine/stats.js:327` 才是按技能过滤）；也不校验「performed by an investigator at your location」（`state.skillTest` 任意座位/任意地点都放行）。复现：仅意志图标的 01031 投入战斗检定，`committed.icons=1`；座位 1 在另一地点检定仍 `canCommitDeckTop=true`。
5. **08006 预示者只封锁抽牌，不封锁检索/洗牌/操纵**
   - `blockedByDeckTopLock` 唯一消费点 `src/engine/deck-ops.js:532-533`（drawCards）；`searchDeck`（`src/engine/deck-ops.js:387-444`）无读点。复现：预示者揭示在牌库顶、`blockedByDeckTopLock=true` 时 `searchDeck` 仍取走 01031。卡面明确写 "cannot be searched, drawn, or manipulated in any way"；条目注释（`src/cards/entries/08006.js:10`）与 `docs/edgeOfTheEarth/investigators.md:12` 也声称封锁查找/洗牌，属声明与实现不符。

## 二、Medium findings（13 条，分组）

- **08004**：牌库顶被做成私有信息（`src/cards/entries/08004.js:21 public:false`，`web/locales/zh-CN.misc.js:141` 文案「仅本人可见」），与印刷 revealed（公开）不一致；旧印换牌用 `api.moveCard`（固定 `state.currentSeat`，`src/engine/api-test.js:199`），非本人回合被迫检定时会换错座位的牌（P6）。
- **08005**：投入牌库顶不校验同地点；投入后不重新 sync 牌库顶（诺曼常驻揭示再断一次）。
- **08010**：旧印翻回演武不读 08015「本轮不能翻回」锁（`src/cards/entries/08010.js:34-55` vs `08011b.js:10-12`）；跨关卡 `campaign.eote.disciplines.faces` 不复位（`src/engine/eote-investigator-support.js:256-264`，`initializeDisciplines` 只在首次 sets 为空时执行），下一关开局物理面 Unbroken 但战役状态仍 broken（`integration/mechanic-view.js:64-67` 会投影错面）；翻面「物理面+战役面」逻辑在 9 个条目 + 引擎里重复实现（D5）。
- **08014a**：翻面先于 3 次免费战斗/躲避 → 三次行动全部失去 +1 敏捷（P4：4→3）；「one at a time / different」未建模（额度=本回合最后 3 个普通行动，不强制连续/不区分目标）。
- **08016**：授权后 otherHand 通道用普通行动也能代打（未强制只能花 itemPlay 受限额度，`play-channels.js:322-347` + `engine.js:907-928`）；crossSeat 授权无期限（`play-channels.js:65-83` 只写不删）；「At any time」被降级为 Bob 自己回合/行动阶段的 free 能力（`08016.js:35`）。
- **08017**：[reaction]「打出 Item 资产时置于任意调查员控制下」被建模为常驻自动询问，且对**所有** asset（不限于 Item）都弹窗、无「不触发」选项（`src/engine/actions.js:384-401`）。
- **08008**：条目直写运行时状态 `whip.exhausted = true`（`src/cards/entries/08008.js:30`），违反「只读状态、写入只走 ctx.api」；引擎已有 `api.exhaust`（`src/engine/api-misc.js:520-527`）。

## 三、Low findings（13 条，详见 findings.json）

- 08011b：四张 Broken 面各自复制 `lockedThisRound` helper；伤害/恐惧在 applyHarm 入口（分配/取消前）记账，被防止的伤害也算「受过伤」（`src/engine/enemies.js:859-866`）。
- 08012b/08014b：`handTwoPlus` / `enemyAtLocation` 是离散采样（`eote-investigator-support.js:95-102`；采样点 `dispatch.js:727`、`deck-ops.js:631`、`tests.js:159`），单次结算内部瞬时的 2 张手牌/同地点敌人可能漏记。
- 08007：距离 0 时 turnEnded 反应仍会被询问（criteria 只查回合归属，`08007.js:37-41`），选完无效果。
- 08012a：`api.drawCards` 无抽牌日志（`src/engine/api-misc.js:329` 只返回 texts）。
- 08014a：`grantFreeActions` 无 `api.info`/提示。
- 08015：`weakness.type: 'burdenOfDestiny'`、08018 `'custom'` 是无人读取的元数据串（行为全走 descriptor.resolve）。
- 08004：`deckTopConfig(seat)` 丢参恒 null 且无调用（死代码，`eote-investigator-support.js:150-157`）；强制抽弱点测试用 `drawCards(0)` 触发、旧印未覆盖多人座位。
- 08005/08004：换顶序列（moveCard×2 + clear/reveal）两处重复，且都受 `api.moveCard` 座位作用域限制。
- 08016/08017：`isItemAsset` 两处重复；08017 无 canSkip。
- 08006：条目/文档注释声称封锁「抽牌/查找/洗牌」，实际只有抽牌（按 high 处理，此条从 low 归入 high 的注释修正）。

## 四、D4（原语合规）核对

- **只读状态/写入走 ctx.api**：22 个条目里 21 个合规；唯一违规 **08008:30**（局部变量直写 `whip.exhausted`）。现有合规工具 `tools/audit-card-entry-compliance.mjs` 的正则 `STATE_ROOTS = state|inv|location|enemy|act|agenda|asset|target|card` 只匹配这些前缀，检测不到 `whip.exhausted`；`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/primitive-compliance.json` 的 `directWrites:0` 因此是**假阴性**（账本仍称 P5 新增卡 0 条 R1）。
- **声明即接线**：`investigator.tracksAttacks`/`roundEvents`/`deckTop`/`restrictedAction`、`enemyRule.attacksCannotBeCancelled`/`attackHarmDirect`、`threatEffect.blocksMovementWhileInvestigable`、`assetRule.playUnderAnyAtLocation`、`flags.weaknessStaysOnDeckTop`/`locksDeckWhileRevealed`/`activatableWhileOnDeckTop`、`modifiers.playCost`、`elderSign` 均有引擎读点（grep 与 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/flags-readpoints.json` 对照）。但 **`locksDeckWhileRevealed` 的读点只覆盖抽牌**（见 high 5）；`deckTopConfig`/`passiveDeckTopSeat` 是死导出。
- **无引擎卡号分支**：`src/engine/` 中 grep `'08xxx'` 零命中；卡号只出现在内容层 `content/campaigns/edgeOfTheEarth/investigator-data.js` 与 `src/deck/availability.js`（可用码表，数据层）。
- **存档校验**：`validateEoteInvestigatorFields`（`eote-investigator-support.js:267-285`）经 `investigator-mechanics.js` 接线；`validateEoteState`（`eote-primitives.js:29-52`）覆盖 deckTop/roundDistance/crossSeat/disciplines；`roundEvents`/`eoteFlipAfterTest` 均有形状校验。
- **仅 08004 的旧印换牌**绕过了座位作用域（`api.moveCard` 固定 currentSeat，非条目可控制）。

## 五、D5（复用）核对

- **共用原语用得对**：攻击历史（`eote-investigator-support.js`）、轮内事件记账、牌库顶（`eote-deck-top.js`）、轮初距离（`eote-round-distance.js`）、演武（`eote-disciplines.js`）、受限行动（`restricted-actions.js`，08016 itemPlay 与 08014a fightEvade 都复用）、跨座位（`play-channels.js` otherHand）、延迟翻面（`flipAfterNextTest`）——五位调查员的专属机制基本都有唯一读点，没有按人另写一套规则。
- **重复实现**：
  1. 翻面（物理面 + 战役面同步）在 08010/08011a/08011b/08012a/08012b/08013b/08014a/08014b/08015 共 9 处，`eote-investigator-support.js:111-135` 还有第 4 种写法；建议上收 `api.mechanics.disciplines.flipAsset(asset,to)`。
  2. 08004↔08005 换顶序列重复。
  3. 08016/08017 `isItemAsset` 重复；四张 Broken 面的 `lockedThisRound` 重复。
- **数据双写**：陈丽丽演武码表在 `content/campaigns/edgeOfTheEarth/investigator-data.js:8-26` 与 `web/ui-cards.js:123-124` 各一份（浏览器侧不能 import content，属架构约束，但应在构建期生成/校验，避免漂移；当前值一致）。
- **旧印/回合事件/牌库顶/攻击历史统一读点**：成立（见 D4），没有各卡自造状态字段。

## 六、构筑接入与平行版本边界（任务额外要求）

- **`src/deck/availability.js`**：5 位调查员 `availability='strict'`、`selectable=true`、`deckbuilding=false`；9 张专属卡与 8 张演武 `dependencyOnly=true`、不入构筑池（`availability.js:134-138,160-161,212-227`）。与卡背一致。
- **`src/deck/deckbuilding.js`**：自动/手动构筑都按 `deckRequirements` 加专属卡；陈丽丽的 `options.disciplines` + `options.xp`（1 + floor(xp/15)，上限 4，重复/非法/份数超限均报错）在 `signatureAndWeaknesses`（`deckbuilding.js:333-372`）实现，测试覆盖 0/15 XP、重复、非法、5 张（`tests/eote-investigator-lily.test.mjs:136-180`）。30 张玩家卡 + 1 演武 + N 命运重担 + 1 随机基础弱点的计数正确（测试断言 `built.deck.length===33`）。
- **`web/deck-rules.js`**：`validateDeckRules` 用 `web/ui-cards.js:123` 的 `eoteDisciplineSelection` 镜像同一口径（`web/deck-rules.js:222-236`）；`src/deck/deck-rules.js` 只是 `export * from '../../web/deck-rules.js'`。陈丽丽禁 [[Firearm]] 来自 cards-data `deckOptions` 的 `not/trait`（`INVESTIGATORS['08010'].deckOptions[0]`），测试用假卡验证（`lily.test.mjs:172-179`）。
- **`content/campaigns/edgeOfTheEarth/investigator-data.js`**：`EOTE_DISCIPLINE_SETS`/`startingDiscipline:'08011a'`/`xpPerDiscipline:15`/`burdenCode:'08015'`；`initBeginGameDisciplines` 只在首次初始化 sets（`eote-investigator-support.js:256-264`）——跨关卡 faces 不复位是本批 medium finding（见上）。
- **诺曼牌库顶**：构筑/打出通道成立；揭示时机与可见性有 high/medium（见上）。
- **蒙特雷距离**：`eote-round-distance.js` 用 `roadDistance` 现算最短路（不存派生值），轮初 roundStarts 强制记录、回合结束 turnEnded 按 seat 反应；距离 0/1/≥2 测试全覆盖。
- **平行版本 98007/90062 边界**：实测 `getAvailability`（`src/deck/availability.js:212-258`）：98007/98008/98009/90062/90063/90064 全部 `catalog-only / selectable=false / deckbuilding=false / dependencyOnly=false`，`canSelectInvestigator=false`。与账本 `reprints.parallelVersions` + `parallelVersionsOutOfScope`、docs/edgeOfTheEarth/investigators.md:17 一致，**该边界如账本声称**。cards-data 的 `signatureFor` 含 98007（08005/08006）不影响开放面（平行调查员不可选）。

## 七、prior 账本虚报/证据强度不足清单（Lead 请重点复核）

1. `audit/eote-investigators.json` 全部 verified，但 **08006** 的 `locksDeckWhileRevealed` 只有抽牌读点，`docs/edgeOfTheEarth/investigators.md:12,26` 与条目注释（08006.js:10）声称「封锁抽牌/查找/洗牌」不成立。
2. **08005** verified，但 commitDeckTop 无 eligibility/同地点校验、投入后不重新揭示；测试只测 happy path（norman.test.mjs:106-136）。
3. **08013a** verified，但全局 endOfTest 过期/延迟翻面会被其他调查员的检定触发；测试只测单人（lily.test.mjs:223-236）。
4. **08004** verified 的「牌库顶常驻揭示/强制抽弱点」存在同步缺口与时点差异；强制抽测试用 `drawCards(0)` 触发（norman.test.mjs:174），不是真实触发路径；可见性 private 与卡面 revealed 不符（docs 写「对本人」，但 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/known-deviations.json` 没有任何 08004 近似登记）。
5. **08014a** verified 的断言（lily.test.mjs:246）把「先翻面后行动」的近似写死；与卡面「先行动后翻面」相反，且导致 +1 敏捷提前失效。
6. 合规审计**假阴性**：08008 直写 `whip.exhausted` 未被 `tools/audit-card-entry-compliance.mjs` 检出（见 D4），因此账本「0 条新增 R1」不能作为无违规证据。
7. `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/tests-coverage.json` 把 08011b/08012b/08013b/08014b 标为 `file-only`：实际由 lily.test.mjs:264-285 的行为断言覆盖，是**测试标题归因问题**（标题只提 08010），不是缺测；但该账本口径会低估覆盖、也让 `none/file-only` 统计失真。
8. 与 prior 一致、本次复核通过的点：22 卡全部注册/实现（`implementation()` 全 implemented，daniela/norman 测试里的构筑断言没有被 skip）；`enemyRule.attackHarmDirect`（enemies.js:314）、`attacksCannotBeCancelled`（enemies.js:233）、08003 弱点生成/直伤、08015 二选一与锁定、08009 移动锁/调查成功/失败洗回、08007 距离三档、08016 跨座位控制/共同付费、08017 费用 -1、08018 四档恐惧、构筑接线与平行版本 catalog-only 边界均成立。

## 八、建议修复优先级

1. 先修 high 5 条：08006 牌库操作守卫（可抽成 api 层统一入口）、08005 commitDeckTop 复用 canCommitToTest + 同地点 + 重新揭示、08004 syncPassiveDeckTop 不变量 + 弱点即时抽取、08013a 座位化过期/延迟翻面。
2. 再处理 medium：08014a 延迟翻面（与 08013a 同族原语）、08010 锁共享 helper + 跨关卡 faces 复位、08017 assetRule 过滤/traits + optional、08016 otherHand 必须花 itemPlay 额度、08008 改 api.exhaust、08004 可见性口径（改 public 或登记近似）。
3. 低优先级：日志/提示（08012a/08014a）、死代码（deckTopConfig）、元数据词表（weakness.type）、采样类近似（roundEvents）写进 known-deviations 或在唯一变更入口做事件式标记。
4. 建议 `tests` 补 4 类负向用例：多人非本人回合（08013a/08004 旧印）、锁定期检索（08006）、非匹配图标/跨地点投入（08005）、跨关卡 faces 复位（08010）。
