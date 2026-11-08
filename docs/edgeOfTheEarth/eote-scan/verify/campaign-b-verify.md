# 致命幻景（Fatal Mirage，08549–08595）审计复核

- 复核角色：独立复核员（adversarial verifier），不预设审计结论。
- 复核对象：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/findings.json`（75 卡）、`notes.md`、`tools/repro.mjs`。
- 复核方式：逐条核对 `file:line`；用 in-process 真实引擎入口复现议程推进、抽标记、账本/条目行为；运行测试；统计账本与 primitive-requests。
- 只读声明：本次复核只写 `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/**`，未修改 `games/arkhamhorror/**` 或其它目录。
- 时间：2026-11-08（Asia/Shanghai）。当前工作树有大量未提交改动，以下结论基于当前快照。

**路径缩写**

| 缩写 | 路径 |
| --- | --- |
| `FM` | `games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/fatalMirage` |
| `CE` | `games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/fatalMirage` |
| `EN` | `games/arkhamhorror/src/engine` |
| `AU` | `games/arkhamhorror/audit` |
| `PR` | `artifacts/migration/eote/primitive-requests` |

**复核命令（均已运行）**

```powershell
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/tools/repro.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-runtime.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-token.mjs
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-ledger.mjs
cd games/arkhamhorror
node --experimental-test-isolation=none --test tests/eote-scenario-fatalMirage.test.mjs
node --experimental-test-isolation=none --test tests/eote-scenario-shared.test.mjs
```

---

## 一、结论摘要

### 1.1 对审计员 Top 5 的判定

| # | 声明 | 判定 | 一句话理由 |
| --- | --- | --- | --- |
| a | 议程 v1 到毁灭阈值时 `runAgendaReveal` throw「密谋规则尚未迁移：08550」 | **confirmed** | behavior 确实没有 `agendaReveal`；用真实神话阶段入口 `checkAgenda` 也复现同一 throw。 |
| b | v2/v3 `agendaIndex` 越界，议程静默不推进；阈值/幕面仍是 08550/1a | **confirmed** | v2 index=1、v3 index=2，`agendas` 只有 1 张；doom 20 仍 no-op；阈值 15、stage 1a。 |
| c | 19 个幻景地点 clues=0，核心翻面循环不可用 | **confirmed** | 19/19 `cluesPerInvestigator=0`，`placeLocation` 再硬写 0；Mirage 翻面 ability 也完全缺失。 |
| d | 结局/记录不闭环：无 `resolution`；XP 口径错误 | **partial** | 无 `resolution`、记录不写成立；但 XP 批评针对的是**从未被引擎调用**的 `scenarioResolution`，真实路径的 XP 由 `state.victory` 决定，本关 story 卡因不带 victory 字段而不计入，XP 同样不完整。 |
| e | 60/75 账本证据指向 theHeartOfMadnessPart2；17 张 simplified 依赖的 primitive 请求文件不存在 | **partially refuted** | 60/75 与测试不含卡号完全成立；但 `p7-08560.json`/`p7-08587.json` **存在**于仓库根 `artifacts/`，审计员查错了 `games/arkhamhorror/artifacts/` 树。 |

**Top5 计数：3 confirmed、1 partial、1 partially refuted。** 若必须二选一，e 的“文件不存在”一半应记为 **refuted**；“60/75 证据错误”一半 confirmed。

### 1.2 25 条 high 分层抽样

**22 confirmed / 3 partially / 0 refuted**（维度：impl-vs-text 11、primitive 9、runtime 5）。
3 条 partial 的原因都不是“结论错”，而是：S01 多算一个 rider（skull 本就没有失败 rider）；S05 证据行只覆盖 `flipOnDefeat`、没覆盖同行的 reaction/prey；S07 把 `victoryOnBanish` 安到了没有该键的 08575b 上。
另外补了 2 条 medium（duplication/tests）和 1 条被反证的 medium（simplified 披露链），因为 **120 条 high 里没有 duplication/tests 维度**（duplication 6 条、tests 1 条都是 medium）。详见 §三、§五。

### 1.3 总体可信度

**部分夸大（核心可信，局部错误/夸大）。**

- **成立的核心**：议程 v1 崩溃、v2/v3 索引越界、幕不推进、19 地点 0 线索、`flipStoryFace` 无生产调用、无 `resolution`、60/75 账本证据无效、08585/08586 no-op、GATHER_GROUPS 漏 Chilling Cold、Tekeli 7 张进主遭遇牌库。这些都能用代码/探针复现，**足以支持“本章不可按账本验收”**。
- **明确错误**：① primitive 请求文件“不存在”（反证：根 `artifacts/` 下有，且内容正好覆盖 17 张卡）；② “08549 数值已实现/唯一实现正确”（反证：真实 `performTest` 四个符号全部 delta 0）。
- **夸大/口径问题**：③ 把死代码（`scenarioResolution` 的 XP、`flipStoryFace` 的 banish 分支细节）当作运行时 high；④ “四个混沌标记 rider”多算；⑤ “14 file-only”应为 12 file-only + 2 strong；⑥ “死锁”绝对化（全灭 `noResolution` 仍可结束，只是不可胜利且记录不写）；⑦ 多张地点用“强制/反应文本”模板，但 08556/08561/08566/08574 并没有 forced/reaction 文本。
- **建议**：接受“本章未完成、账本不可信”的大结论；不接受“全部 120 high 都已按运行时验证”“primitive 文件缺失”“08549 数值可用”这三类表述。最终报告应把 §1.4 的五条放在最前面。

### 1.4 必须进入最终报告的 Top 5

1. **议程/幕推进不可用**：v1 到 15 毁灭直接 throw；v2/v3 索引越界 + 阈值/stage 错。
   `FM/definition.js:146-147`、`FM/behavior.js:71-73`、`EN/phases.js:268-283`、`EN/act-agenda.js:326-343`、`EN/turn.js:131,140`。
2. **结局钩子缺失**：无 `resolution`，`fatalMirageTimes/Resolution/Completed/memories*/partnersFacedInnerDemon/xp` 永不写。
   `FM/behavior.js:302-323`、`EN/campaign-flow.js:241-243`、`FM/index.js:29-34`。
3. **核心幻景循环不可用**：19 地点 0 线索 + 无 Mirage 翻面 ability + `flipStoryFace` 无生产调用。
   `FM/definition.js:66-69`、`FM/behavior.js:141-142,201-265`、`card-data.js:37`、参考 `Helpers.hs:82-85`。
4. **08549 混乱标记数值在真实引擎里全部按 0 结算**（审计员漏报，且误判为“已实现”）。
   `FM/chaos.js:6-11`、`EN/treachery-tokens.js:352-364`、`EN/tests.js:1120-1122`、`FM/behavior.js:298-300`。
5. **账本证据系统性错误**：60/75 指向 theHeartOfMadnessPart2 测试；58/58 verified 条目没有可执行 ability/hook。
   `AU/eote-all-card-acceptance.json#records`、`tests/eote-scenario-theHeartOfMadnessPart2.test.mjs:1-206`、`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-ledger.mjs`。

> 另需附注：`GATHER_GROUPS` 漏 Chilling Cold（`FM/definition.js:19-22` vs `AU/eote-scope.json#chapters[fatalMirage].gatherSets`）；08585/08586 no-op（`CE/08585.js:12-14`、`EN/treachery-tokens.js:113-124`、`EN/encounter.js:251-263`）。

---

## 二、Top 5 逐项复核

### a. 议程推进崩溃 — **confirmed**

**声明**：`definition.js:146-147` 把幕/议程 reveal 设为 `campaignRule`，`behavior` 无 `agendaReveal`/`actReveal`；`phases.js:276-278` 在议程达到毁灭阈值时 throw「密谋规则尚未迁移：08550」。

**核对**：

- `FM/definition.js:146-147`：`acts: [stage(08553)].map(... reveal:{type:'campaignRule'} ...)`、`agendas: [stage(08550)].map(... reveal:{type:'campaignRule'} ...)`。
- `FM/behavior.js:302-323`：`behavior` 导出键为 `fatalMirageVersion / agendaCodeForVersion / actCodeForVersion / setupScenario / setupLocations / placeLocation / choosePartner / isAlive / eliminatePartner / flipStoryFace / resoluteVersionOf / basePartnerOf / scenarioResolution / chaosTokenValue / storyVictoryCount`，**没有 `agendaReveal`、`actReveal`、`resolution`**。
- `EN/phases.js:268-283`：`r.type === 'campaignRule'` 时，若 `scenarioBehavior(state).agendaReveal` 不存在 → `throw new Error('密谋规则尚未迁移：${ag.originalCode}')`。
- `EN/act-agenda.js:326-343`：`advanceAgenda` → `withAgendaAdvanceFrame(... if (cur.reveal) runAgendaReveal(...))`，throw 不被吞。
- `EN/turn.js:131,140`：神话阶段放 1 毁灭后调用 `checkAgenda`；`EN/act-agenda.js:426-457` 到阈值调用 `advanceAgenda('doom')`。这是真实对局路径。

**复现**：

```text
node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/tools/repro.mjs
registry scenario id: fatalMirage agendas: 1
v1 after setup: agendas 1 agendaIndex 0 threshold 15
v1 REPRODUCED THROW: 密谋规则尚未迁移：08550
v2 after setup: agendas 1 agendaIndex 1 current= undefined
v2 advanceAgenda returned without throw; agendaIndex= 1 status= playing doom= 20

node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-runtime.mjs
registry behavior id: fatalMirage
agendaReveal hook: undefined
actReveal hook: undefined
resolution hook: undefined
scenarioResolution export: function
v1 checkAgenda THROW: 密谋规则尚未迁移：08550
```

**判定**：成立。审计员的 repro 直接调 `advanceAgenda`，本复核换成真实神话阶段入口 `checkAgenda` 仍 throw，路径更硬。唯一措辞保留：崩在“议程推进/揭示”而非 setup，所以首次进入不会立刻崩，15 毁灭时才崩。

### b. v2/v3 agendaIndex 越界 — **confirmed**

**声明**：`behavior.js:69-74` 把 `agendaIndex` 设为 `version-1`，但 `state.agendas` 只有 1 张（`definition.js:147`）；`advanceAgenda` 静默不推进，doom 累积；阈值仍 15（应 13/11），act stage 恒 1a。

**核对**：

- `FM/behavior.js:71-73`：`state.agendas = [{...scenario.agendas[0], originalCode: agendaCodeForVersion(version)}]`；`state.agendaIndex = (Number(state.agendaIndex)||0) + version - 1`。
- `FM/definition.js:147`：`agendas: [stage(AGENDA_VERSION_CODES[1])]`，只有 1 张。
- `EN/act-agenda.js:331-332`：`const cur = state.agendas[state.agendaIndex]; if (!cur) return` —— 静默返回。
- `EN/act-agenda.js:426-428`：`checkAgenda` 对 `undefined` 议程也直接 `return`。
- `cards-data`：08550 `doom=15`、08551 `doom=13`、08552 `doom=11`；08554 `stage=2`、08555 `stage=3`。

**探针输出**（`_probe-runtime.mjs`）：

```text
v2 agendas: 1 agendaIndex: 1 agenda at index: undefined
v2 checkAgenda return value: undefined
v2 after checkAgenda: agendaIndex= 1 status= playing doom= 20
v2 advanceAgenda return: undefined
v2 after advanceAgenda: agendaIndex= 1 doom= 20
v3 agendas: 1 agendaIndex: 2 agenda at index: undefined
```

`_probe-runtime.mjs` 另打印：v1/v2/v3 的 `doomThreshold` 都是 15、`actStage` 都是 1a、`actIndex` 都是 0（v2 `actCode=08554`、v3 `actCode=08555`，但 stage 没变）。

**判定**：成立。补充：v1 在 15 毁灭先崩，所以 v2/v3 目前事实上很难到达；但修好 v1 后，这个索引/阈值/幕面错误会立即暴露。列为 high 合理。

### c. 19 个幻景地点 clues=0 — **confirmed（核心），公式措辞需修正**

**声明**：`definition.js:66-69` 以 `location({...cluesFixed:false, clues:0})` 生成，`card-data.js:32-41` 因此写 `cluesPerInvestigator:0`；`behavior.js:138-148` 的 `placeLocation` 又硬写 `clues:0,maxClues:0`；幻景地点线索应为“幻景值×未入场记忆数”，0 线索使“共同花线索翻面”永远无法执行。

**核对**：

- `FM/definition.js:66-69`：`location({ id, code, symbol, cluesFixed:false, clues:0 })`。
- `card-data.js:37`：`cluesFixed` 为假 → `cluesPerInvestigator: data.clues` = 0。
- `FM/behavior.js:141-142`：`{ ...data, id, clues:0, maxClues:0, ... }`。
- 运行时探针：`LOCATIONS` 19/19 的 `cluesPerInvestigator` 全为 0；连起始地点 08556 也是 0。
- 参考 `Helpers.hs:82-85`：`PlacedLocation` 时 `revealCluesL .~ PerPlayer (m * n)`，`n` 是仍放在一边的目标数；`BaseCamp.hs:25` 的 `location ... 4 (PerPlayer 3)`、`HedgeMaze.hs:17` 的 `2 (PerPlayer 2)` 说明地点初始线索是 2/3/4，而 `mirage a 1/2` 是**翻面费用**（`GroupClueCost (PerPlayer clues)`，Helpers.hs:57-71），不是线索数本身。
- 卡表 `clues` 字段：08557=3、08560=2、08562=4；mod 完全没用这个字段。

**判定**：核心成立：0 线索 + 没有 Mirage 翻面 ability，翻面循环不可用。措辞修正：审计员 notes 的“幻景值×未入场记忆数”是对的；但任务摘要/部分句子里的“clues=幻景值[per_investigator]”不精确——m 是费用，地点初始线索是 m×未入场目标数（或卡表 `clues` 的 2/3/4）。这不影响结论。

### d. 结局/记录不闭环 — **partial**

**声明**：`behavior` 只有 `scenarioResolution` 没有 `resolution`；引擎读点 `campaign-flow.js:241-243`；XP 口径错误（`behavior.js:276-296`）。

**核对**：

- `FM/behavior.js:302-323`：无 `resolution` 键；只有 `scenarioResolution`。
- `EN/campaign-flow.js:241-243`：`applyResolutionEffects` 读 `scenarioBehavior(state).resolution?.(...)`，无钩子时 `|| {}`，**不报错**。
- `EN/campaign-flow.js:265-266`：无钩子仍会按 `state.victory + bonus` 给每名调查员发 XP。
- `scenarioResolution` 全仓只被 `tests/eote-scenario-fatalMirage.test.mjs:183` 调用；生产路径 0 调用。
- 因此 `fatalMirageTimes/fatalMirageResolution/fatalMirageCompleted/memoriesDiscovered/memoriesBanished/partnersFacedInnerDemon/xp` 在真实路径永不写；`FM/index.js:29-34` 的 `recordReads/Writes` 是死声明。
- `scenarioResolution` 的 XP：`memoryCards` 正则 `/^085(5[6-9]|6\d|7[0-4])b$/` 只收地点 b 面（08556b–08574b，victory 0），漏掉记忆敌人 b 面 08575b–08583b（victory 1）；`xp = records.xp + memoryCards.length`，所以会为 0 胜利点的地点卡发 XP、对 1 胜利点的记忆卡不发。`tests:182` 恰好 push 08557b/08560b（victory 0）并断言 `result.xp`，把错误行为固化。

**判定**：

- “无 `resolution`、结局记录永不写” **confirmed**。
- “XP 口径错误”作为代码级判断 **成立**，但它是**死代码**；真实路径由 `applyResolutionEffects` 用 `state.victory` 发 XP，而本 mod 的 `flipStoryFace` 把 story 卡 push 进胜利区时不带 `victory` 字段（`FM/behavior.js:241,260`），所以本关 story 卡对真实路径 XP 的贡献也是 0。审计员把两者混成一条“XP 口径错误”，且标为 high，容易让 Lead 以为运行时只有 `scenarioResolution` 一处要改。**记 partial**。

### e. 账本虚假 — **partially refuted**

**声明**：60/75 条 evidence 是 scenario-ledger 指向 `tests/eote-scenario-theHeartOfMadnessPart2.test.mjs`（该测试不含 08549–08595 / fatalMirage）；17 张 simplified 依赖的 `p7-08560.json`/`p7-08587.json` 在 `artifacts/migration/eote/primitive-requests/` 不存在。

**核对（统计）**：

```
75 条记录：evidence kind = scenario-ledger 60 / file 14 / strong 1
scenario-ledger 全部：file=tests/eote-scenario-theHeartOfMadnessPart2.test.mjs, chapter=theHeartOfMadnessPart2
file 14：08549,08550,08556,08557b,08560,08560b,08569b,08575,08575b,08579,08579b,08585,08587,08592
strong 1：08556b
```

- `tests/eote-scenario-theHeartOfMadnessPart2.test.mjs` 共 206 行；grep 无 `fatalMirage`、无 `致命幻景`、无 08549–08595 任一卡号。**审计员的两个统计/事实完全成立。**
- `AU/eote-all-card-acceptance.json#records` 的 `ledgerMatched/titleMatched` 也基本都是 false；`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/ledger-validity.json` 已把这批记录列为 `onlyBad`（135 条，其中 eoteCampaign 131）。

**核对（primitive 文件）**：

| 路径 | 文件数 | p7-08560 | p7-08587 |
| --- | --- | --- | --- |
| `artifacts/migration/eote/primitive-requests/`（仓库根） | 43 | **存在** | **存在** |
| `games/arkhamhorror/artifacts/migration/eote/primitive-requests/` | 25 | 不存在 | 不存在 |

`PR/p7-08560.json:1-9` 内容：

- `need`: “fatalMirage 地点「强制/额外费用」规则的通用 locationRule 读点”
- `cards`: `["08560","08561","08562","08565","08566","08567","08571","08572"]`（正好 8 张 simplified 地点）
- `status`: `pending`

`PR/p7-08587.json:1-9` 内容：

- `need`: “伙伴（storyAsset 遭遇卡）的 free/reaction 能力在叙事期的可用入口”
- `cards`: `["08587","08588","08589","08590","08591","08592","08593","08594","08595"]`（9 张 simplified 伙伴）
- `status`: `pending`

**判定**：

- 60/75、测试不含卡号：**confirmed**。
- “请求文件不存在”：**refuted**——审计员在 `games/arkhamhorror/artifacts/` 下查（25 个文件），但账本/`eote-migration.json` 引用的是仓库根 `artifacts/`（43 个文件）。这不是“账本虚假”，而是“审计员路径错误”。
- 仍可保留的两点：① `AU/eote-migration.json:3323-3326` 的 `pendingBehaviorRequests` 虽然文本列了 p7-08560/p7-08587，但 `deferred` 的 `primitiveRequest:*` 条目里没有它们；② `ledger` 的 `reason` 写“近似已披露”，但这 8 个地点其实只有 flags、没有行为，叫“近似”名不副实。这两点是**披露索引/口径**问题，不是“文件不存在”。

---

## 三、25 条 high 分层抽样

> 说明：120 条 high 的维度只有 impl-vs-text 57、primitive 44、runtime 19；duplication 6 与 tests 1 都是 medium。因此 25 条 high 覆盖前三维，另在 §三.3 补 2 条 medium（duplication/tests）和 1 条被反证的 medium（simplified 披露链）。
> 证据行核对以 `CE/*.js`、`FM/*.js`、`EN/*.js` 的 Node/read 行号为准（PowerShell `Get-Content` 对本仓库的中文文件会错误合并行，未采用其行号）。

### 3.1 抽样表（25 条 high）

| # | 卡号 | 维度 | issue 摘要 | 判定 | 核对证据 |
| --- | --- | --- | --- | --- | --- |
| S01 | 08549 | impl-vs-text | 四个混沌标记的失败追加 rider 未实现（只实现数值） | **partially** | `CE/08549.js:9-16` 仅 `flags.tokenMeanings`，无 `afterTest`；`FM/chaos.js:6-34` 仅数值；`FM/behavior.js:302-323` 无 afterTest。3 个 rider（cultist/tablet/elder_thing）确实缺；skull 没有失败 rider，“四个”多算 1 个。另数值本身也未生效（§七.1），故“只实现数值”不成立。 |
| S02 | 08550 | impl-vs-text | 正面 [fast] 与背面“其余调查员被击败…”只有 agendaRule，无 agendaReveal | **confirmed** | `CE/08550.js:12`（`agendaRule.freeMoveToPrisonOfMemories`）；`FM/behavior.js:302-323` 无 agendaReveal；`EN/phases.js:276-278` throw。`freeMoveToPrisonOfMemories` 全仓 0 读点。 |
| S03 | 08553 | impl-vs-text | 幕目标/推进无实现（actRule:{}；无 checkObjectives/actReveal），R1 不可达 | **confirmed** | `CE/08553.js:12` `actRule:{}`；`FM/behavior.js:302-323` 无 actReveal/checkObjectives；若幕揭示会走 `EN/reveal.js:151-161` 的 campaignRule throw。 |
| S04 | 08556 | impl-vs-text | Mirage 关键词缺失；地点线索置 0，核心循环不可用 | **confirmed** | `FM/definition.js:66-69`；`FM/behavior.js:141-142`；`card-data.js:37`；参考 `Helpers.hs:82-85`。19/19 `cluesPerInvestigator=0`；Mirage/cleared of mirages 无读点。 |
| S05 | 08575 | impl-vs-text | 被击败时翻面（flipOnDefeat）与 [reaction] 缺失；preyPartner 未接线 | **partially** | `CE/08575.js:12-13`；`FM/behavior.js:302-323`；grep `flipOnDefeat`/`preyPartner` 非条目 0。实质成立；但证据行 12 只覆盖 `enemyRule.flipOnDefeat`，reaction/prey 在 13 行，行号不够精确。 |
| S06 | 08576 | impl-vs-text | 同上（9 张记忆敌人无 abilities；reaction 未接线） | **confirmed** | `CE/08576.js:12-13`（`reactionHealDamageBack`、`preyPartner`）；`FM/behavior.js:302-323`；abilities 0。 |
| S07 | 08575b | impl-vs-text | resolutePartner/record/victoryOnBanish 无读点，翻面不记录、不切坚毅 | **partially** | `CE/08575b.js:12-14`；`FM/behavior.js:218-262` 只读 `memoryEnemy/partner/victory`，不读 `resolutePartner/record`。但 08575b **没有** `victoryOnBanish`（该键在 08566b–08574b），属举证张冠李戴。 |
| S08 | 08584 | impl-vs-text | cleared of mirages 时失去冷漠、发现线索后放等量毁灭均未实现 | **confirmed** | `CE/08584.js:12-13`；grep `losesAloofAtFlippedLocation`/`doomOnClueDiscover` 非条目 0；abilities 0。Aloof/Hunter 本身由 `card-data.js:70` 解析，但这两个条件能力缺失。 |
| S09 | 08585 | impl-vs-text | 显现无实现：entryRevelation 路径无 encounterResolve/test/effect，真实抽到 no-op | **confirmed** | `CE/08585.js:12-14`；`EN/treachery-tokens.js:113-124`；`EN/encounter.js:251-263`。`resolveTreacheryBody` 返回 undefined → `placed=false` → 弃牌。 |
| S10 | 08588 | impl-vs-text | 伙伴能力未实现（abilities: []），只有无读点的 partnerRules | **confirmed** | `CE/08588.js:14-15`；abilities 0；`partnerRules` 非条目读点 0。 |
| S11 | 08590 | impl-vs-text | 同上（08590 玛拉·辛哈医生） | **confirmed** | `CE/08590.js:14-15`；abilities 0；partnerRules 无读点。 |
| S12 | 08557 | primitive | 本卡强制/反应文本只有 flag 声明（mirageId/tier/reactionInvestigate），无读点 | **confirmed** | `CE/08557.js:12-15`；grep `reactionInvestigate` 非条目 0。卡面 [reaction] 确实未实现；证据 :12 是 flags 块起点，具体 key 在 :15。 |
| S13 | 08558 | primitive | 只有 flag 声明（mirageId/tier/forcedInvestigate），无读点 | **confirmed** | `CE/08558.js:12-15`；grep `forcedInvestigate` 非条目 0。 |
| S14 | 08559 | primitive | 只有 flag 声明（mirageId/tier/forcedReveal），无读点 | **confirmed** | `CE/08559.js:12-15`；grep `forcedReveal` 非条目 0。 |
| S15 | 08560 | primitive | 只有 flag 声明（mirageId/tier/forcedAfterInvestigate），无读点 | **confirmed** | `CE/08560.js:12-15`；grep `forcedAfterInvestigate` 非条目 0。 |
| S16 | 08562 | primitive | 只有 flag 声明（mirageId/tier/forcedOnFrostReveal），无读点 | **confirmed** | `CE/08562.js:12-15`；grep `forcedOnFrostReveal` 非条目 0。 |
| S17 | 08566 | primitive | 只有 flag 声明（mirageId/tier/investigatorShroudBonus/extraInvestigateCost），无读点 | **confirmed** | `CE/08566.js:12-22`；grep 两键非条目 0。 |
| S18 | 08567 | primitive | 只有 flag 声明（mirageId/tier/investigatorShroudBonus/moveCost），无读点 | **confirmed** | `CE/08567.js:12-20`；grep `flags.moveCost` 0。引擎 4 处 `moveCost` 是其它字段（`EN/engine.js:961,2793`、`EN/table-decisions.js:195`），不读 entry flag。 |
| S19 | 08574 | primitive | 只有 flag 声明（mirageId/tier/investigatorShroudBonus/freeFrostForClues），无读点 | **confirmed** | `CE/08574.js:12-23`；grep `freeFrostForClues` 非条目 0。 |
| S20 | 08556b | primitive | storyFlip 的唯一读点 flipStoryFace 无引擎/内容调用点（仅测试直调） | **confirmed** | `CE/08556b.js:12`；`FM/behavior.js:201-265`；全仓 `flipStoryFace` 仅 behavior 定义/导出 + `tests:96,117,128,134`，无生产调用。 |
| S21 | 08550 | runtime | v2/v3 agendaIndex 越界，议程不推进 | **confirmed** | `FM/behavior.js:71-73`；`FM/definition.js:147`；`EN/act-agenda.js:331-332`；`_probe-runtime`：v2 agendas=1、agendaIndex=1、doom=20 no-op。 |
| S22 | 08551 | runtime | 同上（08551 版本二） | **confirmed** | `FM/behavior.js:71-73`；`_probe-runtime`：v2 agendaCode=08551，但 agendaIndex=1、agendas=1、agenda=undefined。 |
| S23 | 08552 | runtime | 同上（08552 版本三） | **confirmed** | `FM/behavior.js:71-73`；`_probe-runtime`：v3 agendaIndex=2、agendas=1。 |
| S24 | 08554 | runtime | 幕只有 1 张且 stage 恒为 1a，v2/v3 幕面数据未生效 | **confirmed** | `FM/behavior.js:71-72`；`_probe-runtime`：v2 actCode=08554，但 actStage=1a、actIndex=0；印刷 08554 `stage=2`。 |
| S25 | 08587 | runtime | 伙伴资产在真实引擎路径中不会入场：choosePartner 无生产调用点、behavior 无 preScenarioSetup | **confirmed** | `FM/behavior.js:173-195`；`EN/setup.js:740,754` 有两个 preScenarioSetup 读点，fatalMirage behavior 未声明；grep `choosePartner` 仅 `tests:88,110`。 |

**统计**：confirmed 22 / partially 3（S01、S05、S07）/ refuted 0。

### 3.2 抽样中的典型问题

1. **模板化误伤**：08556/08561/08566/08574 的 primitive issue 都写“本卡的强制/反应文本只有 flag 声明”，但四张卡实际分别只有 Mirage、被动 +3 shroud、被动 -2 shroud + 额外费用、[fast] 发现 2 线索，**没有 forced/reaction 文本**。问题本身（flags 无读点）成立，措辞不成立。见 `cards-data` 对应 `text` 与 `CE/08556.js:12` 等。
2. **证据行不精确**：记忆敌人 issue 只引 `08575.js:12`（`enemyRule.flipOnDefeat`），但同一条还断言 `[reaction]`/`preyPartner` 缺失，这些在 `08575.js:13`；模板批量生成时按“代表行”引用，逐卡核对会掉分。
3. **死代码 high**：08575b 的 `victoryOnBanish`、`scenarioResolution` 的 XP 都只存在于**没有生产调用**的代码路径；作为代码质量/未来修复项可以，作为“运行时 high”证据强度不足。
4. **`victoryOnBanish` 张冠李戴**：该键在 08566b–08574b，不在 08575b–08583b；审计员把两组 storyFlip 键混在一句里。
5. **`08549` 的“四个”**：skull 只有 `-X`，没有“If you fail” rider；正确说法是 3 个失败 rider。

### 3.3 补充抽样（duplication / tests / 披露链）

> 这 3 条不在 25 条 high 内：duplication 6 条、tests 1 条都是 medium；披露链是 scenario 级 medium。列在这里是为了覆盖五维，并给出本复核唯一一条 **refuted**。

| # | 卡号/范围 | 维度 | issue 摘要 | 判定 | 核对证据 |
| --- | --- | --- | --- | --- | --- |
| X01 | 08550/08551/08552 | duplication (medium) | 三版议程除 version 外完全重复，规则应上收原语 | **confirmed** | `CE/08550.js:11-14`、`CE/08551.js:11-14`、`CE/08552.js:11-14`；三文件仅 `version` 行不同，`agendaRule` 完全一致。 |
| X02 | scenario | tests (medium) | 测试/账本证据不成立：61/75 none；60/75 scenario-ledger；测试无 startScenario/applyResolutionEffects | **partially** | 60/75、测试不含卡号、无 startScenario/applyResolutionEffects 均确认；但 tests-coverage 实际 none 61 / file-only 12 / strong 2，不是“14 file-only”；08592 有一条真实引擎 ability 交易测试（`tests:157-176`）。 |
| X03 | 08560–08572 / 08587–08595 | primitive (medium) | simplified 披露链断裂：p7-08560/p7-08587 请求文件不存在 | **refuted** | `PR/p7-08560.json:1-9`、`PR/p7-08587.json:1-9` 存在且 `cards` 正好覆盖 8 地点 + 9 伙伴；仅 `AU/eote-migration.json:3323-3326` 的 deferred 索引未列 `primitiveRequest` 条目。审计员查错了 `games/arkhamhorror/artifacts/` 树。 |

**补充统计**：X01 confirmed、X02 partially、X03 refuted（这是本次复核唯一 refuted 的整条 issue）。

---

## 四、测试复核

### 4.1 文件与断言强度

`tests/eote-scenario-fatalMirage.test.mjs`（196 行，8 test）：

- `:7-13` 直接 import engine / chapter / entries；`:33` 手工 `registerCardAbilities`。
- `:47-58` 结构/story-access；`:60-83` 三次 setup；`:85-105` choosePartner + flipStoryFace；`:107-123` 放逐；`:125-137` 08556b/08560b 翻面；`:139-155` 条目 flags + chaos 数值；`:157-176` 08592 真实引擎 ability 交易；`:178-196` 直接调 `scenarioResolution` + JSON 往返。
- **没有** `startScenario`、`applyResolutionEffects`、`drawEncounter`/遭遇抽牌路径断言。`:157-176` 的 08592 测试用了 `fixture`/`resolveTransaction`/`executeDescriptor`，是**真实引擎 ability 交易**，但不是 `startScenario`/结局/遭遇路径；审计员 §六 也承认了这一点。
- `:140-145` 断言 `registeredEntry('08550').flags.version`、`08560.flags.tier/forcedAfterInvestigate`、`08575.flags.memoryEnemy`、`08585.flags.attachLocationClues`、`08549.flags.tokenMeanings` —— **恰好为“声明存在、无读点”背书**。
- `:91-92` 有死代码：`const basePartner = Object.entries(...).length ? null : null; void basePartner`。
- `:178-196` 直接调 `scenarioResolution` 并手工 `state.victoryDisplay.push(...)`，不等于引擎会调用它。

### 4.2 运行结果

```text
node --experimental-test-isolation=none --test tests/eote-scenario-fatalMirage.test.mjs
# tests 8 / pass 8 / fail 0

node --experimental-test-isolation=none --test tests/eote-scenario-shared.test.mjs
# tests 19 / pass 19 / fail 0
```

**27/27 全绿**，与审计员 §二 一致。但全绿不代表章节可玩：8 条 fatalMirage 测试全部绕开 `startScenario`/结局钩子/遭遇抽牌；shared 19 条覆盖的是遭遇组/伙伴/Tekeli 原语，不覆盖 fatalMirage 章节进程。

### 4.3 测试覆盖统计修正

`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/tests-coverage.json` 对 75 条的实际分布：

```
none 61 / file-only 12 / strong 2（08556、08556b）
```

审计员写“61/75 none；14 张 file-only”。**61 对，14 错**：14 是账本 evidence 的 `file` 条数（`AU/eote-all-card-acceptance.json`），不是 tests-coverage 的 file-only 数；tests-coverage 是 12 file-only + 2 strong。这个混淆不影响“断言弱”的结论，但统计应更正。

---

## 五、simplified 17 抽查（10 张）

> 任务要求抽查 8 张；本复核把 8 个简化地点全部核了，另加 2 个伙伴，共 10 张（超过最低要求，覆盖两类原语）。

17 张 = 8 个地点（08560/61/62/65/66/67/71/72）+ 9 个伙伴（08587–08595）。账本 `reason` 全部为 `pending-primitive: p7-08560` 或 `p7-08587（近似已披露，不阻塞 gate）`。

| 卡号 | 名称 | 账本 reason | 请求文件 | 条目现状 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 08560 | 树篱迷宫 | p7-08560 | **存在** `PR/p7-08560.json` | `CE/08560.js:12-15` 仅 flags（`forcedAfterInvestigate`），abilities 0，无读点 | **missing confirmed**；文件不存在 refuted |
| 08561 | 荒废车站 | p7-08560 | **存在** | `CE/08561.js:12-15` 仅 `shroudBonusIfTreacheryAttached`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08562 | 沿海水域 | p7-08560 | **存在** | `CE/08562.js:12-15` 仅 `forcedOnFrostReveal`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08565 | 耸立岩石 | p7-08560 | **存在** | `CE/08565.js:12-15` 仅 `forcedOnFrostReveal`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08566 | 飞机场 | p7-08560 | **存在** | `CE/08566.js:12-22` 仅 `investigatorShroudBonus`/`extraInvestigateCost`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08567 | 阿拉斯加荒野 | p7-08560 | **存在** | `CE/08567.js:12-20` 仅 `investigatorShroudBonus`/`moveCost`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08571 | 肯斯勒博士的办公室 | p7-08560 | **存在** | `CE/08571.js:12-21` 仅 `investigatorShroudBonus`/`forcedAfterInvestigate`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08572 | 摩艾石像 | p7-08560 | **存在** | `CE/08572.js:12-21` 仅 `investigatorShroudBonus`/`forcedTreacheryAttach`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08587 | 威廉·戴尔教授 | p7-08587 | **存在** `PR/p7-08587.json` | `CE/08587.js:14-15` `abilities:[]`，仅 `partnerRules`，无读点 | **missing confirmed**；文件不存在 refuted |
| 08588 | 丹佛斯 | p7-08587 | **存在** | `CE/08588.js:14-15` `abilities:[]`，仅 `partnerRules`，无读点 | **missing confirmed**；文件不存在 refuted |

**结论**：

- “这 10 张实际是 missing（high）” **成立**：8 个地点只有 flags，2 个伙伴 `abilities: []`；全部没有可执行行为。
- “p7-08560/p7-08587 请求文件不存在” **不成立**：根 `artifacts/` 下存在，且 `cards` 列表正好覆盖 17 张。审计员查的是 `games/arkhamhorror/artifacts/`（25 个文件）。
- 但“披露质量”仍可批评：`PR/p7-08560.json` 明确说“engine 尚无可执行读点；章节 behavior 只能做数据校验”，这其实是**承认缺失**，不是“近似实现”；`ledger` 的 `reason` 却写“近似已披露”，`allCardSimplified` deferred 写“行为按现有原语近似实现”，口径不符。`AU/eote-migration.json:3323-3326` 的 `pendingBehaviorRequests` 也没有把这两项列进 `primitiveRequest:*`。
- 另：08589/92/93 有 `abilities`（各 1 条），但 `[fast]` 被实现为消耗 1 行动（`kind:'action'`, `cost:{action:true}`），是真正的“近似”；审计员把它们判 approximation 合理。
- 账本内部矛盾成立：另外 11 张同机制地点（08556/57/58/59/63/64/68/69/70/73/74）也被标 **verified**，其中 08557/58/59/63/64/68/69/70/73/74 同样只有 flags、无读点。见 `AU/eote-all-card-acceptance.json#records`。

---

## 六、统计、账本、牌组、诡计

### 6.1 基本统计（全部与账本一致）

| 指标 | 审计员 | 复核 |
| --- | --- | --- |
| records | 75 | 75 |
| match / approximation / gap / blocked | 0 / 3 / 72 / 0 | 0 / 3 / 72 / 0（approximation=08589/092/093） |
| accepted=false | — | 75/75 |
| issues | high 120 / medium 50 / low 1 | 120 / 50 / 1 |
| 账本 verified / simplified | 58 / 17 | 58 / 17 |
| evidence scenario-ledger / file / strong | 60 / 14 / 1 | 60 / 14 / 1 |
| scenario-ledger 文件/chapter | theHeartOfMadnessPart2 | 一致 |
| card issues / scenario issues | 151 / 20 | 151 / 20 |

### 6.2 58/58 verified 没有可执行条目行为（新增量化）

`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-ledger.mjs` 逐条 import 75 个 entry：

```
with abilities>0: 3（08589/08592/08593，全部 simplified）
with executable hook: 0
verified: 58
verified with abilities>0: 0
verified with only flags (no abilities, no hooks): 58
```

也就是说，账本里 58 条 `verified` 的 `entry.implemented:true` 只是**条目自声明**；没有任何一张 verified 卡有 `abilities` 或 `encounterResolve/afterTest` 等可执行钩子。审计员“58 verified 无一能按 D1 判 match”的结论成立，但应把这条量化证据放进最终报告，而不是只引用“60/75 证据错”。

### 6.3 GATHER_GROUPS / 遭遇牌组

- `FM/definition.js:19-22`：7 组（fatalMirage、agentsOfTheUnknown、leftBehind、miasma、namelessHorrors、silenceAndMystery、tekelili）。
- `AU/eote-scope.json#chapters[fatalMirage].gatherSets`：8 组，含 **ChillingCold**；参考 `FatalMirage.hs:191-198` 也 gather 8 组。
- 实际 `ENCOUNTER_DECK` 22 张：fatal_mirage 3、agents 2、left_behind 3、nameless 3、miasma 2、silence 2、tekelili 7。
- Chilling Cold 的 2 张（01167/01168）未入组。
- Tekeli 7 张（08723–08729，subtype=weakness）被放进主遭遇牌库；`FM/index.js:27` `requiredMechanicIds: []`，behavior 没有 `initializeTekeliDeck`（其他 EOT 章节有：`content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js:114`、`iceAndDeathPart2/behavior.js:91`；引擎原语 `EN/eote-tekeli.js:63`）。审计员这条成立（`index.js:26` 是 `requiredInvestigatorIds`，`requiredMechanicIds` 在 27 行，属小行号误差）。

### 6.4 08585/08586 no-op

- `card-data.js:73` 给所有诡计 `entryRevelation:true`。
- `EN/treachery-tokens.js:113-124`：`entry.encounterResolve` 或 `entry.treacheryRule.test` 都没有；`t.effect?.kind==='campaignRule'` 也没有（本章 behavior 无 `resolveEncounter`）。
- 结果：`resolveTreacheryBody` 返回 undefined；`EN/encounter.js:251-263` 判 `placed=false` → `discard().push(code)`。
- `CE/08585.js:12-14` 的 `treacheryRule.attachToNearestUnflippedLocation`、`CE/08586.js:12-14` 的 `treacheryRule.chooseOne` 全仓 0 读点。
- **成立**。另：08586 中文卡面“受到2点伤害”与英文“Take 2 horror”不一致（`cards-data` textZh），这是数据文案问题，不是本条 no-op 的证据，但值得文案 owner 确认。

### 6.5 08549 混乱标记数值：真实引擎里全部 0（审计员漏报）

这是本次复核最重要的新发现。

**代码**：

- `FM/chaos.js:6-11`：`FATAL_MIRAGE_TOKEN_MEANINGS` 用**数字** `cultist:-2, tablet:-3, elderthing:-4`，`skull` 用**字符串**“胜利区剧情卡牌数”。
- `EN/treachery-tokens.js:352-364`：`resolveSpecialToken` 读到 `m` 后，只认 `m.kind==='count'` 或 `m.delta/m.mod`；数字/字符串既没有 `kind` 也没有 `delta` → `delta = 0`。
- `EN/tests.js:1120-1122`：普通检定主路径就是 `resolveSpecialToken`；`EN/tests.js:1122` 没有别的数值分支。
- `FM/behavior.js:298-300` 的 `chaosTokenValue` / `fatalMirageChaosTokenValue` 全仓**没有引擎读点**（grep `chaosTokenValue` 只命中定义、导出、测试）。

**探针**（`_probe-token.mjs`，真实 `performTest`，base 3）：

```text
fatalMirage cultist   {"value":3,"success":true,"drawn":["cultist"]}     # delta 0（应为 -2）
fatalMirage tablet    {"value":3,"success":true,"drawn":["tablet"]}      # delta 0（应为 -3）
fatalMirage elderthing{"value":3,"success":true,"drawn":["elderthing"]}  # delta 0（应为 -4）
theHeartOfMadnessPart2 tablet {"value":0,"success":false,"drawn":["tablet"]} # delta -3，对照组正常
```

`skull` 也一样：直接调 `resolveSpecialToken(state, 0, inv, 'skull', [])` 返回 `{delta:0}`；`performTest` 在 `victoryDisplay=[08556b]` 时 value=3（base 3，delta 0，期望 +1）。所以“四个符号全部 0”不是夸张。

**影响**：

- 审计员 `08549` 的 clauses 把 skull 标 `implemented`、cultist/tablet/elder_thing 的 note 写“数值已实现，失败追加效果未实现”；`notes §九` 更写“真正有引擎读点且实现正确的：08549 tokenMeanings（数值层面）”。**这些都不成立**：真实引擎四个符号全部按 0 结算，比没有 `tokenMeanings` 还差（`SYMBOL_DEFAULTS` 的 -1/-2/-3/-3 被数字覆盖）。
- `tests/eote-scenario-fatalMirage.test.mjs:139-155` 直接调 `fatalMirageChaosTokenValue`，没有走 `performTest`，所以测试全绿掩盖了这个问题。这正是审计员自己批评的“直调 behavior”测试弱点，却在 08549 上被自己忽略。
- 该问题可能同样影响 `iceAndDeathPart1/2` 等使用数字 `tokenMeanings` 的章节；本复核只对 fatalMirage 下结论，建议 Lead 另开一项横向扫描。

### 6.6 结局出口不是绝对死锁

- `EN/harm-threat.js:358-359`：全灭时 `finishScenario('noResolution')`；`EN/campaign-flow.js:241-243` 无 `resolution` 也会走默认发 XP。
- 所以 fatalMirage 的真实状态是：**不可胜利（幕不推进）、议程 v1 会崩、记录不写**；不是“任何情况下都无法结束”。若全灭先于 15 毁灭发生，仍可回主线。审计员 §八.6 自己写了“只有全灭 noResolution 一条出口”，但 §八 的“死锁判定：是”表述过强。最终报告建议写“不可胜利/不可正常通关”，不要写“绝对死锁”。

---

## 七、复核中新增/修正的发现

| # | 发现 | 严重度 | 证据 | 说明 |
| --- | --- | --- | --- | --- |
| N1 | 08549 四个混乱标记在真实引擎里全部 delta 0 | high | `FM/chaos.js:6-11`；`EN/treachery-tokens.js:352-364`；`EN/tests.js:1120-1122`；`FM/behavior.js:298-300` | 审计员漏报，且反向误判为“数值已实现”。 |
| N2 | 58/58 verified 条目没有可执行 ability/hook | high | `_probe-ledger.mjs`；`AU/eote-all-card-acceptance.json#records` | 账本 `verified` 不可作为 D1 证据。 |
| N3 | p7-08560/p7-08587 请求文件存在，审计员查错 artifacts 树 | medium | `PR/p7-08560.json:1-9`；`PR/p7-08587.json:1-9`；`games/arkhamhorror/artifacts/...` 25 个文件 | “文件不存在”应撤回；保留 deferred 索引缺口。 |
| N4 | “四个混沌标记 rider”多算一个 | low | `cards-data` 08549 text；`CE/08549.js:13-16` | skull 无失败 rider。 |
| N5 | 08556/08561/08566/08574 被套上“强制/反应文本”模板 | low | `cards-data` 对应 text；`CE/08556.js:12` 等 | flags 无读点仍成立，措辞不成立。 |
| N6 | “死锁”应降级为“不可胜利/记录缺失，全灭仍可结束” | medium | `EN/harm-threat.js:358-359`；`EN/campaign-flow.js:241-243` | 避免 Lead 误判为绝对无法结束。 |
| N7 | 08554/08555 的 stage 未随版本切换 | high | `FM/behavior.js:71-72`；`_probe-runtime`；`cards-data` 08554 stage=2、08555 stage=3 | 审计员已列在 scenario issue 2，本复核确认。 |
| N8 | `setup.js` 的 `preScenarioSetup` 读点确实存在（740/754），fatalMirage behavior 未声明 | high | `EN/setup.js:740,754`；`FM/behavior.js:302-323` | 审计员这条引用正确，不是问题；列此仅为确认“不是引擎缺读点”。 |

---

## 八、总体可信度判断与给 Lead 的建议

### 8.1 判断：**部分夸大**

| 维度 | 评价 |
| --- | --- |
| 核心结构判断 | **可信**。议程崩溃、v2/v3 索引、幕不推进、0 线索、无 resolution、账本 60/75 证据错、08585/86 no-op、Chilling Cold/Tekeli 牌组，全部可复现。 |
| 严重度分级 | **偏高一档**。至少 4 条 high 依赖**无生产调用**的代码路径（`flipStoryFace` banish 分支、`scenarioResolution` XP、`08575b.victoryOnBanish` 等）；应拆成“运行时 high”与“修复时必须一起改的 dead code”。 |
| 证据质量 | **中等偏上但有批量模板痕迹**。primitive 卡片大量按“flags 无读点”批量生成，`file:line` 多指向 flags 块起点而非具体 key；少数证据张冠李戴（`victoryOnBanish`）。 |
| 事实错误 | **2 个实质性**：primitive 文件“不存在”、08549 数值“已实现”。这 2 个都会误导 Lead 的修法/验收。 |
| 统计 | 主统计（75/58/17/120/50/1/60/14/1）全对；小统计“14 file-only”错（应为 12+2 strong），“四个 rider”错（应为 3）。 |

**一句话**：这不是“不可信”的审计——它的**大方向是对的、关键运行时缺陷是真的**；但它把“账本/测试的表面证据”批得很重的同时，自己在两处犯了同类的“没跑真实路径”错误（primitive 文件、08549 数值），并把若干 dead code 升格成 high。最终报告应采用其结构结论，修正其 2 个事实错误和 3-4 个夸大项。

### 8.2 建议的最终报告口径

1. **验收结论**：fatalMirage **不接受**账本 `verified`/`simplified`；本章 `status: playable` 不成立，建议降为 `development`/`blocked`，直到 §1.4 的 1–3 修完。
2. **必须修的顺序**：
   - 先修议程/幕（否则一进对局就崩/无法胜利）：`definition.js:146-147` 补 `agendaReveal`/`actReveal`，`behavior.js:71-73` 去掉 `agendaIndex=version-1`，按版本取 08551/08552 的 `doomThreshold` 13/11 和 08554/08555 的 stage 2/3。
   - 再修 `resolution` 钩子与 records/XP（`behavior.js:302-323` + `campaign-flow.js:241-243`）。
   - 再修 Mirage 地点线索/翻面（`definition.js:66-69`、`behavior.js:141-142`、`flipStoryFace` 接线）。
   - 单独修 08549 tokenMeanings 的对象 schema（`chaos.js:6-11`），否则四个符号全是 0。
   - 账本：60 条 scenario-ledger 证据必须重做；`verified` 58 条要按 entry ability/hook 重审；primitive 请求文件保留，但 deferred 索引补 `primitiveRequest:p7-08560/p7-08587`，并把 8 个地点从“近似”改为“missing”。
3. **不要写进最终报告的说法**：
   - “p7-08560/p7-08587 不存在”（错）。
   - “08549 数值已实现/唯一正确”（错）。
   - “fatalMirage 绝对死锁”（过强；全灭仍可结束）。
   - “120 条 high 全部经过运行时验证”（实际大量是静态/模板）。

### 8.3 复核产物

- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/campaign-b-verify.md`（本文件）
- `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/campaign-b-verify.json`（结构化：top5 / sample25 / tests / simplified / statistics / newFindings / overall）
- 复现脚本：`games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/_probe-runtime.mjs`、`_probe-token.mjs`、`_probe-ledger.mjs`、`_probe-lines.mjs`、`_gen-json.mjs`

> 备注：本复核只读；`games/arkhamhorror` 当前工作树有大量未提交改动，行号以当前快照为准。PowerShell `Get-Content` 对本仓库中文文件会错误合并行，本文行号均以 `read`/Node 的 UTF-8 切分为准。
