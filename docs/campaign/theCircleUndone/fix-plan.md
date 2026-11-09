# 四循环《万象无终》修复步骤（fix-plan）

> 配套 [`full-scan.md`](full-scan.md)（扫描结果与逐条证据）。本文件把 31 条有效 high（按根因去重后 22 条）
> 与 1 条 P0、代表性 medium 收敛成可执行修复步骤：P0 → P1 → P2，每项含「现象/证据 → 根因与修法 → 验收」。
> 口径：先原语后卡牌；条目只读状态、写入走 `ctx.api`；引擎不新增卡号分支；修卡必须同步重建索引并跑
> `cards:check` / `cards:encounter-check` / `test:fast`；行为变化先 `replay-fixtures --baseline` 再 `--compare`。
>
> **状态（2026-11-09）：P0 4 项已全部修复并通过真实引擎回归；P1/P2 仍为待办。** 执行记录见 §0.1。

## 0.1 P0 执行记录（2026-11-09，已完成）

| P0 | 状态 | 修改文件 | 行为变化 |
| --- | --- | --- | --- |
| P0-1 05130 崩溃 | ✅ 已修复 | `src/cards/encounter-entries/theCircleUndone/theSecretName/05130.js`（同型顺带修 `05125.js`） | 候选卡号先 `Set` 去重；`api.choose` 从 `Array.find` 谓词里提出来只调用一次（两个文件都是同一种反模式） |
| P0-2 幽灵面翻面清零线索 | ✅ 已修复 | `content/campaigns/theCircleUndone/card-data.js` | `backFace()` 只在背面卡面**印刷了** `clues` 时才声明线索（不再合成 `0`）；`spectralLocation()` 因此不再向引擎传 `back.clues:0`，翻面保留线索 |
| P0-3 双面地点翻面后分组失效 | ✅ 已修复 | `content/campaigns/theCircleUndone/scenarios/theWagesOfSin/behavior.js` | 新增 `VARIANT_GROUPS`（正面卡号 + `linkedCardCode` 背面卡号）；`placedGroup`/`locationGroupOf`/`isAtAttic` 按归一化后的分组匹配，setup 二选一逻辑不变 |
| P0-4 05201 幕 1 正面反应不生效 | ✅ 已修复 | `content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/behavior.js` | `preScenarioSetup` 在幕 1 为 `05201` 时置 `infiltrationReactionActive:true`（非成员默认路线）；成员路线仍替换为 05200 |

**新增回归**：`tests/tcu-p0-regressions.test.mjs`（4 例，全部走真实引擎 `createGameState` → 真实大厅 hub → 真实 `startScenario` → `legalMoves/applyMove`；修复前 4/4 失败，修复后 4/4 通过），已登记 `tests/node-suite.mjs` 与 `tests/suites.mjs` 快测层。

**附带维护**（行为变化后的账本/守卫）：

- `audit/ability-coverage.json`：`node tools/audit-abilities.mjs --write`（仅 `behaviorLines` 33734→33745；engineCodes/effectsEntries/effectsTopLevelFields/escapeCards 均 0，无上升）。
- `audit/tcu-scenario-acceptance.json`：`npm run audit:tcu:scenarios:write`（仅 `theWagesOfSin`、`forTheGreaterGood` 的 `behavior.js` 文件 hash 更新，无验收语义变化）。
- `tests/architecture-guard.test.mjs`：behavior 行数基线 33734→33745 并记录本轮 P0 理由（新增仍是修复既有章节阻断，不是新章节流程）。
- `tests/node-suite.mjs`、`tests/suites.mjs`：登记新回归用例。

**验收命令与结果（2026-11-09）**：

| 命令 | 结果 |
| --- | --- |
| `node --test tests/tcu-p0-regressions.test.mjs` | ✅ 4/4 |
| `node artifacts/tcu-scan/scripts/repro-secretname-crash.mjs` | ✅ PASS（不再复现崩溃） |
| `node artifacts/tcu-scan/scripts/verify-lead.mjs` | ✅ 翻面后线索保留（4/6/6/4，修复前 0/0/0/0） |
| `node artifacts/tcu-scan/scripts/probe-flow.mjs` | ✅ 9/9 章、campaign.finished、failures=0 |
| `npm run cards:encounter-check` | ✅ exit 0 |
| `npm run cards:check` / `npm run cards:dead-code` | ✅ exit 0 |
| `npm run audit:entries` | ✅ exit 0（R1/R2/R3 无新增） |
| `npm run replay:fixtures` | ✅ 13 局基线指纹一致（TCU 改动不在 golden 覆盖内） |
| `npm run test:tcu` | 1253/1254（唯一失败为既有的 `tests/tcu-migration.test.mjs` scope 账本漂移，见 §P2-1） |
| `npm run test:fast` | 6996/7006；7 条失败均为既有、与本轮无关（EOTE/TDE/TIC 的 P8/P10 账本、UI 中文化、TCU scope） |
| `npm run audit:tcu:all-cards` | ✅ exit 0 |
| `npm run audit:tcu:scenarios` | ✅ exit 0（账本已按 `--write` 更新行为 hash） |
| `npm run baseline:check` | ❌ 失败：`audit/baseline.json` 发布快照本身已过期（门禁记录为 6422 例/快照内已有 5 条失败，当前 7006 例/7 条既有失败），属 §P2-1 的账本重生成范围，本轮未改发布基线以免掩盖其他循环的既有问题 |

**P0 之后仍红的既有门禁**（与 P0 无关，维持 full-scan §4 判定）：`audit:tcu:check`、`audit:tcu:player`、
`audit:tcu:primitives`、`scan:tcu:check`、`scan:tcu:scope:check`、`baseline:check`。

## 0.2 P1 执行进度（2026-11-09，进行中）

已修复并通过回归（修改文件与验收见各 P1 小节；新增真实引擎回归 `tests/tcu-p1-regressions.test.mjs`，
其余断言补在既有章节/玩家卡测试里）：

| P1 | 状态 | 关键修改 |
| --- | --- | --- |
| P1-1 05246 V4 分支 | ✅ | UAD behavior 拆 V3/V4：V4 不再生成秘社新信徒（05246 印刷背面无该句） |
| P1-2 05072 实体重复 | ✅ | 生成前 `api.takeEncounterDiscard(found)`，不再同时留在遭遇弃牌堆 |
| P1-3 05015 不能取消 | ✅ | 条目 `cannotBeCanceledRevelation` + deck-ops 弱点窗口不能取消；05014 resolve 尊重 cannotCancel |
| P1-4 05190/05191 criteria | ✅ | 触发条件（诡计卡牌意志检定）进 criteria；不再空转白扣补给；旧测试断言改向 |
| P1-6 05282 countsAs | ✅ | played 描述子补 `countsAs:'evade'`（不再引发借机攻击） |
| P1-7 05024/05152/05156 | ✅ | 05024 删除多写的 `discardWhenEmpty`；05152 引擎把附属弃置推迟到 assetLeavesPlay 窗口后 + 返回时标记/清空；05156 只在 betweenActions 窗口提供（不再在神话/敌人/技能检定窗口） |
| P1-8 05002/05009 牌库底 | ✅ | `hunch-deck.moveInsightToHunchBottom` 改 `unshift`（底=数组头，顶=pop） |
| P1-9 spawnPrinted 数值 | ✅ | UAD `spawnPrinted` 传 victory/healthPerInvestigator；安妮特 4×人数生命、胜利 2 |
| P1-10 05095 入场毁灭 | ✅ | `enemies.enterExistingEnemy` 的 doomOnSpawn 兜底先问 `canPlaceDoomOn`（05085b 拦截生效） |
| P1-11 标记含义接线 | ✅（05045 见备注） | setup 把 `behavior.tokenMeanings` 并进 `state.scenario`；序章新增 `PROLOGUE_TOKEN_MEANINGS`；05050 的声明现真正被 AI/符号结算读到 |
| P1-16 05311 flags | ✅（ICC 结构性重构未做） | 条目改 `flags.breachOnEnter`，章节 entryFlags 读点生效 |

05045 备注：序章幕 1a 没有可推进目标（印刷「在你不可避免的末日来临之前」），幕 1b 的
「记录你被追捕 / 翻回 1a」在真实流程不可达；`youAreBeingHunted` 另有写点（`encounter-rules.watcherHuntedSeats`
在序章结算时写入），因此 manifest 的 `recordWrites` 仍成立。保留 05045 的 `actRule.onReveal` 为不可达声明，
在条目注释与本章 notes 标注「序章不推进幕」；后续若补「末日触发」规则需一并接线。

**待办（下一轮）**：P1-5 05230 目标枚举（需引擎附属扩展原语）；P1-12 九章真实引擎冒烟；
P1-13 观察投影与前端；P1-14 R1/死声明清理；P1-15 05103 怨灵生命周期 + 05104 投入费用时机；
P1-16 ICC 卡号表重构。上述各项的执行结果见 §0.3 / §0.4（P1-5/12/13/15 已完成，P1-14/P1-16 余结构性存量）。

### 0.3 P1 第二轮进度（2026-11-09，剩余结构性项）

本轮又完成 5 组；新增回归 `tests/tcu-chapters-smoke.test.mjs`（9 章真实引擎冒烟）：

| P1 | 状态 | 关键修改 |
| --- | --- | --- |
| P1-5 05230 目标候选 | ✅ | 新增引擎原语读点：条目 `hostAttackConnecting` + `moves.js hostAttackExtensionEnemies`（无本地敌人时枚举连接地点非精英目标，validateMove 放行），反应窗口完成改指/忽略冷漠反击；真实引擎用例（本地无敌人→攻击→改指冷漠敌人命中） |
| P1-12 九章真实引擎冒烟 | ✅ | `tests/tcu-chapters-smoke.test.mjs`：真实 hub→逐章转场→逐章 setup 不变量 + 连续 12 个真实合法动作无异常，9/9 通过 |
| P1-13 观察投影与前端 | ✅ | `campaign-view.js` 增：actBreaches、beforeTheBlackThrone(azathothDoom/referenceResources/devoured)、fourKeys、agendaAside、hauntedGrants；`observation.js` 公开 `spellOnlyActions`；`web/tcu-ui.js` 战役面板渲染全部新行 + en/zh 文案；投影/模型测试 |
| P1-15 05104 | ✅ | 引擎把 `beforeCommitCard` 从「询问投入之前」移到「确实投入第一张牌之后」；真实引擎用例（不投入不结算、投入 1 张结算一次） |
| P1-15 05103 | ✅ 按印刷裁决不改为清理 | 卡面未写「生成后取下附属/移除授予」；每只怨灵各自附属一条「闹鬼-生成怨灵」是多只同名时按条结算的印刷行为（雪球是设计）。保留实现，并在条目注释说明「非缺陷」；不再按 high 处理 |
| P1-14 死声明 | ✅ 首批 | 删除 7 张 `threatArea` 死声明、05062 两个跨地点投入死字段、05064 `redirectSpawnHere`、05053 `actRule.chapterFlow`（definition 已携带）、05178b/d/f/h/j/l `flags.storyRule`；05054 改 `api.setScenarioFlag` 且 behavior 新增 `frontsUnlocked` 读点；05055b 删除无读点的 `anetteSpawned`。**复核纠正**：05093/05094/05181 的 `threatAction.rule` 与 05178j/l 的分派值并非死声明——`threatActionByRule(move.rule)` / `threatRule(...).immediate` 是真实读点，已恢复并记录 |
| P1-14 R1 | 🟡 首批（基线 164→162） | 05045 改 `api.setCampaignRecord`；05054 改 `api.setScenarioFlag`；`audit/card-entry-compliance.json` 已收紧 |
| P1-16 ICC | 🟡 守卫冻结 | 架构守卫新增「内容层卡号表形态」统计（仅 behavior.js，基线 121 冻结，只减不增）；ICC 的 22 个卡号表 key 由此纳入机械监控；逐卡迁回 encounter-entries 的规则重构仍待办（见 §P2 结构性债务） |

**剩余结构性待办（P1-14/P1-16 的存量部分）**：
- R1 直写：本轮已再清理 23 个 TCU 条目（基线 164→139，TCU 存量 51→26）。剩余 26 个见 §0.4 队列；
  按「同字段已有原语优先」分批上收，`audit:entries:write` 只减不增。
- ICC 结构性：`inTheClutchesOfChaos/behavior.js` 的 `LOCATION_HANDLERS`（12 地点）/`TREACHERY_RESOLVERS`（3 诡计）仍是卡号表分派；迁回单卡条目需先补「地点规则条目化 + 运行时 api 化」原语，属 P2 结构性迁移，迁移前由架构守卫基线冻结。

本轮门禁：`test:tcu` **1276/1277**（唯一失败仍为既有 scope 漂移）；`test:fast` 7020/7030（7 条失败均为既有无关项）；`cards:check`/`cards:encounter-check`/`audit:entries`/`audit:tcu:all-cards`/`audit:tcu:scenarios` 均 exit 0；
replay 基线 13 局指纹一致；`audit/tcu-all-card-acceptance.json`、`audit/tcu-scenario-acceptance.json`、
`audit/ability-coverage.json`、`audit/card-entry-compliance.json` 已按生成器重新生成。

### 0.4 P1 第三轮进度（2026-11-09，R1 区域原语收口）

**新增区域原语（唯一写点仍在 `src/engine/scenario-runtime.js`；`api-misc.js` 只把同一实例挂到能力面）**：

| 区域 | 新 api（条目可用） |
| --- | --- |
| 遭遇牌库/弃牌堆 | `encounterDeckCards` / `encounterDiscardCards` / `discardEncounterCards` / `putOnEncounterDeck` / `discardEncounterTop` / `takeEncounterDeckCard` / `takeEncounterDiscard` / `takeEncounterCard` / `takeEncounterDeckBottom` / `rebuildEncounterDeckFromDiscard` |
| 额外遭遇牌堆（幽灵界） | `extraDeckInfo` / `discardExtra` / `discardExtraCards` / `takeExtraDiscard` / `addExtra` / `drawExtra` |
| 密谋牌库旁 | `putNextToAgenda` / `agendaAsideCards` / `discardAgendaAside` / `removeAgendaAside` |
| 玩家区域 | `putInHand` / `putInDiscard` / `takeDiscardCard` / `putOnTopOfDeck` / `putOnDeckBottom` / `takeDeckBottom` / `takeDeckCard` / `removeFromGameCards` |
| 线索/资源 | `spendClues` / `loseClues` / `gainClues` / `addCluesToLocation` / `removeLocationClues`（能力面补齐） |
| 其他 | `takeFromSetAside` / `spawnEngaged` / `setEnemyPreySeat` / `readyEnemy` / `exhaustEnemy` |

**统一「密谋牌库旁」表示**：`state.agendaAside`（`api.putNextToAgenda` 写入）成为唯一表示；
`content/.../encounter-rules.js` 的 `agendaAside/placeAgendaAside/removeAgendaAside` 读写统一区并兼容旧存档
（旧 `scenarioZones.agendaAside` 读入后删除），`roundEnded` 的 05102 轮末清理改读统一区；
`src/cards/campaign-view.js` 投影优先读统一区。条目不再直写 `scenarioZones`。

**R1 本轮清理 23 个 TCU 条目（基线 164→139，TCU 51→26）**：
05051/05057/05061/05089/05090/05099/05102/05107/05116（遭遇区/额外牌堆/密谋旁）、
05010/05012/05037/05047/05058/05060/05130/05132/05134/05136/05259/05275/05339/05340（线索
·资源·手牌·移除区·场景标记）。
新增钩子级测试替身 `tests/tcu-zone-api.mjs`（与引擎同名同语义的区域 API），章节/玩家卡测试统一
`{ ...zoneApi(state), ...apiStub }` 合并，避免测试只验证旧直写路径。

**剩余 R1 队列（26 个 TCU 条目，下一轮继续）**：
`05004`（beneath→手牌，需 beneath 出区原语）、`05015`（beneath/弃牌清理）、`05045`（fallback 直写，可达性注记已留）、
`05059/05091/05097/05103/05113/05121/05122/05123/05126/05129/05133/05137/05138/05139/05141/05143/05144/05188/05195/05196/05236/05336`
（多数为敌人实例字段/自定义标记/牌库搜索——需按字段补通用实例标记或区域原语，逐条裁决）。
剩余项已由 `audit/card-entry-compliance.json` 基线冻结，只减不增。

**P1-16**：ICC 卡号表守卫冻结维持；逐卡迁移仍需「地点规则条目化」原语批次（P2 结构性迁移）。

本轮门禁：`test:tcu` **1276/1277**（唯一失败为既有 scope 漂移）；`test:fast` 结果见收尾记录；
`cards:check`/`cards:encounter-check`/`audit:entries`/`audit:tcu:all-cards`/`audit:tcu:scenarios` exit 0；
replay 基线指纹一致；`audit:entries:write` 后 R1 基线 directStateWrite 139（TCU 26）。

### 0.5 P1 第四轮进度（2026-11-09，R1 清零）

**R1 收尾：剩余 26 个 TCU 条目全部上收 → TCU R1 直写 = 0**（总基线 139→113，TCU 51→0）。
清理清单：05004/05015/05045/05059/05086/05091/05097/05103/05113/05121/05122/05123/05126/05129/
05133/05137/05138/05139/05141/05143/05144/05188/05195/05196/05236/05336。

**本轮新增/补齐的原语（唯一写点仍在引擎；`api-misc.js` 只把同一实例挂到能力面）**：

| 类别 | 新 api |
| --- | --- |
| beneath（压在卡下） | `beneathCards` / `takeBeneathCard(seat, code, {to:'hand'|'discard'})`（05004/05015） |
| 敌人实例字段 | `setEnemyDamageTaken` / `putEnemyInPlay` / `preventEnemyReady` / `disengageEnemy` / `setEnemyRoundFightEvadeBonus` / `setEnemyAside` / `restoreEnemyFromAside` / `removeEnemyFromGame` / `doomOn` / `removeDoomFromCard` / `removeDoom`（05086/05091/05097/05113/05123/05141/05144） |
| 地点/连接/附属 | `connectLocations` / `locationAttachments` / `attachEncounterToLocation`（05103/05133） |
| 战役记录 | `campaignRecord` / `setCampaignRecord`（05045/05134） |
| 放逐 | `exileCard`（05196/05236；统一走引擎 `exilePlayerCard` 记账） |
| 检定投入 | `addCommittedExtraIcons`（05195） |
| 遭遇区补充 | `takeEncounterCard` / `takeFromSetAside` / `shuffleIntoEncounterDeck` 已在上一轮，登记在本轮章节 helper 收口里（05121/05122/05126/05129/05143/05144） |

**顺带修复的能力面缺口（真实 bug，非仅合规）**：`api.doomOn`、`api.setCampaignRecord`/`api.campaignRecord`
此前只存在于 `scenario-runtime`，能力面从未挂载——EOTE/TIC/TCU 多张卡调用它们是静默 no-op
（毁灭标记不放置、战役记录不写入）。本轮在 `api-misc.js` 补别名，TCU 侧 05045/05097/05122/05123/05126/05144
与 05134 的记录/毁灭实际生效；跨循环同类卡（08702/08709/07296/07056/03144 及 DE §06040/06208/06127b/06145/06066 等）
因同一入口补齐而一并修复，下一轮会补跨循环回归。

**测试替身**：`tests/tcu-zone-api.mjs` 增补本轮全部新方法（同一语义），章节测试统一合并；
`tests/tcu-prologue.test.mjs` 的 `runtimeApi` 补 `campaignRecord/setCampaignRecord`。

本轮门禁：`test:tcu` **1276/1277**（唯一失败为既有 scope 漂移）；`test:fast` **7020/7030**（7 条失败均为既有无关项）；
`cards:check`/`cards:encounter-check`/`audit:entries`/`audit:tcu:all-cards`/`audit:tcu:scenarios` exit 0；
replay 基线指纹一致；`audit:entries:write` 后 R1 基线 directStateWrite **113**，TCU **0**。

**剩余（下一轮起）**：
- 跨循环回归（可选加固）：为 `api.doomOn` / `api.setCampaignRecord` 的能力面补齐补一条跨循环测试
  （EOTE 08702/08709、TIC 07296/07056/03144、DE 06040/06208/06127b/06145/06066），确认实际写点生效。
- 之后回到 P2（账本基线、i18n、复用/重印、原语队列 21 项）。

### 0.6 P1 第五轮进度（2026-11-09，P1-16 ICC 结构性迁移完成 → P1 全部 16 组收口）

**16 个 ICC 地点规则迁回单卡条目**：`encounter-entries/.../inTheClutchesOfChaos/05290–05305.js` 由空壳
变为带 `locationRule.actions / performAction` 的条目（弃手牌/支援、技能检定移裂口、遭遇牌库弃顶、
支付资源、查找敌人、撤退等 16 条规则；规则字符串保持原值，章节测试无须改 move 断言）。
章节 `behavior.actions / performAction` 改为 `locationRuleFor(卡号)` 通用分派，删除 `LOCATION_HANDLERS`
表与只为它服务的 helper（`withBreach/discardIconsBreach/skillTestBreach/drawEnemyByTrait` 等）。

**5 张 ICC 诡计去掉卡号表**：`TREACHERY_RESOLVERS`（卡号键）改为条目声明
`treacheryRule: { resolveRule: '<通用 id>' }` + `behavior` 内按通用 rule id 的 `TREACHERY_RULES` 表
（chaosManifest / primordialGateway / terrorUnleashed / secretsOfTheBeyond / toilAndTrouble）。
裂口级联/入侵结算仍留在章节规则（场景语义，不属于单卡），但分派不再按卡号字面量。

**新增场景运行时原语**（条目可经 api 调用，唯一写点仍在引擎）：
`moveBreachesToAct`（地点裂口 → 当前幕）、`discardOneFromHand`（选择并弃手牌）、
`discardOneAsset`（选择并弃支援，走 leaveAsset）、`randomLocationIds`（无放回随机地点采样）、
`drawEncounterByTrait`（查找指定特性遭遇敌人并抽取）。

**守卫/账本基线收紧**：`behavior.js` 1191 → 893 行；架构守卫
`CONTENT_CARD_TABLE_BASELINE` 121 → **100**、`BUDGET`（behavior.js 总行数）33773 → **33475**、
`CONTENT_CARD_CODE_BASELINE` 1142 → **1110**（迁移后的只减不增口径）；`audit/ability-coverage.json`
重算 behaviorLines=33475。

**验证**：`tests/tcu-clutches-chaos.test.mjs` **48/48**（地点/诡计/网关/撤离/变体全覆盖）；
`test:tcu` **1276/1277**（唯一失败为既有 scope 漂移）；`test:fast` **7020/7030**（7 条均为既有无关项，
无新增失败）；`cards:check`/`cards:encounter-check`/`audit:entries`/`audit:tcu:all-cards`/
`audit:tcu:scenarios` exit 0；replay 基线指纹一致；TCU 账本与全卡账本已按生成器重生成。

**结论**：P1 的 16 组问题（含 P1-14 R1 直写清零、P1-16 ICC 卡号表结构性迁移）全部完成，
每组均有回归测试与门禁证据（P0 另见 §0.1）。后续只剩 P2 结构性/体验项（发布账本基线、i18n、
复用/重印、原语队列 21 项）与 §0.5 记录的可选跨循环加固测试。

## 0. 总门禁与工作方式

- 单卡修改流程：`node tools/scaffold-card.mjs <code> --entry`（玩家卡）/ `--encounter`（非玩家卡）→ 改单卡文件
  → 重建索引 → `npm run cards:check`（玩家）或 `cards:encounter-check`（非玩家）→ `npm run test:fast`
  → `node tools/audit-abilities.mjs --write`（行为变化另跑 replay baseline/compare）。
- 引擎/内容层修改：先补/改原语并补测试，再改内容；禁止按卡号/关卡名在引擎加分支。
- 账本更新：每次修完行为后按 §P2 重新生成对应账本，禁止手改冻结文件；`audit/card-entry-compliance.json`
  只能通过 `audit:entries:write` 收紧。
- 建议新增一条 TCU 全量真实引擎冒烟用例（见 P1-12），作为本轮所有修复的公共回归。

## P0（先修：真实路径崩溃 / 章节核心循环断裂）

### P0-1 《隐秘之名》05130「乔的房间」合法行动崩溃（重复选项 id）✅ 已修复 2026-11-09

- **现象**：真实引擎流程中执行 `scenarioAction:joeSearchBlessed` 抛
  `Error: 选择选项 id 重复（card：…）`，事务回滚；两轮流程探针均在第 8–11 步复现。
- **证据**：`src/cards/encounter-entries/theCircleUndone/theSecretName/05130.js:20-34`
  （`candidates = inv.deck.filter(...)` → `options: candidates.map(code => ({ id: code, … }))`；
  牌组含同名卡两张时 option id 重复）；`src/engine/resolution.js:60`（重复 id 校验抛出）；复现脚本
  `artifacts/tcu-scan/scripts/repro-secretname-crash.mjs`。
- **修法**：候选去重 `const candidates = [...new Set(inv.deck.filter(...))]`；或把 option id 改为 `String(index)`
  并用索引映射回卡号；同型排查 `05125.js:31-36`、`05134.js:31`（`api.choose` 放在 `Array.find` 谓词内导致
  重复询问/ChoicePause 反模式）。
- **验收**：`repro-secretname-crash.mjs` 不再抛错；新增真实引擎回归（`createGameState` → 流程到 theSecretName →
  执行该场景行动）断言无异常、检索成功、团队每场一次计数生效；
  `node --test tests/tcu-secret-name.test.mjs tests/tcu-scenario-acceptance.test.mjs`。

### P0-2 《恶罪报应》幽灵面翻面清零全部线索（章节核心循环断裂）✅ 已修复 2026-11-09

- **现象**：05162 幕背「将每个地点翻到其幽灵面」与 05165 的 `[free]` 翻面后，地点线索从 `2/4/4…` 全部变成 0；
  第 2 幕「翻到幽灵面再调查」的线索经济、05177 幽灵迷网、05178a 谈判（花 1 线索）等全部失效。
- **证据**：`content/campaigns/theCircleUndone/card-data.js:78-83`（`backFace()` 对地点 `clues: back.clues ?? 0`）、
  `:134`（`spectralLocation` 写入 0）、`src/engine/locations.js:222-225`（翻面把 `loc.clues` 覆盖为 back.clues）；
  Lead 探针 `artifacts/tcu-scan/scripts/verify-lead.mjs` 复现 `2/4/4 → 0/0/0`。
- **修法**：统一「翻面保留线索」口径（引擎 P2.3 原语注释与测试要求翻面不清线索）：
  ① `backFace()` 不再为地点合成 `clues: 0`（`clues` 缺失 = 未声明，翻面时保留 `loc.clues`，或按背面印刷值覆盖）；
  ② 为本章 b 面数据显式补 `clues` 失败时回退保留；③ 若确需按印刷背面给 0 线索，需在 definition 显式声明并
  在章节规则里说明。补引擎级测试：翻面后 `loc.clues` 不变（有背面 clues 时取背面值）。
- **验收**：`verify-lead.mjs` 输出翻面后线索保持；`tests/tcu-primitives-spectral-location.test.mjs` 扩充断言；
  Wages 章节测试新增「advanceAct → 地点翻转 → 线索保持」真实引擎用例。

### P0-3 《恶罪报应》变体地点翻面后分组匹配失效 ✅ 已修复 2026-11-09

- **现象**：翻面后 05179/05180 的「生成 - 绞刑架/墓地、阁楼/地下室」返回 FALLBACK，05175b 的「抽牌压底 /
  成功调查取回」两条印刷规则不可达，05177 攻击难度与 05175「非弱点」守卫等连带失效。
- **证据**：`content/campaigns/theCircleUndone/scenarios/theWagesOfSin/definition.js:75-80`（`LOCATION_VARIANTS`
  只列正面卡号）、`behavior.js:86-101`（`placedGroup`/`locationGroupOf`/`isAtAttic` 用 `original(loc)`）、
  `src/engine/locations.js:216-219`（翻面把 `originalCode` 换成背面卡号）。
- **修法**：`LOCATION_VARIANTS` 同时登记正/背面卡号（或在 `locationGroupOf` 里用
  `original(loc)` + `ALL_CARDS[original].linkedCardCode` 归一化到正面卡号）；`isAtAttic` 同步。
- **验收**：新增真实引擎探针：advanceAct/agenda → 翻面 → `behavior.spawnLocation('05179')/('05180')`
  返回合法地点；05175b 的 `cardDrawn`/`afterInvestigate` 在翻面后命中；`tests/tcu-wages-of-sin.test.mjs` 补用例。

### P0-4 05201《渗透秘社》幕 1 正面反应不生效 ✅ 已修复 2026-11-09

- **现象**：印刷「[reaction] 在你躲避一个敌人后：移除其所有毁灭」在进入幕 1 正面后不出现；真实
  `startScenario` 后 `scenarioFlags.infiltrationReactionActive === undefined`，只有幕推进（背面 actReveal）后才生效。
- **证据**：`content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/behavior.js:747-757`（唯一置真处）、
  `:964-976`（唯一读取处）；Lead 探针（`startScenario` 后核对 scenarioFlags）。
- **修法**：在 `preScenarioSetup`/`setup` 或幕正面 reveal 路径初始化该 flag（依据幕是否 05201 且未推进）；
  更稳妥：把「当前幕是否 05201 且已揭示」作为数据条件读 `state.acts[state.actIndex]`，不依赖一次性 flag。
- **验收**：真实引擎用例：`startScenario(forTheGreaterGood)` 后执行一次躲避（或直接构造 afterEvade 上下文）
  断言反应窗口出现；推进到幕 2 后仍生效（「直到游戏结束」）。

## P1（规则正确性 / 可感知）

### P1-1 05246 版本四背面串入版本三规则（错误生成秘社新信徒）

- 证据：`unionAndDisillusion/behavior.js:779-793`（`else` 同时覆盖 V3/V4，V4 也 `spawnPrinted(LODGE_NEOPHYTE)`）；
  05246 印刷背面无该句。
- 修法：拆分支为 `code === ACT_BEYOND_V3` / `code === ACT_BEYOND_V4` 两个显式分支；V4 仅保留其印刷效果。
- 验收：`tests/tcu-union-disillusion.test.mjs` 增补 V4 背面用例（断言不生成新信徒、洗回整组）。

### P1-2 05072《维多利亚式宴会厅》弃牌堆敌人生成重复实体

- 证据：`content/campaigns/theCircleUndone/encounter-rules.js:345-347`（弃置即入 encounterDiscard）+
  `atDeathsDoorstep/behavior.js:811-829`（`api.spawn` 新建实例未从弃牌堆取回）。
- 修法：生成前先从 `encounterDiscard` 移除对应卡号（或使用现有「从弃牌堆生成」原语，如无则补
  `api.spawnFromDiscard`）；补测试断言场上/弃牌堆不重复。

### P1-3 05015《可怕的秘密》「不能取消」未实现

- 证据：`src/engine/deck-ops.js:582-593`（弱点抽取窗口不带 cannotCancel、不读条目的
  `cannotBeCanceledRevelation`）；`src/cards/entries/05015.js:8-41` 未声明。
- 修法：弱点抽取窗口上下文补 `cannotCancel`（读条目声明），并在 `reactionWindow` 层拒绝取消；
  05015 条目声明 `cannotBeCanceledRevelation: true`（引擎既有字段，`ability.js:196,1101` 已有读点）。
- 验收：真实引擎用例：05014 黑暗洞察无法取消 05015；普通弱点仍可取消。

### P1-4 05190/05191 触发条件下沉到 resolve（白扣补给/横置）

- 证据：`src/cards/entries/05190.js:21-39`、`05191.js:22-40`；枚举读点 `src/engine/ability-rules.js:205-244`；
  费用先付 `src/engine/reveal.js:228/255`；现有测试 `tests/tcu-player-m2-3.test.mjs:249-267,302-323` 锁定错误行为。
- 修法：把「本次检定是诡计卡牌 && 使用意志」提为 `criteria`（`ability-rules.js` 提供的 helper 已足够），
  条件不成立时不出现在 legalMoves、不扣费；同步修正测试断言方向。

### P1-5 05230《瞄准镜》主场景不可达

- 证据：`src/cards/entries/05230.js:34-45`（criteria 允许连接地点目标）+ `src/engine/moves.js:505-518`
  （宿主枪械攻击行动只在本地有敌人时枚举）+ `:181-188`（改指只认手牌 04104 不认附属卡）。
- 修法：为「附属在武器上的改指」补通用读点（如 `assetRule.attackTargets` 或 modifiers 的 `targetRange`），
  或在 `moves.js` 的武器攻击枚举中允许 `target` 候选扩展到连接地点（受卡片声明约束），不写卡号分支。
- 验收：真实引擎用例：接好瞄准镜、本地无敌人、连接地点有非精英敌人 → legalMoves 出现该攻击并能结算。

### P1-6 05282《偷梁换柱》缺 `countsAs:'evade'`

- 证据：`src/cards/entries/05282.js:28-30`；读点 `src/engine/table-decisions.js:296-316`、
  `src/engine/dispatch.js:331-334`；正例对照 `src/cards/entries/05234.js:79-83`。
- 修法：`played` 描述子补 `countsAs: 'evade'`（或事件 DSL 的等价字段）；补 AoO 回归测试。

### P1-7 05024 / 05152 / 05156（玩家卡行为偏差）

- 05024 `discardWhenEmpty:false`（卡面无弃置句；删字段或改为不弃置），对照 `01087` 手电筒；
- 05152 修「返回手牌的附属残留弃牌堆」：`putInHand` 前先从 discard 移除（或使用统一的 move 原语），
  清空宿主 attachments 避免同窗口重复询问，`playCondition` 用 `ownTurn` 而非只查 `currentSeat`；
- 05156 把 `betweenActionsAnyTurn` 收窄为卡面允许的窗口（任一玩家回合但不含行动期间/检定中），
  执行时不得把 phase 强改为 investigation。
- 验收：各自真实引擎用例（05024 三次用尽后仍留场；05152 手牌/弃牌堆不重复；05156 在神话/检定窗口不可用）。

### P1-8 05002/05009「直觉牌库底」放成牌库顶

- 证据：`src/engine/hunch-deck.js:198-207`（`moveInsightToHunchBottom` 用 `push`，而揭示用 `:157` `pop`
  → 放到了顶）；测试 `tests/tcu-investigators.test.mjs:389` 断言了错误方向。
- 修法：`inv.hunchDeck.unshift(code)`（或明确「底=数组头」并在揭示/洗回统一）；修正测试断言。
- 验收：真实引擎用例：旧印把弃牌堆洞察放到底后，下一次揭示的仍是原牌库顶。

### P1-9 `spawnPrinted` 丢 `victory`/`healthPerInvestigator`（05243/05245/05246 等）

- 证据：`unionAndDisillusion/behavior.js:1126-1143` → 引擎 `src/engine/turn-flow.js:146-158`（未传字段）；
  安妮特·梅森丢「4[每调查员]生命」与 2 胜利；约瑟夫丢 2 胜利。
- 修法：`spawnPrinted` 透传 `victory`/`healthPerInvestigator`/`traits` 等印刷字段（或改走 `api.spawnEnemy` 的
  完整卡面数据通道）；补数值断言测试。

### P1-10 05095 入场毁灭绕过 05085b 的 `canPlaceDoomOn`

- 证据：`src/engine/enemies.js:563-577`（`enemySpawned` 后无条件补 doom）；`atDeathsDoorstep/behavior.js:673-680`
  （`canPlaceDoomOn` 返回 false 被无视）；对照 05096 走 `doomAtMythosEnd`→`placeDoomOnCard` 正确。
- 修法：`enemies.js` 的 spawn 补 doom 兜底前询问 `canPlaceDoomOn`（与 `act-agenda.js:467-476` 同口径）；
  补测试：05085b 生效后生成 05095 不加 doom、不推议程。

### P1-11 记录/标记接线（05045 / 05043 / 05050）

- 05045 幕 1b 不可达但 manifest 仍声明 `recordWrites: ['youAreBeingHunted']`：要么补真实触发路径（参考实现
  自述该 1b 不可触发，需按规则书裁决），要么从 manifest 删除声明并在迁移账本登记近似；
- 05043/05050 的混乱标记含义未接入 `state.scenario.tokenMeanings`（AI/引擎按默认值算概率）：
  把 `WITCHING_HOUR_TOKEN_MEANINGS`/序章含义写入 scenario 数据（`behavior.js:547` 的声明无读点）；
- 序章结局证据「累加 vs 覆盖」口径按参考实现 `recordCount` 裁决，并统一 atDeathsDoorstep 的读取。

### P1-12 章节真实引擎冒烟测试（D3 证据补强）

- 现状：9 章验收测试中 8 章为合成 state + api stub，真实引擎文件仅 6/41；本轮发现的 Wages 翻面清零线索、
  theSecretName 崩溃均未被测试捕获。
- 做法：为每章新增至少 1 条 `createGameState → startScenario → 若干 legalMoves/applyMove` 的真实引擎冒烟，
  断言：setup 关键不变量（地点数/shroud/clues/幕议程阈值/遭遇牌库/混乱袋）、连续 N 步无异常、
  章节测试声明的核心行动（如 05130 场景行动、05162 翻面、05201 反应）可执行。
- 验收：9/9 章冒烟进入 CI fast/slow tier 且纳入 `audit-tcu-scenarios` 的证据源（替换 stub 证据）。

### P1-13 观察投影与前端承载（D2）

- 05325 `azathothDoom`：加入 `PUBLIC_SCENARIO_FLAGS`（或内容层专用投影 `campaignProjection`），并在
  `web/tcu-ui.js` 显示毁灭计数与吞食阈值；
- 05325 `referenceResources`：同上，显示参考卡资源与五张地点的代价能力可用性；
- 05203 `scenarioKeys`：内容层投影（钥匙归属）并在牌桌战役面板渲染「四把钥匙」目标进度；
- 05284 幕上裂口：投影 `acts[].breaches` 并在幕卡/牌桌显示；同时统一走引擎 `api.addActBreach/removeActBreach`
  原语（现 behavior 自建容器）；
- 05089/05102/05107「密谋牌库旁」：改用 `api.putNextToAgenda`，投影 `state.agendaAside`，补前端区域；
- 05006 `spellOnlyActions` 等受限行动：观察投影补字段并在动作面板显示「可用但受限」原因；
- 05114/05118/05157 冷漠敌人死按钮：`targets.js` 的 enemy 目标与 `moves.js` 的合法攻击口径对齐（过滤 aloof）。

### P1-14 原语缺口与 R1/死声明清理

- 原语缺口：`skillTest.autoSuccess` 无写入口（影响 05093/05094/05105/05146 的「自动成功」）；
  「弃遭遇牌库顶」3 份实现收敛（含幽灵牌堆识别）；「从弃牌堆生成敌人」缺原语（P1-2）；
  「附属武器改指连接地点」（P1-5）；「怨灵类附属的生成/清理生命周期」缺原语（P1-15）。
- R1 清理：51 张直写条目按「同字段已有原语」优先（`state.encounterDeck/encounterDiscard`、
  `enemy.preventReady/damageTaken/exhausted`、`inv.hand/discard/clues`、`state.removedFromGame`、
  `state.scenarioFlags` 等），逐批把写入改为 `ctx.api`；同时给合规审计工具补索引式直写
  （`state.investigators[seat].x.push`）与 `source.attachments` 规则。
- 死声明接线或删除：`threatArea`(7)、`allowsCrossWoodsCommit`/`crossWoodsCommitIcons`、
  `redirectSpawnHere`、`flags.storyRule`(6)、`05053 actRule.chapterFlow`、`05054 frontsUnlocked`、
  `05055b anetteSpawned`、`05103/05311` 的顶层声明、分派值
  `unfinishedBusinessImmediate/discardPunishment/discardWracked/discardBedeviled`。
  能删则删（保留 behavior 实际读点），不能删的补真实读点并登记测试，禁止「声明即完成」。

### P1-15 05103 怨灵生命周期 / 05104 投入费用时机

- **05103**：`_shared/trapped_spirits/05103.js:61-77` 每次「非法术/遗物伤害击败」都向 `location.attachments`
  追加 `wraith:<enemyId>` 并新增 `05103:haunt:<enemyId>` 授予，`haunted.js:331-333` 生成全新实例，全仓没有
  「生成后取下附属/清理授予」的代码 → 每次闹鬼结算都额外生成怨灵、授予随击败次数累积（滚雪球）。
  修法：在闹鬼结算消费该授予后调用 `clearHaunted`/移除对应 attachments（或补 `api.consumeHauntedGrant`
  原语），授予 id 按地点去重；补真实引擎用例（击败两次 → 闹鬼只生成 1 只/次且授予不累积）。
- **05104**：`src/engine/tests.js:360-373` 在每个 owner 的提交循环开头无条件调 `behavior.beforeCommitCard`，
  `:438-449` 之后才询问「投入/开始检定/放弃协助」→ 投入 0 张、放弃协助的调查员也被强制结算闹鬼
  （`05104.js:26-40`、`encounter-rules.js:450-460` 只按 paidSeats 去重）。修法：把 beforeCommitCard 费用钩子
  移到玩家确认投入之后（或把钩子改为「投入时结算」回调）；补测试：放弃协助不结算、投入 0 张不结算。

### P1-16 05311 声明错位 + ICC 章节卡号表

- **05311**：条目顶层 `breachOnEnter: 1`（`inTheClutchesOfChaos/05311.js:11`），章节读
  `entryFlags(...)?.breachOnEnter`（`behavior.js:1070,1077`），`entryFlags` 只返回 `entry.flags`
  （`src/cards/card-rules.js:258-260`），注册期也不搬运（`ability.js:192-193`）→ 强制句永不执行。
  修法：二选一——条目改 `flags: { breachOnEnter: 1 }`，或 behavior 改读顶层字段；同时全量排查 TCU
  条目「顶层声明 vs flags 读取」错位（本轮机械扫描已列出同类候选）。
- **ICC 结构性**：`inTheClutchesOfChaos/behavior.js` 的 `LOCATION_HANDLERS`(515-746)/`TREACHERY_RESOLVERS`(438-444)
  等以卡号表实现 12 地点+3 诡计规则，单卡条目为空壳；架构守卫正则（`tests/architecture-guard.test.mjs:347-353`）
  只认 `code/originalCode === '0xxxx'`，实测 ICC behavior.js 命中 0、`CONTENT_BRANCH_BASELINE=0` 仍通过。
  修法：把规则按卡拆回单卡条目（优先复用原语）或至少把卡号表收敛为数据表 + 通用分派；扩展架构守卫识别
  「卡号表/字面量数组」形态，避免漏检。

## P2（账本 / 复用 / i18n / 文档）

### P2-1 冻结账本重新生成与人工审阅

- `node tools/scan-tcu-scope.mjs --write`（cards-data sha 已变，重建后审阅 diff）；
- `node tools/scan-tcu-mechanisms.mjs --write`；`node tools/audit-tcu-primitives.mjs --write`；
- `npm run audit:tcu`（`audit/tcu-migration.json`）→ 逐字段审阅 `earlyAccess/equivalenceCertified/evidence/
  remaining/releaseAcceptance/gate` 是否仍如实；`node tools/audit-tcu-player.mjs --write`；
- 证据哈希同步：`node tools/rehash-acceptance.mjs --write`（若对应证据文件变了）；
- 验收：`npm run audit:tcu:check && npm run audit:tcu:player && npm run audit:tcu:primitives &&
  npm run scan:tcu:check && npm run scan:tcu:scope:check` 全 exit 0，且 diff 已人工审阅（不为了过门禁放宽判定）。

### P2-2 逐卡账本去假绿

- `audit/tcu-card-behavior-audit.json` 重新逐卡生成：clause 必须逐字来自印刷文本（当前 163/377 张卡的 clause
  与卡面不能逐字对上，多为摘要改写）；修正 48 条不可追溯证据（行号过期 15、被截断路径 15 等）；
  按本轮 findings 重判 377 条 verdict（不再允许 377/377 match 的「全绿」口径）；
- `audit/tcu-all-card-acceptance.json` 的 evidence 映射改为「真实引擎/测试文件 + 卡号可追溯」，
  否则 30 张无字面引用的卡继续保持文件级证据并备注。

### P2-3 复用上收（D5）

- 4 组同文卡共享实现：6 张异端者（05178a/c/e/g/i/k）抽 `HERETIC_FACES` 工厂条目（或共享 `_shared.js` 规则），
  05204/05205、05244/05245/05246、05286a/05288a 各抽共享实现；
- 05269/05270「加入任意调查员威胁区」、05277/05234/05322「连接内地点」、05093/05094「自动成功」收敛为原语/工厂；
- 验收：条目行数下降但行为测试全绿；`cards.encounter-check` + `test:fast` 通过。

### P2-4 重印别名补登记

- `src/cards/entries/_reprint-aliases.js` 登记 `05001→98010`、`05006→99001`、`05024→12031`、`05114→12077`
  （以及排查是否还有 `duplicatedBy` 未登记的 TCU 卡）；保证重印号走身份别名、不双实现；
- 验收：`card-identity` 探针 `registeredEntry('98010')` 等返回别名条目；合规审计 R2 为 0。

### P2-5 动态文案 i18n

- 146 个条目文件 / 423 处 `label/prompt/info` 中文硬编码（章节内 247 处）改为 i18n key（`web/i18n.js` 的
  `t()`），en locale 已有 `tcu.*` 键空间可扩展；优先玩家高频决策文案（待决选择、场景行动、幕/议程提示）。
- 验收：en 语言下章节内动态文案无中文残留（可加机械断言脚本）。

### P2-6 文档与状态同步

- 本目录 `README.md` 的「扫描产物」状态已更新；`ARCHITECTURE.md` §1 对 TCU 的描述（equivalenceCertified/
  earlyAccess）应按 P2-1 重生成后的真实账本修正；
- 各章 `notes.js`/`behavior.js` 顶部自述里的近似/未实现说明，与本报告不一致处按裁决更新。

### P2-7 隐藏信息与投影复核（低优先）

- 对「隐藏摆放」类地点的 id 泄漏疑点做一次专门复核（对抗复核未确认可利用路径，暂不计缺陷）；
- 复核 05346 三字段（`immuneToPlayerCards/omnipotent/spawnAt`）为「已登记近似的说明性声明」还是应删除，
  避免「声明即完成」的歧义（escape 已登记在 `artifacts/migration/tcu/primitive-plan.json`）。

## 修复顺序与依赖

```text
P0-1（崩溃，独立）
P0-2 → P0-3（同章、同根因域：翻面数据口径）
P0-4（独立）
P1-1/P1-2/P1-3/P1-4/P1-5/P1-6（各自独立，可并行）
P1-7/P1-8（玩家卡，互不依赖）
P1-9 → P1-1（spawn 数值与 V4 分支同章）
P1-10（引擎 spawn 兜底，建议先于 P1-9 合并）
P1-11/P1-12/P1-13（内容接线、测试补强、投影，可并行）
P1-14（原语/合规清理，建议在 P0/P1 内容修复后统一收紧基线）
P1-15（怨灵生命周期 + 投入费用时机，独立）
P1-16（05311/ICC 卡号表；先补真实读点再谈上收，可与 P1-14 合并验收）
P2-1 → P2-2（账本重生成后去假绿）
P2-3/P2-4/P2-5/P2-6（可并行，P2-7 低优先）
```

## 完成定义（DoD）

1. P0 全绿：P0-1 复现脚本无异常；P0-2/P0-3 的《恶罪报应》真实引擎用例通过；P0-4 反应在幕 1 可用。
2. P1 行为修复均有真实引擎回归；`npm run test:fast` 无新增失败；replay fixtures 对比行为零漂移（有意的修复
   需重采基线并在 PR 说明）。
3. 9 章真实引擎冒烟进入测试套件，且 `audit/tcu-scenarios` 证据源不再只依赖 stub 测试。
4. 账本门禁 5 项全 exit 0，逐卡账本不再 377/377「全绿」，证据可追溯率 ≥ 99%。
5. 4 组同文卡上收、4 条重印别名登记、动态文案 en 无中文残留；文档与真实账本状态一致。

## 附：证据索引

- 扫描结果与逐条 file:line：[`full-scan.md`](full-scan.md)
- 逐卡 findings 原始 JSON：`G:/boardgame-hall-ai/artifacts/tcu-scan/findings/*.json`
- 汇总/机械账本：`G:/boardgame-hall-ai/artifacts/tcu-scan/data/{findings-summary,mechanical-summary,report-assets}.json|md`
- 复现脚本：`artifacts/tcu-scan/scripts/{probe-flow,repro-secretname-crash,verify-lead,probe-view,extract,screen,build-shards}.mjs`
