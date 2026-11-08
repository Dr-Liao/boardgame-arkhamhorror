# EOTE 调查员 08001–08018 独立复核报告（adversarial verifier）

- 复核对象：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/investigators/findings.json` + `notes.md`（审计员 inv-auditor，5 high / 13 medium / 13 low；6 条 prior 账本冲突）
- 复核范围：22 张（08001–08018，含 08011a/b–08014a/b），只读；**未修改** `games/arkhamhorror/**`、`audit/**`、`docs/**`
- 复核产出：本文件 + `inv-verify.json` + 复现探针 `probes-extra.mjs`（均在 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/`）
- 方法：不预设结论；逐条读源码/账本/文档 → 重跑审计员探针 P1–P8 → 自写探针 V1–V7 验证「审计员没验的那一步」→ in-process 复跑 5 个测试文件

## 0. 结论速览

| # | 审计员 high | 复核结论 | 严重度复核 |
|---|---|---|---|
| H1 | 08013a「+5/翻面」按全局检定结束结算 | **confirmed**（P8 复现；并发现翻面标记根本没有过期点，更严重） | high ✔ |
| H2 | 08006 只封锁抽牌，不封锁 searchDeck/操纵 | **confirmed**（P5 + V4：`moveCardTo` 也能绕过） | high ✔ |
| H3 | 08005 投入牌库顶跳过合法性、不校验同地点、投入后不重新揭示 | **partially**（代码缺陷全部属实，且多一条「图标双计」；但**没有真实激活窗口**，「可凭空加图标」在正常对局不可达） | high 需改写理由 |
| H4 | 08004 打出牌库顶后不再重新揭示 | **confirmed**（P1） | high ✔（影响有界：下次抽牌/轮初恢复） |
| H5 | 08004「揭示到弱点即强制抽取」被降级为 drawCards 尾部惰性抽取 | **confirmed**（P2） | **high 偏高 → medium** |

| 项目 | 结果 |
|---|---|
| 13 条 medium 抽样 | 7 条（08010 锁 / 08014a 翻面 / 08016 普通行动 / 08016 授权永久 / 08017 非 Item / 08008 直写 / 08004 可见性+座位）**全部成立**，其中 3 条措辞需要纠正（M2/M3/M5） |
| 6 条 prior 账本冲突 | 5 条 confirmed、1 条 partially（08005 的「verified 缺乏依据」成立，但「运行时可利用」不成立）；C1 存在引用结构错误 |
| tests-coverage `file-only`（任务点名） | **confirmed 为归因误报**（lily.test.mjs:265-285 有真实断言；且 `eote-all-card-acceptance` 对同一条测试记为 strong，两本账互相矛盾） |
| 测试 | **39/39 通过，0 fail / 0 skip**（耗时 9.44s），与审计员一致 |
| 审计员漏掉 | 4 条：08013a 翻面标记无过期点（high）、08014a 额度跨轮残留（high）、08005 图标双计（medium）、08006 可被 `moveCardTo` 绕过（high 扩展） |
| 整体可信度 | **偏高 7.5/10**：机制判断基本可信，可作为修复排期依据；但「严重度校准」与「运行时可达性论证」两处必须改写后才能进最终报告 |

---

## 1. 五条 high 逐条复核

### H1 — 08013a「下一次检定 +5 / 结束后翻面」按全局检定结束结算：**confirmed**

**证据链**

- `src/cards/entries/08013a.js:25-31`：`api.addEffect({ duration:'endOfTest', controllerSeat: inv.seat, modifiers:[{target:'skill:*', amount:5}] })` + `api.flipAfterNextTest(source,'08013b')`。效果只带「控制者座位」，没有「哪一次检定」的身份。
- `src/engine/tests.js:1533`：检定收尾 `for (const effect of expireEffects(state,'endOfTest'))` —— **无座位过滤**，任意调查员的检定结束都会把这条效果清掉。
- `src/engine/tests.js:596-600`：`closeTest()` 里无条件 `applyPendingFlipAfterTests(state)`，同样无座位条件。
- `src/engine/eote-investigator-support.js:111-135`：遍历所有调查员的所有资产，凡带 `eoteFlipAfterTest` 就翻面。

**运行时复现**（P8，`probes.mjs`）：使用后 `effects=1`、资产仍 `08013a`；**座位 1 做一次检定后** `effects=0`、陈丽丽的资产变成 `08013b`，而陈丽丽本人一次检定都没做。

**精确化**：`src/engine/modifiers.js:290,310,342-345` 按 `controllerSeat` 归属修正，所以 +5 本身不会加到别人的检定上；问题精确地是「被别人的检定**消耗/翻面**」。审计员的措辞在这一点上没有问题。

**加强（审计员未提）**：见 AF1 —— 翻面标记连过期点都没有。V2 实测：回合结束（round 2）后 `effects=0`，但资产仍是 `08013a` 且 `eoteFlipAfterTest='08013b'`。也就是说：**用完 08013a 但本回合没做检定 → +5 白给，演武仍会在之后任意一次检定（可能跨轮、可能由别人）结束时翻面**。这条应并入最终报告。

---

### H2 — 08006 只封锁抽牌、不封锁检索/操纵：**confirmed**

**证据链**

- `src/engine/eote-investigator-support.js:159-165`：`blockedByDeckTopLock` 只做判定（返回顶牌），本身不拦任何操作。
- `src/engine/deck-ops.js:532-533`：**全仓唯一消费点**，`drawCards` 开头短路返回 `[]`。
- `src/engine/deck-ops.js:387-444`：`searchDeck` 全程无锁读点，取到牌后照常 `putInHand`（438）。
- `src/engine/deck-ops.js:453-526`：`moveCardTo` 也无锁读点 —— 可以把顶牌直接移入弃牌堆/手牌。
- 声明与实现不符：`src/cards/entries/08006.js:8-14`（注释写「封锁抽牌/查找/洗牌」）、`docs/edgeOfTheEarth/investigators.md:12`（「封锁抽牌与操纵」）。

**运行时复现**

- P5：顶牌揭示预示者、`lockActive=true` 时 `searchDeck` 仍取走 `01031`。
- V4（复核新增）：`lockActive=true` 时 `moveCardTo(s, inv, { code:'08006', from:'deck', to:'discard' })` 直接返回 `'08006'`，弃牌堆出现 08006 —— **连「2 行动弃置」的代价都能绕过**（`moves.js:389-398` / `turn-flow.js:568` 是唯一的正常弃置通道）。

这条 high 成立，且范围比审计员举证的大：不是「searchDeck 一处漏读」，而是「除 drawCards 外全部不设防」。

---

### H3 — 08005 第二条 [fast] 投入牌库顶：**partially**

**代码缺陷属实（且比审计员多一条）**

- `src/engine/eote-investigator-support.js:229-237`：`canCommitDeckTop` 只判「有 skillTest、顶牌在牌库、类型 asset/event/skill」；**没有** `canCommitToTest`、没有 `test.seat`/地点比对、没有 `blockCommitSeats`/weakness subtype 检查。
- `src/engine/eote-investigator-support.js:239-253`：`icons` 用 `Object.values(def.icons)` 全量求和（247，未按检定技能过滤）；push 进 `test.committed` 后把同一数值又加到 `test.extraCommittedIcons`（250）；`clearDeckTop` 后**不 sync**（251）。
- `src/engine/commit-rules.js:19-54`：既有合法性入口（图标匹配 53、额外费用 26-27、`blockCommitSeats` 22、weakness/subtype 52、self/otherTestOnly 33-34）完全没被调用。
- **新发现 AF4（图标双计）**：`src/engine/tests.js:552-563` —— `collectForcedCommitments` 会对不在本地 `commitments` 里的 `committed` 项 `value += item.icons`（555），随后 563 又加 `extraCommittedIcons`，同一张顶牌计两次。

**但「运行时可利用」不成立（关键纠正）**

- 真正进入检定投入窗口的通道只有 `playChannels.commitEntries`（`tests.js:416-425`），里面只有 `beneath / playCommit / attachedCommit`，且逐个走 `canCommitToTest`（417）。**没有 deckTop 投入通道。**
- 检定期间引擎把 commit 提示做成 `pendingChoice`（`tests.js:434-439`）；而 `moves.js:206-208`：`if (state.pendingChoice) return choiceMoves(...)`，`moves.js:597`：`validateMove` 同样只接受 choose。**所以检定窗口里根本提交不了 ability move。**
- 检定之外 `state.skillTest` 被还原（`tests.js:644`），08005 的 criteria（`08005.js:42` = `Boolean(state.skillTest)`）恒 false。
- **V1 实测**：构造 `pendingChoice(kind='commit')` 后 `legalMoves(s,0)` 只返回 `['choose']`，`abilityMoveCount=0`，书的能力没有出现。
- 审计员的 P3a/P3b、以及现有测试 `tests/eote-investigator-norman.test.mjs:127`，都是**手工赋值 `commit.skillTest = {...}`** 后直接调 `legalMoves`/`move`，这不是对局中可达的路径。

**结论**：应改写成两条 ——（1）该卡第二模式**没有真实激活窗口（等于未实现）**；（2）其实现即使被调用也缺 eligibility / 同地点 / 重新揭示，且图标双计。原句「可把不匹配的牌库顶投入检定并凭空加图标」在正常对局里做不到，属**夸大**。严重度仍可定 high，但理由必须换。

---

### H4 — 08004 打出牌库顶后不再重新揭示：**confirmed**

- `src/engine/play-channels.js:649-659`（`takeToHand` 的 deckTop 分支）与 `797-801`（`actionTake`）都只 `consumeDeckTop`，`finish(){}` 空实现；**全仓无 sync 调用**。
- 唯一同步点：`setup.js:357`、`turn.js:100`、`deck-ops.js:630`（抽牌尾部）、`eote-investigator-support.js:185`（08006 弃置后）。
- P1 复现：打出顶牌后 `topAfterPlayingTop=null`，手工 sync 才出现 `01088`。

影响有界（下一次抽牌/轮初即恢复），但「常驻揭示」是诺曼的定义性能力，玩家会直接看到空揭示区；且与 H5 叠加（新顶牌是弱点时也不会立刻触发）。**high 成立**。

---

### H5 — 08004 强制抽弱点被降级为 drawCards 尾部惰性抽取：**confirmed，但 high 偏高**

- `src/engine/deck-ops.js:629-640`：唯一触发点，`drawCards` 尾部 `guard<20` 循环。
- `src/engine/eote-investigator-support.js:167-173,196-220`：`syncPassiveDeckTop` 揭示弱点时**只 reveal 不 draw**。
- 测试 `tests/eote-investigator-norman.test.mjs:174` 用 `drawCards(...,0)` 触发，确实不是「揭示即抽」。

**为什么建议降为 medium**：下一次 `drawCards` 仍会经过同一张顶牌（`deck-ops.js:546-599` 的正常抽牌会先把它抽掉并结算），玩家拿不到额外收益，也无法「绕过」弱点；真实差异只是**弱点在牌库顶多停到下一次抽牌/轮初**（外加 H4 的揭示缺口）。审计员把它单列 high，但没给出「因此产生规则优势」的路径。若最终报告保留 high，应写「时点偏差 + 与 H4 叠加」，不要暗示可利用。

---

## 2. medium 抽样复核（7 条，优先项全覆盖）

| # | 结论 | 关键证据 | 运行时 |
|---|---|---|---|
| M1 08010 旧印不读 08015 锁 | **confirmed** | `08010.js:34-55` 无锁判定；`08011b.js:10-12` 的锁判定（`effect.sourceCode==='08015' && sourceInstanceId===source.id`）未被复用 | **V7**：锁效果在场时旧印仍把 `08011b→08011a`（`lockStillPresent=true`） |
| M2 08014a 翻面先于 3 次行动 | **confirmed（措辞需改）** | `08014a.js:26-31` 同一 resolve 内 grant 后立即 flip；`eote-investigator-support.js:138-147`；`restricted-actions.js:25-33,56-64`；`lily.test.mjs:246-247` 把近似写死 | **P4**：敏捷 4→3、资产 `08014b`、额度 3 |
| M3 08016 普通行动也能代打 | **confirmed** | `table-decisions.js:314-324`；`dispatch.js:280-289` 只校验 `restrictedActionsAvailable`，而 `restricted-actions.js:56-64` 把普通行动算进去；`bob.test.mjs:92-109` 只测了 actionsLeft=0 的算术 | **V5**：`itemPlayCredits=0, actionsLeft=3` → 代打仍合法、`actionCost=1`、`validateMoveError=null` |
| M4 08016 授权无期限 + 「At any time」降级 | **confirmed** | `play-channels.js:65-90` 只写不删（`clearCrossSeatGrant` 无调用点，`api-mechanics.js:228` 仅暴露 API）；`08016.js:33-51` criteria 限自己回合/行动阶段 | 静态确认 |
| M5 08017 常驻询问 + 非 Item | **confirmed（措辞需改）** | `08017.js:24` 无 traits 过滤；`actions.js:387-400` 对任意 asset 弹窗 | **V6**：非 Item 的 `01017 体能训练`（Talent）也弹「由谁控制？」，`canSkip=false` |
| M6 08008 直写 `whip.exhausted` | **confirmed** | `08008.js:30`；`api.exhaust` 在 `api-misc.js:520-522` | 正则复算：`whip.exhausted = true` → NO MATCH；`asset.exhausted = true` → MATCH；`audit/card-entry-compliance.json` 基线 0 条 08008 |
| M7 08004 private 揭示 + 旧印座位 | **confirmed** | `08004.js:21`（public:false）；`web/locales/zh-CN.misc.js:141`（仅本人可见）；`mechanic-view.js:41-50,137-147`；`api-test.js:199`（currentSeat）；`turn.js:579`/`turn-flow.js:419`（currentSeat 只在阶段/回合边界改） | **P6**：座位 0 的手牌/牌库被换动，座位 1 的诺曼只拿到 +X |

**措辞纠正**（三条，见 §5）：M2 的「额度可留到本回合之后使用」是错的（真实问题更严重，见 AF3）；M3 的「无限代打」过强；M5 的「没有不触发选项」应为「窗口强制、canSkip=false，但有 `self` 选项可保持原控制」。

---

## 3. prior 账本冲突（审计员 6 条 + 任务点名的 tests-coverage 1 条）

### C1 08006「三个 flag verified」：**confirmed（引用结构错误）**
- `games/arkhamhorror/audit/eote-investigators.json` 的 `items` **只有 5 条**（08001/08004/08007/08010/08016）；08006 是 `08004.signatures` 下的一项（registered/implemented/dependencyOnly）。**没有 `items[08006]`。**
- 卡级 verified 在 `audit/eote-all-card-acceptance.json`：`summary.partitions.eoteInvestigators = {total:22, verified:22}`。
- 实质成立（唯一读点 `deck-ops.js:532-533` vs 声明），但报告应改引用落点。

### C2 08005 verified：**partially**
- 同 C1 的结构问题。
- `08005.js:8-10` 的注释写「复用 commit-rules 的合法性检查；不合法返回 false 且不移动」——与实现相反，属**注释失实**（这是比「账本虚报」更硬的证据）。
- 但「运行时可利用」不成立（V1），应改写为「不可达 + 实现缺口」。详见 H3。

### C3 08013a verified：**confirmed**（`lily.test.mjs:225-236` 只覆盖单人 happy path 属实；另有 AF1 加强）

### C4 08004 verified：**confirmed**（H4/H5/M7 四点全部成立；账本 evidence 的 4 条测试都不覆盖「打出后重新揭示」「揭示即抽」「多人座位」）

### C5 08014a 测试把近似写死：**confirmed**
- `lily.test.mjs:246-247` 紧跟 `useDiscipline` 断言 `08014b`；与卡面「先行动后翻面」相反。
- 但「额度可留到本回合之后使用」错误（见 AF3）。

### C6 合规审计假阴性（08008）：**confirmed，本轮最有价值的账本发现**
- `tools/audit-card-entry-compliance.mjs:50-54`：`STATE_ROOTS = state|inv|location|enemy|act|agenda|asset|target|card`，`WRITE_RE` 只认这些前缀。
- 正则复算（node）：`whip.exhausted = true` → **NO MATCH**；`inv.exhausted = true` / `asset.exhausted = true` → MATCH。
- `audit/card-entry-compliance.json`：`counts.directStateWrite=149`，基线里**没有任何 08008 条目**；`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/primitive-compliance.json`：`directWrites: []`。
- 结论：账本「0 条新增 R1 / directWrites=0」**不能作为无违规证据**；建议给工具补「局部别名指向 state 对象」的启发式或 AST 规则。

### C7 tests-coverage `file-only` 归因（任务点名）：**confirmed 为误报**
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/tests-coverage.json`：08011b/12b/13b/14b `level='file-only'`、`strongTitles=[]`。
- 实际覆盖：`tests/eote-investigator-lily.test.mjs:265-285` 对四张 Broken 面各测「翻回/不翻回」两分支（共 9 个 case），`287-305` 测 roundEvents 写入 —— 标题以「P5 08010」开头，导致按标题归因的工具把它们算成 08010 的。
- 反向证据：`audit/eote-all-card-acceptance.json` 对**同一条** 08011a/08012a 标题记为 `kind:'strong', titleMatched:true`。**两本账互相矛盾**，说明两边都是标题启发式，`file-only` 统计不可直接当缺测证据。

---

## 4. 审计员遗漏的 4 条（建议补进最终报告）

### AF1 08013a 翻面标记没有过期点（high）
- `eote-investigator-support.js:105-109` 只写 `asset.eoteFlipAfterTest`；**唯一清理点是 `111-135` 的翻面执行本身**（全仓 grep 仅此一处 delete）。
- `turn-flow.js:414`（回合末）/`turn.js:90-95`（轮末）只清 `state.effects`，不碰资产标记。
- **V2**：使用后 `effects=1, marker='08013b'`；`endTurn` 后 `round=2, effects=0, marker='08013b', assetCode='08013a'`。
- 后果：用完但本回合没做检定 → +5 白给，演武仍会在之后任意检定（跨轮/别人）时翻面。

### AF2 08006 可用 `moveCardTo` 绕过（high，H2 扩展）
- **V4**：`moveTopToDiscard='08006'`、弃牌堆出现 08006、`deckChanged=true`。正常弃置要 2 行动（`moves.js:389-398`、`turn-flow.js:568`）。

### AF3 08014a `fightEvade` 额度从不清理（high）
- `grantFreeActions`（`eote-investigator-support.js:138-147`）只写 `inv.fightEvadeOnlyActions`；`clearRestrictedAction`（`restricted-actions.js:121-126`）**全仓无 fightEvade 调用点**。
- `turn.js:552-565` 的阶段重置只对声明 `investigator.restrictedAction` 的调查员清额度；**08010 没有声明**（`08010.js:23-28` 只有 elderSign/roundEvents）。
- **V3**：`afterUse { actionsLeft:22, credits:3 }` → 下一轮 `{ round:2, actionsLeft:3, fightEvadeCredits:3, normalActionsUsable:0 }`。
- 后果：陈丽丽下一轮普通行动点被 3 点受限额度挤占，极端情况 0 个普通行动。

### AF4 08005 图标双计（medium，代码级）
- `eote-investigator-support.js:247-250` + `tests.js:552-563`：`collectForcedCommitments` 对未在本地 `commitments` 的 committed 项加一次 `item.icons`，随后再加 `extraCommittedIcons`。
- 未做运行时构造（该能力不可达，见 H3），标注为 static-only。

---

## 5. 审计员表述需修正的 8 处

1. **H5 严重度**：08004 强制抽弱点 high → 建议 medium（机制属实，无可利用路径）。
2. **H3 可达性**：08005 的 P3a/P3b 与现有测试都靠手工注入 `state.skillTest`；真实检定窗口只接受 choose（`moves.js:206-208,597`）。应改写为「无激活窗口（未实现）+ 实现缺口」。
3. **H3 措辞**：「凭空加图标」正常对局不可达；漏了图标双计（AF4）。
4. **M2 措辞**：代码顺序是先 grant 后 flip（`08014a.js:29-30`），「翻面先于获得额度」不准确；准确说法是「翻面与额度同 resolve 完成，三次行动按 Broken 面结算」。另 `+1 敏捷` 只影响躲避（战斗不用敏捷）。
5. **M2 生命周期**：「额度可留到本回合之后使用」错误——回合结束后无法行动；真实缺陷是额度从不清理并挤占下一轮普通行动（AF3）。
6. **M3 措辞**：「无限代打」过强（仍受行动点/手牌/地点限制）；准确说法是「每回合 1 个只能用于代打的额外行动没有被强制」。
7. **M5 措辞**：「没有不触发选项」→「窗口强制出现、canSkip=false，但有 `self` 选项可保持原控制」。
8. **C1/C2/C3 引用**：`audit/eote-investigators.json#items[080xx]` 不存在（只有 5 条 investigator 级记录）；逐卡 verified 在 `audit/eote-all-card-acceptance.json`。另 `tools/audit-card-entry-compliance.mjs:39-47` 应为 `50-54`（小偏差）。

---

## 6. 必须进最终报告的 Top 3

1. **08013a —— 全局检定结束 + 无过期点的延迟翻面（high，confirmed+加强）**
   `tests.js:1533` / `596-600` / `eote-investigator-support.js:111-135` / `08013a.js:25-31`；P8 + V2。
   修复：`endOfTest` 记录带触发座位；回合末清理 `asset.eoteFlipAfterTest`。
2. **08006 —— 只挡 drawCards，searchDeck 与 moveCardTo 都能绕过，2 行动弃置也可被移走（high，confirmed+扩展）**
   `deck-ops.js:532-533` vs `387-444` / `453-526`；`eote-investigator-support.js:159-165`；P5 + V4。
   修复：统一牌库操作入口读锁。
3. **08014a —— fightEvade 额度从不清理，下一轮普通行动点被吃光（high，新发现）**
   `eote-investigator-support.js:138-147` / `restricted-actions.js:121-126` / `turn.js:552-565,554`；V3。
   修复：阶段/回合重置时 `clearRestrictedAction(inv,'fightEvade')`。

**同样必须出现（不进 Top 3 但不可省略）**：08005 第二模式不可达 + 实现缺口（partially）、08008 直写与合规假阴性（confirmed，账本证据问题）、08010 旧印不读锁（confirmed，V7）。

---

## 7. 整体可信度判断

**结论：偏高（7.5/10）。** 机制层判断可信，账本冲突一节质量最高；但严重度校准与「运行时可利用」的论证需要改写。

**可信的地方**
- 5 条 high 的机制全部有真实代码依据；其中 08013a、08006、08004-sync 在只读探针下**完全复现**；08004-forced 与 08005 的代码事实也成立。
- 账本冲突 6 条中 5 条实质成立；C6（08008 假阴性）与 C7（file-only 误报）经独立复算证实，是本轮最有价值的产出。
- engine / 条目 / doc / web 的行号引用抽查**全部准确**（含 `api-misc.js:520`、`tests.js:1533`、`web/locales/zh-CN.misc.js:141`、`web/mechanic-ui.js:212-214`）。
- 39/39 通过、0 skip 与复核一致。

**需要打折的地方**
- 探针 P3/P6/P8 用「手工注入 `state.skillTest` / `currentSeat`」构造，未先证明等价于真实对局窗口；08005 因此把「实现缺口」误报为「可刷的合法性漏洞」。
- 严重度偏松：08004 强制抽弱点定 high（建议 medium）；08005 的 high 理由不对（应换为不可达+实现缺口）。
- 漏掉 4 条更有价值的缺陷（AF1–AF4），其中两条（08013a 标记、08014a 额度）是 high。
- 账本引用结构错误（`items[080xx]`）会让 Lead 复核时找不到落点。

---

## 附录 A：测试运行

```
cd G:\boardgame-hall-ai\games\arkhamhorror
node --experimental-test-isolation=none --test tests/eote-investigator-daniela.test.mjs \
  tests/eote-investigator-norman.test.mjs tests/eote-investigator-monterey.test.mjs \
  tests/eote-investigator-lily.test.mjs tests/eote-investigator-bob.test.mjs

# tests 39 / pass 39 / fail 0 / cancelled 0 / skipped 0 / todo 0 / duration_ms 9439.7
```

## 附录 B：审计员探针 P1–P8（复核重跑，关键值）

| 探针 | 关键结果 | 判读 |
|---|---|---|
| P1 08004 sync | `topBefore=01031, topAfterPlayingTop=null, topAfterManualSync=01088` | 复现 |
| P2 08004 强制抽 | 揭示后不抽；`drawCards(0)` 后 deck 2→1、`topAfter=01088` | 复现 |
| P3a 08005 图标 | `canCommitDeckTopOnCombatTest=true`，`committed=[{code:01031, icons:1, fromDeckTop:true}]` | 代码复现，但状态为手工注入 |
| P3b 08005 地点 | 座位 1 在 `probeOther`、书主在 `study`，`canCommitDeckTop=true` | 同上 |
| P4 08014a 翻面 | `agility 4→3`，`assetCodeNow=08014b`，`fightEvadeCredits=3` | 复现 |
| P5 08006 搜索 | `lockActive=true` 仍 `searchDeckReturned=['01031']` | 复现 |
| P6 08004 旧印座位 | 座位 0 `hand=['01031']`，座位 1 手牌/牌库不变 | 复现 |
| P7 08011b 记账 | `applyDamage` 后 `roundEvents.damage=1`（入口记账） | 复现 |
| P8 08013a | 座位 1 检定后 `effects=0`、陈丽丽资产 `08013b` | 复现 |

## 附录 C：复核补充探针 V1–V7（`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/probes-extra.mjs`）

| 探针 | 关键结果 | 判读 |
|---|---|---|
| V1 08005 可达性 | `legalMoveActions=['choose']`、`abilityMoveCount=0`、`bookAbilityOffered=false` | 真实检定窗口无法激活该能力 |
| V2 08013a 标记过期 | `afterUse{effects:1,marker:'08013b'}` → `afterTurn{round:2,effects:0,marker:'08013b',assetCode:'08013a'}` | 标记无过期点（AF1） |
| V3 08014a 额度清理 | `afterUse{actionsLeft:22,credits:3}` → 下一轮 `{actionsLeft:3,fightEvadeCredits:3,normalActionsUsable:0}` | 额度跨轮残留（AF3） |
| V4 08006 操纵 | `moveTopToDiscard='08006'`、`deckAfter=[01088,01031]`、`discardHas08006=true` | 操纵路径不设防（AF2） |
| V5 08016 受限额度 | `itemPlayCredits=0, actionsLeft=3, candidateFound=true, actionCost=1, validateMoveError=null` | 普通行动可代打（M3） |
| V6 08017 非 Item | `01017 体能训练(Talent)` 也弹「由谁控制？」、`canSkip=false` | 非 Item 也弹窗（M5） |
| V7 08010 旧印锁 | `before=['08011b'] → after=['08011a']`，`lockStillPresent=true` | 旧印不读 08015 锁（M1） |

## 附录 D：限制

- 浏览器账本 `audit/eote-investigators-browser.json` 未复跑（需真实大厅 HTTP；本轮只做同进程 Node 复核）。
- 08010 跨关卡 `faces` 复位只做静态核对（`setup.js:339-357` / `eote-disciplines.js:76-86` / `eote-investigator-support.js:256-264`），未构造跨关卡运行时。
- AF4（08005 图标双计）为代码级判断，未构造运行时用例。
- AF3 的复现基于单调查员 fixture 的 `endTurn → beginInvestigationPhase` 路径；多人局时序建议再加一条用例确认。
