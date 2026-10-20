# Phase 5 · 迁移（交付说明与批次证据）

> 日期：2026-02。上游决策文档：[`architecture-refactor-roadmap.md`](architecture-refactor-roadmap.md) §6 Phase 5、
> §7 迁移判据与纪律、§8 守卫与工具。本文只记录 **Phase 5 实际交付了什么、怎么验收、还剩什么**，
> 不重复路线里的规矩。
> 接手请先读 [`phase5-handoff.md`](phase5-handoff.md)（现状 / 验收命令 / 下一步 / 已知坑）。
>
> 一句话结论：**迁移工具链已交付，337 张卡迁完（`EFFECTS` 385 → 57、legacy 286 → 51、descriptor 75 → 404、
> **逃生卡 93 → 0（5c 完成）**、**5b 遗留清零**、引擎卡号 166 → 101），批次累计 59 个**；5b 尾部（剩余 reactions / 非 stats 被动）、
> 5c 与 5b 均已完成，只剩 5a 的引擎卡号分支（101 个码：`condition` 25 / `block` 48 / `reference` 28）——清单见 §6。

---

## 1. 交付清单

| 类别 | 产物 | 作用 |
| --- | --- | --- |
| 迁移工具 | `tools/migrate-card.mjs` | 判定「哪些槽位能机械搬」→ 生成描述子草稿 → 删旧条目 → 登记卡包；`--list/--plan/--write/--verify/--rebuild/--report` |
| 测试骨架 | `tools/scaffold-card.mjs` | 按批次生成 `develop/scaffolds/<code>.test.mjs`（通道断言 + 读点断言 + 行为起手式），默认是绿的 |
| 批次编排 | `tools/cards-migrate.mjs` | 一次跑完「迁卡 → 账本/白名单收缩 → replay 对比 → 架构守卫 → 产物自检」 |
| 验收账本重算 | `tools/rehash-acceptance.mjs` | 只重算 core/carcosa 两份验收账本里「证据测试文件」的 sha256（证据映射不变） |
| 迁移目标文件 | `src/cards/ability-migration-batches.js` | 按批次分组的生成描述子（标记块 `// >>> batch: <名>`），由 `CARD_ABILITY_ENTRIES` 一并注册 |
| 批次账本 | `audit/migration-batches.json` | 每个批次的卡号清单；`manual` 里是手写批次（5b-6 / 5c） |
| 用例 | `tests/migration-tools.test.mjs` | 账本/读点/工具纯函数/批次文件格式（8 条） |
| 用例 | `tests/phase5-migration.test.mjs` | 5c 改写后的行为（地点附属、连抽遭遇、牌库检索、捷径、调查/躲避、武器、治疗、5c-18 的五个新 api）（72 条） |
| 用例 | `tests/architecture-guard.test.mjs` | 9 条冻结守卫，含 5a-1 新增的「引擎里没有已无数据引用的旧原语分支」 |
| npm 脚本 | `cards:migrate` / `cards:migrate:list` / `cards:scaffold` | 见 `package.json` |

工具链的固定流程（对应路线 §8）：

```
node tools/scaffold-card.mjs --batch 5b-1          # 需要行为骨架时
node tools/cards-migrate.mjs --batch 5b-1 --codes … # 迁卡 + 门禁
node --test develop/scaffolds/<code>.test.mjs       # 骨架先绿
npm run test:fast                                   # 全量快测
```

`--write` 的拒绝规则（不静默近似）：

- 出现战役逃生原语（`tfaPlayer` / `carcosaPlayer` …）→ 拒绝（归 5c）；
- 费用里有 `discardSelf` / `exileSelf` / `assetDamage` → 拒绝（副作用日志会排在「使用」之前，
  与描述子路径的顺序不同，指纹会变）；
- 顶层字段没有描述子读点（`reaction` / `reactions` / `freeTriggers` / 非 `stats` 的 `passive` /
  `attachTo` / `exileAfterPlay` …）→ 拒绝；
- 同一卡号在源文件里出现 0 次或 >1 次 → 拒绝（宁可人工处理）。

---

## 2. 批次与指标

| 批次 | 范围 | 张数 | 迁移方式 |
| --- | --- | --- | --- |
| `5b-1` | `skill` 槽位（`commit` 描述子） | 40 | 工具自动 |
| `5b-2` | `weakness` 槽位（`weakness` 描述子） | 27 | 工具自动 |
| `5b-3` | `event` / `fast,event` / 旧打出条件 → `played` + `playCondition` | 37 | 工具自动 |
| `5b-4` | `abilities` → `action` 描述子；`passive.stats` → `modifiers` | 19 | 工具自动 |
| `5b-5` | `uses`/`usesType`/`discardWhenEmpty` + `abilities` | 31 | 工具自动 |
| `5c-1` | Carcosa：地点附属 / 遭遇连抽 / 牌库检索（旧原语 → `resolve` + `ctx.api`） | 7 | 手写 + 删引擎分支 |
| `5c-2` | Carcosa/TFA：调查与躲避（`api.investigate` / `api.evade` / `countsAs`） | 8 | 手写 + 删引擎分支 |
| `5c-3` | TFA：武器与检定加值（条目级 `fast` / `target` 枚举 / `api.fight`） | 5 | 手写 + 删引擎分支 |
| `5c-4` | TFA：事件与支援（`choice` / `directDamage` / `removeThreat` / `api.maxHealth`） | 4 | 手写 + 删引擎分支 |
| `5c-5` | Carcosa/TFA：移动 / 战斗 / 充能 / 治疗（`api.enemyEvade` / `api.random` / `api.cardSanity`） | 5 | 手写 + 删引擎分支 |
| `5a-1` | 引擎旧原语**死分支**清理（迁完后无数据引用的 4 段） | 4 段 | 死代码扫描 + 架构守卫 |
| `5b-6` | 反应描述子接线 + Dunwich/core 首批纯数据反应 | 8 | 手写（`legacyReaction`） |
| `5b-6b` | core / Dunwich / TFA 纯数据反应（含 `discardSelf` 费用） | 7 | 手写（`legacyReaction`） |
| `5b-6c` | core / Carcosa / TFA 剩余反应（含「反应 + 主动能力」混合卡） | 13 | 手写（`legacyReaction`） |
| `5c-6` | Carcosa/TFA：handler → `resolve`（检定、目标选择、支援治疗） | 6 | 手写 + 删引擎分支 |
| `5c-7` | Carcosa/TFA：需要新包装的交互卡（敌人修正、劝服、献祭） | 3 | 手写 + 删引擎分支 |
| `5c-8` | Carcosa：**反应窗口的快速事件**（能力接线）+ 我来处理 / 内讧 / 窄路逃生 | 3 | 手写 + 删引擎分支 |
| `5c-9` | TFA：反应窗口事件的检定计划 / 接手 / 放回遭遇牌库 | 5 | 手写 + 删引擎分支 |
| `5b-7` | 天赋牌（`freeTriggers` / 沉静）搬到条目级字段 | 15 | 手写（能力接线 + 搬数据） |
| `5c-10` | Carcosa/TFA：从弃牌堆打出 / 打出后移出游戏（`playableFromDiscard` 等） | 3 | 手写 + 删引擎分支 |
| `5b-6d` | 被动 + 反应组合（02020 / 03269，`passive` 整块搬到条目） | 2 | 手写 |
| `5b-8a` | 纯被动卡（`passive` 整块搬到条目） | 15 | 手写（工具生成条目） |
| `5b-8b` | 被动 + 主动能力（数据原样搬） | 5 | 手写 |
| `5b-9` | 规则性字段（回合结束自愈 / 维护付费 / 被击败反伤 / 恐惧转移 / 不可离场） | 6 | 手写（能力接线 + 搬数据） |
| `5b-10` | 封印 / 替换旧印 / 附属（`sealOnEnter` / `attachTo` / `onAttach`） | 5 | 手写（能力接线 + 搬数据） |
| `5b-11` | 耗尽自愈 +「被动 + 反应」组合（04008/04023/04025/04147/03313） | 5 | 手写（`legacyReaction` + 搬数据） |
| `5c-11` | 逃生原语 → `resolve`：奥利芙（揭示计划）/ 学无止境（重试检定） | 2 | 手写 + 新 api + 删引擎分支 |
| `5c-12` | 逃生原语 → `resolve`：秘籍（跳过标记 ×2）/ 临时屏障（躲避） | 2 | 手写 + 新 api + 删引擎分支 |
| `5c-13` | 逃生原语 → `resolve`：炼金转化 / 养神术（通用检定 api） | 2 | 手写 + 新 api + 删引擎分支 |
| `5c-14` | 逃生原语 → `resolve`：时刻警惕（连续打出）/ 障眼戏法（免费放置） | 2 | 手写 + 新 api + 删引擎分支 |
| `5c-15` | 逃生原语 → `resolve`：幸运邂逅（弃牌堆招募）/ 挥金如土（检定加成 + 返还） | 2 | 手写 + 删引擎分支（03189 回退） |
| `5c-16` | 逃生原语 → `resolve`：发掘古物（检定后直接放置入场） | 1 | 手写 + 2 个 api + 删引擎分支 |
| `5c-17` | 逃生原语 → `resolve`：手铐（人形敌人检定 + 附属） | 1 | 手写 + 1 个 api + 删引擎分支 |
| `5c-18` | 逃生原语 → `resolve`：田野调查 / 扒手 / 阿登森林护甲 / 追忆未来 / 再试一次 | 5 | 手写 + 5 个 api + 删 5 段引擎分支 |
| `5c-19` | 逃生原语 → `resolve`：求助盟友 / 爱丽·霍洛维兹（**entersPlay** 的 resolve 读点 + 牌库顶检索附属） | 2 | 手写 + 4 个 api + 删 2 段引擎分支 |
| `5c-20` | 逃生原语 → `resolve`：走私货物 + 条目级 `playRestriction` / `teamLimit` 读点 | 1 | 手写 + 2 个读点 + 删 1 段引擎分支 |
| `5c-21` | 逃生原语 → `resolve`：解锢灵魂（折扣打出另一张法术）+ `api.cardHasLegalTarget` | 1 | 手写 + 1 个 api + 删 1 段引擎分支 |
| `5a-5` | 卡号分支 → 条目级被动标记：03010 缜密分析（`passive.analyticalMind` / `passive.remoteCommit`） | 1 个码 | 手写 + 2 处读点数据化 |
| `5c-22` | 反应窗口的快速事件 → `played` + `fast` + `trigger`：预警（花线索取消诡计）+ `api.spendClueToLocation` | 1 | 手写 + 1 个 api + 删 1 段引擎分支 |
| `5c-23` | 遭遇牌库检索：追猎（顶 9 张找敌人生成交战）+ `api.encounterEnemies` / `api.spawnEncounterEnemy` | 1 | 手写 + 2 个 api + 删 1 段引擎分支 |
| `5c-24` | 打出后变成场上卡 + 封印标记：危险预感（`becomesAsset` / `substituteSealedToken` 读点 + 3 个 api） | 1 | 手写 + 3 个 api + 删 1 段引擎分支 |
| `5c-25` | 检定 + 「本局一次」标记：古代遗物（`api.gameFlag` / `setGameFlag` / `doom` / `removeDoom`） | 1 | 手写 + 4 个 api + 删 1 段引擎分支 |
| `5c-26` | 先选敌人再按指定技能躲避：暗示（`api.chooseEnemy`，顺带修掉「空 effect 必抛错」的既有 bug） | 1 | 手写 + 1 个 api + 删 1 段引擎分支 |
| `5c-27` | 击败敌人后把敌人与事件卡一起放入胜利区：掩埋（`api.buryEnemyInVictory`） | 1 | 手写 + 1 个 api + 删 1 段引擎分支 |
| `5c-28` | 充能支援的转移与回收：灵语人 / 愤怒之灵（`api.isChargeAsset` / `canLeavePlay`，弱点数据体同批搬） | 2 | 手写 + 2 个 api + 删 2 段引擎分支（含 2 条 effectError 守卫） |
| `5c-29` | 研究记录与充能类型：古代雕文（`api.recordResearch` / `setUsesType`） | 1 | 手写 + 2 个 api + 删 1 段引擎分支 |
| `5c-30` | 附属到地点并把帷幕视为 1：骷髅钥匙（`api.attachSelfToLocation` + 条目级 `shroudAsOne`） | 1 | 手写 + 1 个 api + 删 1 段引擎分支 |
| `5c-31` | 敌人攻击造成伤害后的反击：求生匕首（`api.isEnemyInPlay` + `api.fight` 的 `noSpend`） | 1 | 手写 + 1 个 api + 1 个参数 + 删 1 段引擎分支 |
| `5c-32` | 角色切换 / 替人挨打：即兴表演、英勇救援（`api.switchRole` / `setRoleDiscount` / `className` / `enemyAttackByCard`） | 2 | 手写 + 4 个 api + 删 2 段引擎分支 |
| `5c-33` | 额外弹药换额外揭示：吃子弹（`api.addExtraChaosChoicesToTest`） | 1 | 手写 + 1 个 api + 删 1 段引擎分支 |
| `5c-34` | 附属区当手牌打出：背包（条目级 `cardBackpack` + 3 个 api + 4 处读点） | 1 | 手写 + 3 个 api + 4 处读点数据化 |
| `5c-35` | 地点物品折扣 / 同归于尽：查尔斯·罗斯、同归于尽！（`setLocationItemDiscount` / `engagedEnemies` / `setDamageToMax` / `bumpInstanceTrauma`，+ 条目级 `quietPlay`） | 2 | 手写 + 4 个 api + 1 个条目字段 + 删 2 段引擎分支 |
| `5c-36` | 免于一死 / 整段回滚：死里逃生、时间曲折（`disengageAll` / `discardAllThreats` / `softEndTurn` / `locationsWithoutEnemies` / `rewindLastAction`） | 2 | 手写 + 5 个 api + 删 2 段引擎分支 |
| `5c-37` | 滴答计数 / 封印「0」的攻击：时间借取、虚空碎裂（`addClicks` / `sealedTokensFrom` / `releaseSealedToken` + 描述子级 `maxClicks`） | 2 | 手写 + 3 个 api + 1 个描述子字段 + 删 2 段引擎分支 |
| `5c-38` | 复制弃牌堆的洞察事件并重放：遗觉记忆（`discardPiles` / `playCostOf` / `exileFromDiscard` / `replayPlayedCode`） | 1 | 手写 + 4 个 api + 删 1 段引擎分支 |
| `5c-39` | 附属区当手牌打出 + 开局检索：原定计划（条目级 `cardPlan` / `rewindAction` + `setup` 描述子 + 2 个 api） | 1 | 手写 + 2 个 api + 2 个条目字段 + 1 个新 kind + 删 1 段引擎分支 |
| `5b-8` | 攻击转移 / 入场自选技能 / 神话结束弃掉：安奎娜（两版）、戴红手套的男子（条目级 `redirectAttackToAsset` / `forcedMythosEndDiscard` + `setStatOverride`） | 3 | 手写 + 2 个 api + 2 个条目字段 + 2 个块数据化 + 删 3 段引擎/原语 |
| `5b-12` | 战役规则型被动：适应性、卡戎的银币（条目级 `adaptableSwaps` / `obolContract`，读点在 campaign.js 与结局发经验段） | 2 | 手写 + 2 个条目字段 + 2 处读点数据化 |
| `5b-13` | 「弃掉自己 / 自己受伤」费用的主动能力：巡警 ×2、警徽（`cost.discardSelf` / `assetDamage` 已在 COST_KEYS） | 3 | 手写 3 条描述子 + 删 3 条旧条目 |
| `5b-14` | 剧情资产的持续修正：褴褛披风（条目级 `passive.conditionalStats`，读点在 modifiers.js） | 1 | 手写 1 条条目 + 删 1 条旧条目 |
| **合计** | | **337 张卡 + 74 段引擎分支** | |

指标（`npm run cards:audit`）：

| 指标 | Phase 4 收尾 | Phase 5 现在 | 变化 |
| --- | --- | --- | --- |
| `effectsEntries` | 385 | **57** | −328 |
| 通道 `legacy` | 286 | **51** | −235 |
| 通道 `descriptor` | 75 | **404** | +329 |
| 通道 `escape` | 93 | **0** | −93 ✅ |
| `descriptorEntries` / `descriptorAbilities` | 79 / 59 | **406 / 343** | +327 / +284 |
| `effectsTopLevelFields` | 69 | **33** | −36（`event`/`skill`/`weakness`/`freeTriggers`/`composure` 等旧字段搬空后不再出现） |
| `engineCodes` | 166 | **101** | −65 |（5c 删掉的逃生原语分支为主，含 5c-18 的 3 个码；另 5a 四批把 15 个卡号的数据搬去 `card-rules.js`） |

`effectsEntries` 的下降是 285 张卡的迁移结果（154 张来自工具的 5b 机械迁移，35 张来自反应接线，15 张来自天赋档位，31 张来自被动/规则字段/封印附属，50 张来自 5c 手写改写）；
`engineCodes` 的 35 个下降来自被删掉的旧原语分支（5c 25 个）与搬到内容层的卡号数据（5a 四批 10 个）；
5a 剩下的主要是 `requestChoice` 的来源标签（会进状态指纹）与 `def.code` 行为分支。

---

## 3. 5b 机械迁移：搬槽位，不改写法

一个条目只有在「所有顶层字段都有现成读点」时才被判为可机械迁移。字段映射：

| 旧 DSL 字段 | 描述子 | 读点 |
| --- | --- | --- |
| `event` | `kind: 'played'` + `effect` | `lifecycle.playedEffect(code)` |
| `skill` | `kind: 'commit'` + `skill` | `lifecycle.commitProfile(code)` |
| `weakness` | `kind: 'weakness'` + `weakness` | `lifecycle.weaknessProfile(code)` / `getThreatEffect` |
| `onEnter` | `kind: 'entersPlay'` + `entersPlay` | `lifecycle.entersPlayEffect(code)` |
| `uses` / `usesType` / `discardWhenEmpty` | 条目级同名字段 | `newPlayerAssetInstance` / `assetEffect` / `executeDescriptor` |
| `abilities[]` | `kind: 'action'` + `label`/`cost`/`effect` | `abilityShim(code)` → `assetEffect` → `doAbility` |
| `passive: { stats }` | `modifiers: [{ target: 'skill:*', amount }]` | `modifiers.js` 的 `modifierTotal` |
| 8 个旧打出条件字段 | 条目级 `playCondition`（谓词顺序与 `LEGACY_RULES` 一致） | `play-condition.js` 的 `playConditionError` |
| `fast` / `noOpportunityAttack`（事件卡） | `played` 描述子的同名标志 | `lifecycle.playFlag(code, flag)` |

纪律（与路线 §7 一致）：**数据对象原样搬运**，不改成 `resolve` 闭包；`ability` 数组顺序保留
（`abilityIndex` 是玩家/AI 的公开契约）。

### 3.1 为了让「搬运」真的不改行为，顺手补的读点

迁移会暴露引擎里「只读旧 DSL」的位置。这些位置都改成同一份读点，**不是**按卡号的特判：

| 位置 | 改动 | 理由 |
| --- | --- | --- |
| `assetEffect(inv, asset)` | 合并注册表条目的 `uses`/`usesType`/`discardWhenEmpty` | 补充弹药、充能耗尽、界面文字只有一个来源 |
| `executeDescriptor` | `discardWhenEmpty` 也读注册表；`effect` 数据体按 `targetId`/`optionIndex` 展开 | 与 `doAbility` 的旧式路径同源，否则解释器会再问一次目标 |
| `executeDescriptor` 日志 | 从牌桌「能力」入口（`doAbility`）进来的描述子沿用旧文案「使用「X」的能力：…」 | 文案进 `state.log`，也进指纹；不改就会让迁移变成行为变化 |
| `cardPlayFlag` | 改为委托 `lifecycle.playFlag` | `fast`/`noOpportunityAttack` 的唯一读点，测试也可用 |
| `tfaPlayCostPreview` | `EFFECTS[code]?.fast` → `playFlag(code, 'fast')` | 同上 |
| `tomeActionEligible` | `EFFECTS[code].abilities[i]` → `assetEffect(...).abilities[i]` | 「书籍额外行动」必须认得描述子能力 |
| `allCardDefs` | `passive.stats` 缺失时从声明式修正反推 `statBonus`/`extraSlots` | 图鉴字段不因迁移丢失（路线 §7 第 4 条） |
| `deckbuilding.scoreCard` | 只对 Phase 5 迁移的卡改用新读点 | 自动构筑的评分口径必须与迁移前一致，否则开局牌组会变（对局存档里含牌组） |
| `ai-context` | 投入档案改读 `commitProfile(code)` | 与 `lifecycle` 同源 |
| `tools/p6-playthrough.mjs`（对局驱动器） | 能力效果按「旧式 abilities 在前、描述子在后」折叠 | P6 轨迹用例要认得出迁移后的武器能力，否则纯合法动作会打空手 |
| `content/expansions.js` + `dunwichSupport` 清单 | 支援包也导出 `abilityLayerCodes` | 包清单判定「有行为实现」时，迁走的卡要登记，否则会被判成不可构筑（踩过一次：牌池少 1 张 → 自动牌组换人 → 指纹变） |

`ability.js` 同时把 D2（使用次数元数据）落地：条目支持 `discardWhenEmpty`，三处读点统一
（`newPlayerAssetInstance` / `assetEffect` / `executeDescriptor`）。
5c-2/5c-3 又补了三件模型小事，都是为了「改写旧原语时不改行为」：

| 新增 | 位置 | 为什么需要 |
| --- | --- | --- |
| 条目级 `fast` / `noOpportunityAttack` | `ability.js` 的 `ENTRY_KEYS` + `lifecycle.playFlag` | 资产/调查员没有 `played` 钩子，卡面关键字只能写在条目上；不补就会让「快速资产」打出时白花行动 |
| 描述子 `countsAs` | `ability.js` + 引擎 `actionKind()` | 旧原语用 `effect.kind` 声明「按躲避结算」；`resolve` 实现没有 effect 数据体，不写就会引发借机攻击 |
| `ctx.api` 的 `investigate` / `evade` / `enemyFight` | 引擎 `abilityApi()` | 调查/躲避的主体流程必须只有一处（行动成本、借机攻击、日志），读值是给「攻击战斗值最高的敌人」这类卡用 |

---

## 4. 5c：逃生卡改写

### 4.1 5c-1：Carcosa 首批（7 张）

逐卡对照（旧原语 → 描述子）：

| 卡 | 旧原语 | 新写法（`src/cards/card-abilities.js`） | 删掉的引擎分支 |
| --- | --- | --- | --- |
| 03026 殚精竭虑 | `carcosaPlayer.noStoneUnturned` (6) | `played` + `searchInvestigatorDeck(6)` | `noStoneUnturned`（03026/03307 共用） |
| 03307 不入虎穴 | `carcosaPlayer.noStoneUnturned` ('all') | `played` + `searchInvestigatorDeck('all')` | 同上 |
| 03038 藏身地点 | `carcosaPlayer.hidingSpot` | `played` + `fast` + `attachToChosenLocation` | 「地点附属」四合一分支 |
| 03148 埋伏 | `carcosaPlayer.ambush` | `played` + `attachToChosenLocation` | 同上 |
| 03199 诱捕陷阱 | `carcosaPlayer.snareTrap` | `played` + `attachToChosenLocation` | 同上 |
| 03232 捷径 | `carcosaPlayer.shortcut2` | `played` + `fast` + `playCondition: ownTurn()` + `attachToChosenLocation` | 同上 |
| 03040 头脑发热 | `carcosaPlayer.overzealous` | `weakness` + `resolve`（`api.drawEncounter` ×2） | `overzealous` |

`engine.js` 的 `abilityApi()` 为此新增 4 个薄包装（都只是已有引擎入口的别名，内容层仍不直接改 state）：

```
attachToLocation(locationId, fields)   // 玩家卡作为地点附属入场（隐藏处/埋伏/陷阱/捷径）
playCard(seat, code, options)          // 按打出规则直接打出另一张牌（折扣 / 免行动）
discardAsset(seat, card)               // 离场 + 进弃牌堆（充能耗尽、返回手牌）
defeatEnemy(enemy, seat)               // 非伤害方式击败敌人
```

行为验收：`tests/phase5-migration.test.mjs` 逐条断言「附属的字段形状」「快速不花行动」
「弱点连抽 2 张遭遇卡」「检索候选数 = 6 / 全部」「捷径用过即横置」。

### 4.2 5c-2：调查与躲避（Carcosa / TFA，8 张）

| 卡 | 旧原语 | 新写法 | 删掉的引擎分支 |
| --- | --- | --- | --- |
| 03027 洞察万物 | `carcosaPlayer.inTheKnow` | `action` + `api.investigate({ locationId })` | `inTheKnow` |
| 03031 撬锁工具 | `carcosaPlayer.lockpicks` | `action` + `api.investigate({ addSkill: 'agility', lockpicksAssetId })` | `lockpicks` |
| 03266 奥术洞察 | `carcosaPlayer.arcaneInsight` | `action` + `cost.action:false` + `limit: perRound` + `api.tempShroudMod(-2)` | `arcaneInsight` |
| 04022 古代石头 | `tfaPlayer.ancientStone` | `action` + `api.investigate({ shroudMod: 3 })` | `ancientStone` |
| 04029 / 04271 意志闪避 | `tfaPlayer.lureEvade` | `action` + `countsAs: 'evade'` + `api.evade({ skill: 'willpower', moveAfterEvade })` | `lureEvade`（两张共用） |
| 04194 异界罗盘 | `tfaPlayer.otherworldCompass` | `action` + `api.investigate({ shroudMod: -已揭示连接数 })` | `otherworldCompass` |
| 04232 悄然遁去 | `tfaPlayer.slipAway` | `played` + `api.evade({ addSkill: 'intellect', skipReadyRounds: 1 })` | `slipAway` |

两处行为差异都是**修正**而不是漂移：03266 的「每轮一次」从 `inv.usedReactions` 裸字段改成
`limit: { scope: 'perRound' }`（第二使用被隐藏，不再走"退还充能"的兜底），帷幕修正从
`location.carcosaShroudModifier` 改为 `turnShroudMod`（两个字段在引擎里同源相加，`§4.2` 的门禁证明指纹不变）。

### 4.3 5c-3：TFA 武器与检定加值（5 张）

| 卡 | 旧原语 | 新写法 | 删掉的引擎分支 |
| --- | --- | --- | --- |
| 04011 芬恩的手枪 | `tfaInvestigator.finnPistol` | 条目级 `fast` + `target: { kind: 'enemy' }` + `api.fight(..., { combatBonus: 2, damageBonus })` | `finnPistol`（含校验里的一条 `abilityTargets` 特判） |
| 04229 勃朗宁 | `tfaPlayer.browning` | `target` 枚举 + 选子弹数 + `api.addUses(-N)` + `api.fight(..., { combatBonus: N, damageOverride: N })` | `browning` |
| 04276 古旧锈剑 | `tfaPlayer.rustedSword` + 纯数据挥砍 | 两条 `action`：数据体 `fight` / `countsAs:'fight'` + `limit:'oncePerGame'` + `api.fight(..., { addSkill:'willpower', damageOverride:3 })` | `rustedSword`（`inv.rustedSwordUsed` 裸字段随之消失） |
| 04305 火焰喷射器 | `tfaPlayer.flamethrower` | `api.enemyFight` 选最高 → `api.fight(..., { combatBonus: 4, flamethrowerSpread: 4 })` | `flamethrower` |
| 04151 有备无患 | `tfaPlayer.wellPrepared` | `free` + `duringOwnSkillTest` + `api.addPendingTestBonus(图标数)` | `wellPrepared` |

> 已记账的既有问题（**不是**迁移引入）：`api.addPendingTestBonus` 写入的 `pendingBonus` 会在
> 待决选择之间被重置——04160 围困等 Phase 2 卡也一样。04151 的验收因此断言「结算日志 + 横置」，
> 不断言检定值；把它记在 §6 的后续清单里。

### 3.4 反应能力接线（5b-6 的前置）

旧式反应（`EFFECTS[code].reactions`）由 `triggerReaction` 在**自己的询问**里结算：
`是否触发「X」的反应？` + `skip/trigger`，费用、上限、日志、效果解释器都在那里。能力层的反应描述子
原本由 `openAbilityWindow` 用另一个 `【能力】…` 询问提供——直接迁移会改玩家的提示与状态指纹。

5b-6 因此先做**接线**，而不是先搬卡：

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| 描述子字段 `legacyReaction` | `ability.js` 的 `DESCRIPTOR_KEYS` / 归一化 | 标记「这是从旧式 reactions 搬来的数据」 |
| `descriptorReactionSpec` | 引擎 `triggerReaction` 旁 | 把描述子翻译成旧式反应的数据形状：`trigger→when`、`criteria` 纯字段→旧条件、`cost/limit/effect` 原样 |
| 候选枚举合并 | `triggerReaction` | 同一张卡先枚举旧式 `reactions`，再枚举 `legacyReaction` 描述子（顺序、询问、日志完全一致） |
| 去重 | `openAbilityWindow` | 跳过 `legacyReaction` 描述子，避免同一张卡出现两次提示 |
| 校验放宽 | `ability.js` | `reaction/forced` 允许「`legacyReaction` + effect 数据体」；`cost` 允许旧式 `returnClue` |
| 新窗口 | `windows.js` | 登记 `chaosTokenRevealed`（02230 用，旧式通道早就在这个时机触发） |

验收：迁移前后 `replay --compare` 逐条一致；`tests/phase5-migration.test.mjs` 追加两条行为用例
（02149 的旧式询问、02188 的自动奖励）。
### 4.0 5a-1：引擎死分支清理（4 段）

5a 的第一批不是「搬卡号」而是**删死代码**：卡迁到描述子、旧条目删掉之后，引擎里的旧原语分支就没有数据能触发了。
这类分支用 `tools/audit-dead-primitives.mjs` 机械判定（数据体 / 内容层源码 / 引擎其它位置三处都无引用即死代码），
并用 `tests/architecture-guard.test.mjs` 的新用例钉住「不得残留」。

| 分支 | 为什么是死代码 | 删掉的引用 |
| --- | --- | --- |
| `otherworldCompass` | 04194 已迁到描述子（5c-2），当时只删条目没删分支 | 分支体 7 行 |
| `finnPistol` | 04011 已迁（5c-3），`validateMove` 里的目标校验也跟着失效 | 1 行校验 |
| `bookwormBoost` | 04154 在 Phase 2 就改成了描述子，旧分支一直留着 | 分支体 7 行 + 分派表 1 项 |
| `cornered` | 04160 同理（Phase 2 描述子） | 分支体 5 行 + 分派表 1 项 |

效果：旧原语分派点 82 → 78，`engineCodes` 158 → 157（`cornered` 里的卡号字面量随分支消失），replay 指纹不变。
**这是 5a 的固定套路**：每批迁卡之后先跑一遍死分支扫描，把「已无引用」的分支立刻删掉，再进入下一批。

### 4.4 5c-4：TFA 事件与支援（4 张）

| 卡 | 旧原语 | 新写法 | 删掉的引擎分支 |
| --- | --- | --- | --- |
| 04266 鲜血失色 | `tfaPlayer.bloodletting` | `played` + 选额外伤害（`api.maxHealth`）+ `api.directDamage` + `api.fight(..., { skill: 'willpower' })` | `bloodletting` |
| 04313 改变命运 | `tfaPlayer.alterFate` | `played` + `fast` + `api.removeThreat`（筛选用 `api.isNonWeakness`） | `alterFate` |
| 04149 恢复元气 | `tfaPlayer.recoverStamina` + `firstActionOnly` | `played` + `playCondition: ownFirstAction()` + `api.healDamage` / `api.drawCards` | `recoverStamina` |
| 04196 萝拉·桑提亚哥 | `tfaPlayer.lolaSantiago` + `passive.stats` | `modifiers`（智识/敏捷 +1）+ `action` + `api.loseResources` / `api.discoverClue` | `lolaSantiago` |

`api.maxHealth(seat)` 是这批新增的薄包装（读 `getMaxHealth`，含被动与修正），
「最多额外承受 N 点伤害」这类卡不再需要自己拼上限。

### 4.6 5c-6：handler → `resolve`（Carcosa / TFA，6 张）

这批把**整段 handler** 搬进描述子（不再只是换入口），同时删掉 6 段引擎分支：

| 卡 | 旧 handler 做什么 | 新写法 |
| --- | --- | --- |
| 03147 双刃短刀 | 选敌人 + `doFight`（战斗 + 已交战数） | `api.fight(..., { combatBonus })` |
| 03230 急救 | 选调查员/盟友 + 治疗 1/1 | `api.investigatorsAt` + `api.healAsset` / `healDamage` / `healHorror` |
| 03273 幸存者 | 至多 3 次从弃牌堆取回天生技能 | `api.cardType` + `api.cardTraits` + `api.moveCard` |
| 03309 短管猎枪 | 攻击 + 入场回合 +2/+2 | `api.fight(..., { combatBonus, damageBonus })` + 条目级 `noOpportunityAttack` |
| 04027 窃听 | 智识检定对抗敌人躲避值，成功发现 2 线索 | `api.test(..., api.enemyEvade(enemy))` + `api.discoverClue(2)` |
| 04273 旧霰弹枪 | 战斗 +3，骷髅/自动失败卡膛 | `api.test(...)` + 读 `result.drawn` + `api.damageEnemy` |

新增两个薄包装：`api.cardType(code)` 与 `api.healAsset(card, { damage, horror })`；
另外修了一处读点：资产的「打出时不引发借机攻击」旧字段是 `noOpportunityAttackOnPlay`，
迁移后写成条目级 `noOpportunityAttack`，引擎的 `playNoAoO` 现在也读 `playFlag()`（03309 的验收用例抓住了这次回归）。

### 4.7 5c-7：需要新包装的交互卡（3 张）+ 一次回退

| 卡 | 新包装 | 说明 |
| --- | --- | --- |
| 03108 解剖图 | `api.enemyTestModifier(enemy, { fight, evade })` | 写敌人的本回合战斗/躲避修正 |
| 04105 劝服 | `api.removeEnemy` / `api.shuffleIntoEncounterDeck` / `api.autoEvade` | 精英自动躲避；其余检定成功后移出并洗回遭遇牌库 |
| 04234 献祭 | `api.cardFactions` / `api.discardAsset` / `api.drawCards` / `api.gainResources` | 弃秘术支援后分配 3 点 |

**回退记录：03314「内讧」**。它的旧条目是 `fast: true, reaction: { when: 'enemyPhaseBegins' }` —— 事件卡在**反应窗口**打出，
由 `reactionWindow` 的 `EFFECTS[code].reaction` 枚举提供。能力层的 `played` 描述子还没有这条接线，
迁走后卡片在敌人阶段不再可用（`carcosa-implementation-gaps` 的用例立刻红了）。
处理：恢复旧条目 + 恢复 `infighting` handler，并把「事件在反应窗口打出」列为 5c-8 的前置能力。
**教训**：迁移前必须核对条目的**所有**顶层字段（`fast` / `reaction` / `noOpportunityAttackOnPlay` …），
handler 只覆盖结算部分。

### 4.18 5a-4：议程 / 中毒 / 提示例外（3 个码）

同一套做法继续：把还挂在引擎里的「卡号 → 数据」搬进 `src/cards/card-rules.js`。

| 卡号 | 数据 | 读点 |
| --- | --- | --- |
| 02043 | `AGENDA_HAND_SIZE_PENALTY` | 整理阶段的 `handSize()` 改为 `agendaHandSizePenalty(originalCode)` |
| 04102 | `POISON_THREAT_CODES` + `poisonThreatCode()` | `isPoisoned()` 与中毒流程都用数据取卡号 |
| 01007 / 01071 / 01082 | `EXPLICIT_REACTION_PROMPT` | `allCardDefs.hasReactionPrompt` 的例外清单 |

新增 `tests/card-rules.test.mjs`（2 条）锁住这些读点的形状与冻结性，已进 `fast` tier 与 `node-suite`。

**5a 仍然剩什么**：`requestChoice({ source: '0xxxx' })` 的来源标签（改动会进状态指纹）与
`def.code === '0xxxx'` 形式的**行为分支**（例如 01007 的创伤、01071 的雕像充能、01082/02308 的安奎娜转移）——
后者要等对应的 `ctx.api` 与描述子写法，归入 5a-5 起的批次。

### 4.52 5b-14：剧情资产的持续修正（1 张，5b 收尾）

03143 褴褛披风是剧情资产：`sanityBonus: -1` + 「剩余理智 ≤ 3 时 +1 意志/战斗/敏捷」。
两项都在 `modifiers.js` 的 `passive` 折叠里有读点（`sanityBonus` 走 `getMaxSanity` 的
`assetPassiveBonus`，`conditionalStats` 走条件分支），所以条目级 `passive` 与旧 DSL 走**同一份读点**，
这一批同样不需要新 api、不需要改引擎。

验收：`tests/phase5-migration.test.mjs` 一条（理智上限 -1；理智充足时不加值、剩余 ≤ 3 时三项 +1）；
`replay --compare` 逐条一致；`effectsEntries` 58 → 57、`legacy` 52 → 51。

> **教训（差点删掉邻居）**：删旧条目时我用「找下一个 `\n  },`」当结束位置，
> 而 03143 的条目是**单行收尾**（`  } } },`），于是搜索越过了它，把下一条 01086「刀子」一起删了——
> `replay --compare` 立刻报「玩家卡效果依赖缺失：01086」（10 局全红）。恢复办法是
> `git checkout HEAD -- src/cards/card-effects.js` 再按**行号 + 校验收尾行**重删。
> 结论：**删条目要按结构删（行号 + 断言收尾行内容），不要按「下一个相似标记」删**。

### 4.51 5b-13：带「弃掉自己 / 自己受伤」费用的主动能力（3 张）

01018 / 01028 巡警与 01027 警徽是同一族：`passive`（+1 某技能）+ 一条**免费**能力，
费用是「弃掉自己」或「横置并让这张支援受 1 伤害」。三项费用字段（`discardSelf` / `assetDamage` / `exhaust`）
早在 `COST_KEYS` 里，所以这一批**不需要新 api**，直接把旧条目拆成条目级 `passive` + `action` 描述子：

| 卡 | cost | effect |
| --- | --- | --- |
| 01018 巡警 | `{ action: false, discardSelf: true }` | `dealDamage 1`（`target: 'here'`） |
| 01028 巡警 | `{ action: false, exhaust: true, assetDamage: 1 }` | `dealDamage 1`（`target: 'here'`） |
| 01027 警徽 | `{ action: false, discardSelf: true }` | `targetedEffect`（地点、`activeTurnOnly`）→ `gainAction 2` |

`effect` 数据体直接放在描述子上（描述子本来就支持 `effect`），所以引擎侧零改动、零新 api。

验收：`tests/phase5-migration.test.mjs` 一条（弃掉自己 / 自己受伤 / +2 行动三种费用都付对了）；
`replay --compare` 逐条一致；`effectsEntries` 61 → 58、`legacy` 55 → 52。

### 4.50 5b-12：战役规则型被动（2 张）

| 卡 | 旧形态 | 新形态 |
| --- | --- | --- |
| 02110 适应性 | `campaign: { adaptable: 2 }` | 条目级 `adaptableSwaps: 2` + `passive.permanent` |
| 03308 卡戎的银币 | `campaign: { charonsObol: true }` | 条目级 `obolContract: true` + `passive.permanent` |

两处读点都改成数据驱动：

- `src/campaign/campaign.js` 的关间升级报价：`record.deck.includes('02110')` →
  `record.deck.map(code => registeredEntry(code)?.adaptableSwaps).find(value => value > 0)`
  （次数上限也来自条目，不再写死 2）。
- `engine.js` 的结局发经验段：`asset.code === '03308'` → `registeredEntry(asset.code)?.obolContract`。

> **坑：批次名会撞车**。`audit/migration-batches.json` 里早就有 `5b-9` / `5b-10` / `5b-11`（之前的 5b 细分批次），
> 我一开始把新批次命名成 `5b-9`，直接把那 6 张卡的记录覆盖掉了——`migrate-card --verify` 立刻报「57 个批次」里的
> 不一致，`migration-tools` 的「批次文件块可以读回」用例也红（`5b-9 既没有生成块也没标记为手写批次`）。
> 教训：**加批次前先 `readBatchLedger()` 看已有 key**，新批次用下一个空号（本次改为 `5b-12`）；
> 被覆盖的记录要从 `git show HEAD:audit/migration-batches.json` 恢复，`manual` 名单也要补回去。

验收：`tests/phase5-migration.test.mjs` 一条（两个条目级标记）；`replay --compare` 逐条一致；
`effectsEntries` 63 → 61、`effectsTopLevelFields` 35 → 34、`legacy` 57 → 55。

### 4.49 5b-8：攻击转移 / 入场自选技能 / 神话结束弃掉（3 张）

这一批把 5b 尾部的两张反应卡清掉，顺带处理它们的同版印刷卡：

| 卡 | 旧形态 | 新形态 |
| --- | --- | --- |
| 01082 安奎娜 | `reactions[0].effect: { type: 'aquinnahRedirect' }` | 条目级 `redirectAttackToAsset: true`（**没有**反应描述子） |
| 02308 阿奎娜（敦威治版） | 同上 | 同上 |
| 02310 戴红手套的男子 | `reactions[0].effect: { type: 'redGlovedManSkills' }` + `forcedMythosEndDiscard` | `entersPlay` 描述子 + 条目级 `forcedMythosEndDiscard` |

新增两个条目字段与两个 api：`redirectAttackToAsset` / `forcedMythosEndDiscard`（都进 `ENTRY_KEYS` + 归一化，
后者还要在 `assetEffect` 的合并里露出来，否则神话阶段读不到）、`api.setStatOverride(card, skills)` / `api.skillName(skill)`。

引擎侧把 `tryAquinnahRedirect` 的 `['01082', '02308'].includes(asset.code)` 换成条目标记，
并删掉 `redGlovedManSkills` 分派分支与 `aquinnahRedirect` 原语（运行时从来没有实现过它）。

> **三条记账**
> 1. **01082 / 02308 原来那条反应是死代码**：`makeRuntime` 里没有 `aquinnahRedirect`，
>    真正生效的是 `enemyAttack` 里的 `tryAquinnahRedirect`。所以这两个条目只保留标记。
> 2. **删卡号分支要同时登记卡包**：02310 从 `dunwichPlayer/effects.js` 删掉后，`hubAutoDeck` 那一步
>    立刻变指纹（自动牌组少一张）——把它加进 `dunwichPlayer` 的 `abilityLayerCodes` 后恢复。
> 3. **验收账本要重生成**：`dunwich-player-acceptance` 的「严格验收」按 `behaviorOf(code)` 折叠形状断言，
>    迁移后要给 `tests/dunwich-player-acceptance.test.mjs` 的折叠函数补上新槽位（`entersPlay` 与两个标记），
>    并跑 `node tools/audit-dunwich-acceptance.mjs --write` 重生成账本，否则 `dunwich-ledger` 那条会红。

验收：`tests/phase5-migration.test.mjs` 一条（转移伤害 / 自选两项技能）；
`tests/dunwich-player-acceptance.test.mjs` 112/112；`replay --compare` 逐条一致；
`engineCodes` 105 → 102、`effectsEntries` 65 → 63、`effectsTopLevelFields` 37 → 35、`legacy` 59 → 57。

### 4.47 5c-38：复制弃牌堆的洞察事件（1 张）
### 4.47 5c-38：复制弃牌堆的洞察事件（1 张）

03306 遗觉记忆：付等同费用，复制一张弃牌堆里的洞察事件（移出游戏后重放效果），自己移出游戏。

| 新增 api | 说明 |
| --- | --- |
| `api.discardPiles()` | 所有调查员弃牌堆的 `{ code, seat }` 列表 |
| `api.playCostOf(seat, code)` | 该调查员打出这张牌的费用（复用 `playCost`，含折扣/修正） |
| `api.exileFromDiscard(seat, code)` | 从弃牌堆取走一张并写进 `removedFromGame` |
| `api.replayPlayedCode(seat, code)` | 重放一张牌的打出效果：**描述子 `played.resolve` 优先，其次旧数据体**，与 `doPlay` 同一套判断 |

描述子：`played` + `fast` + 条目级 `removeAfterPlay` + `quietPlay`（旧数据体事件不写 `使用「X」：…`，
不加这行会改玩家可见日志）。

验收：`tests/phase5-migration.test.mjs` 一条（列出洞察事件 → 付费用 → 两张都移出游戏）；
`replay --compare` 逐条一致；`engineCodes` 108 → 107、`effectsEntries` 67 → 66、`effectsTopLevelFields` 39 → 38、逃生卡 2 → 1。

### 4.46 5c-37：滴答计数与封印「0」的攻击（2 张）

| 卡 | 迁移方式 |
| --- | --- |
| 04308 时间借取 | `action` + `cost: { action: true }` + **描述子级 `maxClicks: 3`**：`api.addClicks(source, 3)` 并写旧日志 |
| 04310 虚空碎裂 | 条目级 `uses/usesType/sealOnEnter` + `action` + **`countsAs: 'fight'`**：`api.sealedTokensFrom` / `releaseSealedToken` 支付 → 选敌人 → `api.fight(..., { skill: 'willpower', combatBonus: sealedNow*2, damageBonus: 1, sealZerosTo: source.id, sealZerosLabel })` |

三个新 api：`addClicks`、`sealedTokensFrom`、`releaseSealedToken`（释放时同步 `state.sealedTokens` 并把标记放回混乱袋）。
另外把引擎里 `opts.shardsOfTheVoid` 这个**卡号专用读点**换成通用的 `opts.sealZerosTo` + `opts.sealZerosLabel`
（「本次攻击每揭示一个 0 就封印在卡上并 +1 伤害」），`maxClicks` 也从 `EFFECTS` 的旧字段正式变成描述子字段
（`DESCRIPTOR_KEYS`、归一化、`abilityShim` 三处都要带，否则 `canAffordAbility` 读不到、能力到 3 声滴答还能点）。

> **两个坑**
> 1. `maxClicks` 只加进 `DESCRIPTOR_KEYS` 不够——归一化对象和 `abilityShim` 都要显式带字段，
>    否则「归一化丢字段」会让上限静默失效（`tfa-player-acceptance` 的「最多 3 声滴答」断言当场红）。
> 2. 04310 的旧写法是 `effect: { kind: 'fight' }`，引擎据此判断「攻击能力不引发借机攻击」。
>    迁成 `resolve` 后必须显式写 `countsAs: 'fight'`，否则它会退化成普通行动——
>    这条由 `fast` 里「攻击 / 躲避能力不引发借机攻击」那条用例抓住。

验收：`tests/phase5-migration.test.mjs` 一条（滴答上限 / 花充能意志攻击并封印 0）；`tfa-player-acceptance` 86/86；
`replay --compare` 逐条一致；`engineCodes` 109 → 108、`effectsEntries` 69 → 67、`effectsTopLevelFields` 40 → 39、逃生卡 4 → 2。

### 4.45 5c-36：免于一死与整段回滚（2 张）

| 卡 | 旧原语 | 新写法 |
| --- | --- | --- |
| 03310 死里逃生 | `carcosaPlayer.cheatDeath` | `played` + `fast` + `trigger: wouldDefeat` + `selfOnly` + 条目级 `removeAfterPlay`：`disengageAll` → `discardAllThreats` → `healDamage/healHorror(seat, 2)` → `locationsWithoutEnemies()` 里选一个 → `moveInvestigator` → `softEndTurn` |
| 03311 时间曲折 | `carcosaPlayer.timeWarp` | `played` + `fast` + `trigger: actionResolvedAtLocation` → `api.rewindLastAction(seat)` |

五个新 api：`disengageAll`、`discardAllThreats`、`softEndTurn`（只置 `actionsLeft/turnEnded`，不是 `doEndTurn`）、
`locationsWithoutEnemies`、`rewindLastAction`（整局回滚到 `state.lastActionSnapshot`，保留该调查员的手牌 / 资源 /
弃牌堆 / 移出游戏与事务层的 `_resolution`、`revision`，与旧原语逐句一致）。

> **两处细节**
> 1. 03010 系的 `healDamage`/`healHorror` 在 `abilityApi` 里是 `(seat, amount)`，第一次写成 `api.healDamage(2)`
>    会把 2 当座位号、静默失败——`03310` 于是「打出了但没生效」，靠探测用例才发现。
> 2. **顺带修好了一条基线失败**：`03310 Cheat Death…` 原来用 `draw` 触发，而 `draw` 会先吃一次借机攻击，
>    把这唯一一张「一局一次」的牌提前用掉，敌人阶段再被打就没人救——用例因此一直红。
>    改成 `endTurn`（只走敌人阶段那一次攻击）后通过，`fast` 的既有失败从 **8 条降到 7 条**。

验收：`tests/phase5-migration.test.mjs` 两条（免于一死 / 回滚移动）；`tests/carcosa-implementation-gaps.test.mjs`
的 03310、03311 两条转绿；`replay --compare` 逐条一致；`engineCodes` 110 → 109、`effectsEntries` 71 → 69、逃生卡 6 → 4。

### 4.44 5c-35：地点物品折扣与「同归于尽」（2 张）

| 卡 | 旧原语 | 新写法 |
| --- | --- | --- |
| 03149 查尔斯·罗斯大人 | `carcosaPlayer.charlesRoss` | `action`（横置）→ `api.setLocationItemDiscount(seat, source, 1)`（记在支援上；旧原语还会退回记在人身上，这里保留 asset 分支） |
| 03189 「同归于尽！」 | `carcosaPlayer.illSeeYouInHell` | `played` + 条目级 `noOpportunityAttack` + `quietPlay`：`api.engagedEnemies(seat)` 过滤非精英 → `api.defeatEnemy` → `api.bumpInstanceTrauma(seat, 'physical', 1)` → `api.setDamageToMax(seat)` |

四个新 api：`setLocationItemDiscount`、`engagedEnemies`、`setDamageToMax`（赋值 + `checkDefeated`，顺序同旧）、
`bumpInstanceTrauma`。

> **两个必须记住的坑（都被 `replay --compare` 当场抓住）**
> 1. 旧条目顶层的 `noOpportunityAttack` 是「打出时不吃借机攻击」，**条目级有同名读点**，必须搬到条目上；
>    只搬 handler 会让这张牌在 golden 局里多吃一次借机攻击。
> 2. 迁移成 `played` 描述子后，引擎会多写一行 `✨ 使用「X」：<label>`。旧「数据体事件卡」没有这一行，
>    而 golden 局里恰好会打出这张牌（3 局）→ 指纹立刻不一致。为此新增条目级 `quietPlay`，
>    `doPlay` 据此给 `executeDescriptor` 传 `silent: true`。
> 3. 03189 的旧实现写的是调查员实例上的 `physicalTrauma`（**不写战役账本、不写日志**，引擎里也没有别的读点）。
>    这其实是卡面缺陷（「受 1 点物理创伤」应当进战役账本）。为了守住「指纹不变」，`bumpInstanceTrauma`
>    原样复刻了这个行为，并在此登记为已知缺陷，修它要单独一批 + 重采基线。

验收：`tests/phase5-migration.test.mjs` 一条（折扣记录 / 击败交战敌人 / 创伤 / 伤害拉满）；
`replay --compare` 逐条一致；`engineCodes` 不变、`effectsEntries` 73 → 71、`effectsTopLevelFields` 42 → 40、逃生卡 8 → 6。

### 4.43 5c-34：附属区当手牌打出（1 张）

04037 背包是全阶段最大的一块（引擎里 6 处引用），因为它既要在入场时搜牌库，又要求
**`attachedCards` 里的牌能像手牌一样打出**——后者是引擎的通用读点，不能只迁 handler。

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| 条目级 `cardBackpack: true` | `ability.js`（`ENTRY_KEYS` + 归一化） | 声明「这张支援的 attachedCards 可以当手牌打出」 |
| 3 处读点数据化 | `doPlay` 的 `fromBackpackId`、`legalMoves`、`validateMove` | `asset.code === '04037'` → `registeredEntry(asset.code)?.cardBackpack`；弃背包也改成 `bag.code` |
| `api.setAttachedCards(host, codes)` | `abilityApi` | 写 `host.attachedCards`（不是 attachments——两者是不同的字段） |
| `api.takeFromDeck(seat, codes)` | `abilityApi` | 从牌库取走指定牌各一份，洗牌交给调用方 |

描述子：`entersPlay` + `cardBackpack: true`。结算按**旧实现的可交互版本**逐步复刻：
牌库顶 6 张取反（顶在前）→ 过滤「非弱点 + Item/Supply」→ 循环 `api.choice({ kind: 'card' })` 让玩家挑到 3 张
（`done` 提前结束）→ `takeFromDeck` → `shuffleDeck` → `setAttachedCards` → 一张都没有时弃掉背包并写旧日志。

> **关键教训**：引擎里其实有**两段** `backpackSearch`（一段可交互、一段自动取前 3 张）。同一函数里第一段永远先命中，
> 所以**真正活着的是可交互那段**，自动那段是死代码。迁移前必须确认哪段可达，否则会把「玩家选择」变成「自动选择」——
> `replay` 抓不到这种差异（golden 局没有打出背包），只有 `tfa-player-acceptance` 的背包用例能抓到。

验收：`tests/phase5-migration.test.mjs` 一条（打出背包 → 附属区有牌 → `legalMoves` 里出现 `fromBackpackId` → 打出一张后离开附属区）；
`tests/tfa-player-acceptance.test.mjs` 背包用例保持绿；`replay --compare` 逐条一致；
`engineCodes` 111 → 110、`effectsEntries` 74 → 73、`effectsTopLevelFields` 44 → 42、逃生卡 9 → 8。

### 4.42 5c-33：额外弹药换额外揭示（1 张）

03304 吃子弹是「启动枪械攻击」窗口里的快速事件：多花 N 发弹药，本次检定额外揭示 N 个标记。

| 新增 api | 说明 |
| --- | --- |
| `api.addExtraChaosChoicesToTest(amount)` | 反应窗口里写**反应上下文**的 `extraChaosChoices`（战斗流程在窗口后读它），否则写 `skillTest`；与旧原语同一处写入 |

描述子：`played` + `fast` + `trigger: 'activateFirearmFight'`。结算顺序：先从上下文取「正在启动的那把枪」
（`assetId`，手牌触发的上下文是扁平的），拿不到就退回「第一把有弹药的枪械」；`api.choice({ kind: 'amount' })`
选 0…N 发；`api.addUses(-N)`；`api.addExtraChaosChoicesToTest(N)`。旧条目与 `eatLead` 分支已删除。

验收：`tests/phase5-migration.test.mjs` 一条（额外 1 发 → 枪械共花 2 发 → 日志出现「额外混乱标记」）；
`replay --compare` 逐条一致；`effectsEntries` 75 → 74、逃生卡 10 → 9。

### 4.41 5c-32：角色切换与替人挨打（2 张）

| 卡 | 旧原语 | 新写法 |
| --- | --- | --- |
| 03018 即兴表演 | `carcosaInvestigator.improvisation` | `played` + `fast` + `playCondition`（见下）：`api.switchRole` → `api.setRoleDiscount` → `api.drawCardsLogged` → `api.className` 写日志 |
| 03106 英勇救援 | `carcosaInvestigator.heroicRescue` | `played` + `fast` + `trigger: enemyAttack` + `criteria: { otherInvestigator, nonEliteOnly }`：读 `reactionContext().enemy` → `api.engage` → `api.enemyAttackByCard` → `api.damageEnemy` |

四个新 api：`api.switchRole`（选阵营并写 `inv.role`）、`api.setRoleDiscount`（本回合该阵营卡 -N）、
`api.className`（日志文案）、`api.enemyAttackByCard`（由卡牌造成的敌人攻击，`kind: 'effect'`，
不计入「不能攻击」开关）。

> **两处必须记住的细节**
> 1. 03018 的旧条目带 `duringOwnTurn: true`，它由 `play-condition.js` 翻译成「只能在自己的回合打出」。
>    **迁到描述子时必须显式写 `playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }]`**，
>    否则任何回合都能打出。我第一版漏了它（`replay` 抓不到，因为没有 golden 局在这个窗口打它）。
> 2. 03106 的旧原语读 `_reaction.enemyId`，而手牌触发的反应上下文只有 `enemy`（没有 `enemyId`），
>    所以这条反应**以前永远不会生效**。现在改读 `enemy`，属有意的修正。
> 3. 03018 是**调查员专属卡**（`carcosaInvestigators` 包），登记表是那里的 `implementedCodes`，
>    **不要**往 `carcosaPlayer` 的 `abilityLayerCodes` 里加——加了会让
>    `carcosa-player-acceptance` 的「effects + abilityLayer = 95」断言立刻报 96。

验收：`tests/phase5-migration.test.mjs` 两条（即兴表演换阵营 + 抽牌 + playCondition 保留；英勇救援窗口）；
`replay --compare` 逐条一致；`engineCodes` 113 → 111、`effectsEntries` 77 → 75、逃生卡 12 → 10。

### 4.40 5c-31：敌人攻击造成伤害后的反击（1 张）

04017 求生匕首的反击挂在 `enemyAttackDamage` 窗口上，旧原语读 `state._reaction.enemy`：

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| `api.isEnemyInPlay(enemy)` | `abilityApi` | 确认攻击者还在场上（同窗口里可能被别的反应清掉） |
| `api.fight(..., { noSpend: true })` | `abilityApi` | `doFight` 的第 5 个参数是「不付行动」；旧原语一直传 true，迁移后必须保留，否则每次反击都会扣行动 |

描述子：`reaction` + `legacyReaction` + `criteria: { selfOnly: true }` + `cost: { exhaust: true }`，
结算读 `api.reactionContext().enemy`（与旧原语同一个字段）→ `api.fight(attacker.id, { combatBonus: 2, damageBonus: 1, noSpend: true })`。

> **踩坑（差点算错行为）**：`enemyAttack` 里有两个 `attack` 对象——外层那个没有 `enemy`，而真正传进
> `applyHarm` 的是 `{ enemy, location }`。第一次按外层判断「这条反应是死代码」，加了个没用的
> `attacker` 字段并立刻被 `replay --compare` 用 `enemy is not defined` 抓住（7 局红）。
> 结论：**先看实际传参，不要看同名变量的定义处**。

验收：`tests/phase5-migration.test.mjs` 一条（敌人阶段被攻击后触发反击，敌人受到 +2 战斗 / +1 伤害的那次攻击）；
`replay --compare` 逐条一致；逃生卡 13 → 12（`engineCodes` 不变：该卡本来就没有引擎字面量）。

### 4.39 5c-30：附属到地点并把帷幕视为 1（1 张）

04270 骷髅钥匙有两半：附属到所在地点、以及解除附属。**后者在引擎里永远走不到**——能力长在支援身上，
附属期间它不在 `inv.assets` 里，所以 `attachedHere` 那个分支没有入口。这一批只迁能走到的那半段：

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| `api.attachSelfToLocation(card, locationId, fields)` | `abilityApi` | 把支援从场上拿下并按 `attachCardTo` 挂到地点，`fields` 原样写进附属条目 |
| `shroudAsOne` 标记 | 描述子写入，引擎 `investigate` 的难度段读取 | 「该地点帷幕视为 1」不再按卡号判断；旧条目里的 `exceptional` 是冗余字段（卡片定义本身有），随条目一起删除 |

描述子：条目级 `fast: true` + `action`（`cost: { action: true }`），结算里取所在地点、
`api.attachSelfToLocation(source, here.id, { shroudAsOne: true })` 后写一条与旧实现逐字一致的日志。

**未做**：解除附属要能「在地点附属上使用能力」，属未做机制（见 §6）；旧分支本来就不可达，因此不影响行为。

验收：`tests/phase5-migration.test.mjs` 一条（附属条目带 `shroudAsOne` / 支援离场 / 帷幕 5 的地点按 1 调查成功）；
`tests/tfa-player-acceptance.test.mjs` 的骷髅钥匙用例保持绿；`replay --compare` 逐条一致；
`engineCodes` 114 → 113、`effectsEntries` 78 → 77、逃生卡 14 → 13。

### 4.38 5c-29：研究记录与充能类型（1 张）

03025 古代雕文是一张「攒 3 个秘密、满 3 个移出游戏换 5 资源 + 记一项研究」的支援。

| 新增 api | 说明 |
| --- | --- |
| `api.recordResearch(key)` | 把「研究记录」写进战役账本（`state.campaign.records` + 每位调查员的 `research`），读点原来是引擎内部的 `recordResearch` |
| `api.setUsesType(card, type)` | 声明支援的充能类型（这里从第一次使用起改成 `secrets`） |

描述子：`action` + `cost: { action: true, discardHand: 1, discardHandIcon: 'intellect' }`，
结算顺序与旧分支一致：`addUses(+1)` → `setUsesType('secrets')` → 满 3 个时
`discardAsset`（离场 + 进弃牌堆）→ `gainResources(5)` → `recordResearch('translatedGlyphs')`。
旧条目与 `archaicGlyphs` 分支已删除。

> **踩坑**：删掉旧条目后 `content/schema.js` 立刻报「构筑开放需要玩家卡、目录收录和规则实现」——
> 忘了把这个卡号登记进 `carcosaPlayer` 的 `abilityLayerCodes`（handoff §5 第 1 条）。
> 登记后 `replay --compare` 才恢复逐条一致。

验收：`tests/phase5-migration.test.mjs` 一条（连续翻译三次 → 离场、+5 资源、写进 `campaign.records`）；
`replay --compare` 逐条一致；`effectsEntries` 79 → 78、逃生卡 15 → 14。

### 4.37 5c-28：充能支援的转移与回收（2 张）

03014 灵语人与 03015 愤怒之灵都在 `carcosaInvestigatorEffect` 里，条件都是「另一张充能支援」：

| 卡 | 旧原语 | 新写法 |
| --- | --- | --- |
| 03014 灵语人 | `carcosaInvestigator.spiritSpeaker` | `action` + `resolve`：`api.isChargeAsset` / `api.canLeavePlay` 筛候选 → `api.choice` 选支援 → `api.choice` 选模式 → `api.returnAssetToHand` 或 `api.gainResources` + `api.discardAsset` |
| 03015 愤怒之灵 | `carcosaInvestigator.angeredSpirits` | 弱点数据体（威胁区 + 充能）与 `action` 放进**同一条目**；`api.exhaust` + `api.addUses(∓1)` |

新增两个只读判定 api：`api.isChargeAsset(card)`、`api.canLeavePlay(card)`（后者就是
`!assetCannotLeavePlay`，认「不可离场」的条目级字段）。顺带删掉 `effectError` 里两条只服务
这两个原语的守卫——它们引用的效果类型已经不存在了。

验收：`tests/phase5-migration.test.mjs` 一条（灵语人换资源弃置 / 愤怒之灵转移充能）；
`tests/carcosa-investigators.test.mjs` 29/29 全绿；`replay --compare` 逐条一致；
`engineCodes` 115 → 114、`effectsEntries` 81 → 79、逃生卡 17 → 15。

### 4.36 5c-27：胜利区搬运（1 张）

03016 掩埋是「击败非精英敌人后」的快速事件，效果是把**刚被击败的敌人**和**这张事件卡自己**
一起放进胜利区。后者原来靠反应上下文里的 `eventToVictory` 字段，前者要动三个地方：

| 新增 api | 说明 |
| --- | --- |
| `api.buryEnemyInVictory(enemy, eventCode)` | 从持有者弃牌堆 / 遭遇弃牌堆取走该敌人 → 写进 `state.victoryDisplay` → 在反应上下文里置 `eventToVictory = eventCode`（处置段据此把事件卡也放进胜利区）→ 写日志 |

描述子：`played` + `fast` + `trigger: 'defeatEnemy'` + `criteria: { nonElite: true }`，
结算只读 `api.reactionContext().enemy` 再调上面那个 api。旧条目（`carcosaInvestigators` 的
`signatureEffects['03016']`）与 `buryThemDeep` 分支都已删除。

验收：`tests/phase5-migration.test.mjs` 一条（击败 1 血敌人 → 窗口里打出掩埋 → 敌人与事件卡都进胜利区、
事件卡不进弃牌堆）；`replay --compare` 逐条一致；`engineCodes` 116 → 115、`effectsEntries` 82 → 81、
逃生卡 18 → 17。

### 4.35 5c-26：先选敌人再按指定技能躲避（1 张）

03268 暗示的主动能力（横置、用意志代替敏捷躲避）原来走 `carcosaPlayer.suggestionEvade`：

```js
doEvade(state, seat, { enemyId: chooseEnemy(state, seat, {}).id, addSkill: 'willpower', suggestionAssetId: asset?.id }, events, true)
```

迁移时发现**这条原语一用就抛错**：`chooseEnemy(state, seat, {})` 把空 effect 传给
`abilityTargets`，而 `abilityTargets` 只认 `dealDamage` / `fight` / `evade` 三种形态，
空对象恒返回 `[]` → 抛「没有合法敌人目标」。也就是说这张卡的主动能力从来没有真正可用过。

处理：先补一个通用 api，再按躲避的目标形状选目标，并先挡掉无目标的情况。

| 新增 api | 说明 |
| --- | --- |
| `api.chooseEnemy(seat, effect)` | 「先问玩家选一个敌人」的薄包装；`effect` 决定候选集合（与 `effectError` / `validateMove` 同一份 `abilityTargets`） |

描述子：`api.enemiesAt` 先确认有交战中的敌人（没有就只写一条日志，不再抛错）→
`api.chooseEnemy(inv.seat, { type: 'evade' })` → `api.evade(..., { addSkill: 'willpower', suggestionAssetId })`。
这是本阶段**第一次有意修掉卡的功能性 bug**（旧路径必抛错，因此不可能出现在任何 replay 里，
`--compare` 仍逐条一致）。

验收：`tests/phase5-migration.test.mjs` 一条（选目标 → 意志躲避 → 敌人横置、卡片横置）；
`replay --compare` 逐条一致；逃生卡 19 → 18（`engineCodes` 不变：这张卡本来就没有引擎字面量）。

### 4.34 5c-25：检定 + 「本局一次」标记（1 张）

04191 古代遗物要三件引擎原来不提供的东西，这一批全部补成通用 api：

| 新增 api | 说明 |
| --- | --- |
| `api.gameFlag(seat, key)` / `api.setGameFlag(seat, key, value)` | 调查员级的「本局一次」标记（写在 `inv.gameFlags`，随存档往返），替代原来卡号化的 `inv.tfaRelicDoomSuccess` |
| `api.doom()` | 当前密谋上的毁灭数（写日志要读「当前值」） |
| `api.removeDoom(amount)` | 移除毁灭并返回实际移除数（调用方据此决定打哪条日志） |

结算顺序与旧 handler 一致：先查「本局成功过」→ 选意志/智识 → `api.startTest`（难度 4）→
成功时置标记 + 移除毁灭（没有可移除的也打日志），失败时 `api.placeDoomOnCard` 在遗物上放 1 个毁灭。
旧条目与 `relicDoom` 分支已删除，`tfa-p2-hooks` 里那条断言随之从裸字段改成 `gameFlags`。

验收：`tests/phase5-migration.test.mjs` 一条（成功移除 / 标记写入 / 第二次不再生效）；
`tests/tfa-p2-hooks.test.mjs` 的 04191 用例（三种分支）保持绿；`replay --compare` 逐条一致；
`engineCodes` 117 → 116、`effectsEntries` 83 → 82、逃生卡 20 → 19。

### 4.33 5c-24：打出后变成场上卡 + 封印标记（1 张）

04199 危险预感踩了三个「打出后去向」的点，这一批把它们一起补成声明式读点：

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| `becomesAsset` / `exileAfterPlay` / `addToVictory` 三字段 | `ability.js` 的 `DESCRIPTOR_KEYS` / `ENTRY_KEYS` + 描述子与条目的归一化 + `doPlay` 的 disposal | 「打出后去向」既可以写 `played` 描述子、也可以写条目级，旧 DSL 仍优先 |
| 条目级 `substituteSealedToken` | `ENTRY_KEYS` + 归一化 + `tfaBeforeChaosReveal` 的判据 | 「封印标记替代本次结算」不再按卡号判断 |
| 三个新 api | `putSelfIntoPlay`（自身放置入场）、`sealRandomChaosToken`（随机封印一个标记）、`tokenLabel`（标记文案） | 结算全部走 `ctx.api`，随机仍走 `randomValue` |

状态字段同时从卡号化的 `tfaSealedToken` 改成通用的 `sealedToken`（`tfa-player-acceptance` 里那条断言同步改名）。
旧条目与 `premonition` 分支已删除，`TFA_PLAYER_WAVE3_ACTIONS` 也摘掉了这一项。

> **踩坑**：`becomesAsset` 写在描述子上时，只加 `DESCRIPTOR_KEYS` 不够——归一化后的描述子对象也要带上
> 这三个字段，否则 `doPlay` 的 `playedFlags.becomesAsset` 永远是 false，卡片会被错误地弃掉。
> 5c-24 的门禁用例正是这样抓到的。

验收：`tests/phase5-migration.test.mjs` 一条（条目声明 + 进入场上 + 封印标记 + 不进弃牌堆）；
`tests/tfa-player-acceptance.test.mjs` 的 premonition 用例（替代结算 + 弃置）保持绿；
`replay --compare` 逐条一致；`engineCodes` 118 → 117、`effectsEntries` 84 → 83、逃生卡 21 → 20、
`effectsTopLevelFields` 46 → 45。

### 4.32 5c-23：遭遇牌库检索（1 张）

03263 追猎是「刚抽到遭遇卡时」的快速事件，结算要读**遭遇牌库顶 9 张**并从中生成一名敌人：

| 新增 api | 说明 |
| --- | --- |
| `api.encounterEnemies(count)` | 遭遇牌库顶 N 张里的敌人候选（只读、顺序与旧实现一致：数组末位是牌库顶） |
| `api.spawnEncounterEnemy(seat, code)` | 从遭遇牌库取走一张、洗回牌库，在该座位所在地点生成并交战 |

旧实现的三个细节都保留：没有敌人候选时回落成「正常抽一张遭遇卡」（`api.drawEncounter`）；
候选只有 1 个时不询问；询问的 `id` 是候选下标而不是牌库下标。旧条目与 `onTheHunt` 分支已删除，
卡包 `abilityLayerCodes` 已登记。

验收：`tests/phase5-migration.test.mjs` 一条（候选只列遭遇牌库顶的敌人 / 只生成一名 / 生成在所在地点并交战 /
牌库少一张）；`replay --compare` 逐条一致；`engineCodes` 119 → 118、`effectsEntries` 85 → 84、逃生卡 22 → 21。

### 4.31 5c-22：反应窗口里的快速事件（1 张）

03150 预警是「遭遇卡抽到后、结算前」的快速事件（`fast: true` + `reaction: { when: 'encounterDrawn' }`）。
5c-8 已经把这条通道接进能力层（`played` + `fast` + `trigger`，条件写在 `criteria` 的旧字段里），
所以这批只差结算本身：

| 新增 api | 说明 |
| --- | --- |
| `api.spendClueToLocation(seat, amount)` | 花个人线索并把它放回所在地点（三处写入与旧 handler 逐字一致：个人线索 −N、`state.clues` −N、地点线索 +N） |

描述子：`fast` + `trigger: 'encounterDrawn'` + `criteria: { nonWeaknessOnly: true, treacheryOnly: true }`，
结算只有两步——`api.spendClueToLocation` 与 `api.cancelCurrentAttack()`（置 `state._reaction.cancelled`，
与旧 handler 的 `state._reaction.cancelled = true` 同一个字段）。**不写日志**：旧 handler 就没有日志，
而日志进指纹。旧条目与 `forewarned` 分支都已删除，卡包 `abilityLayerCodes` 已登记。

验收：`tests/phase5-migration.test.mjs` 一条（诡计遭遇窗口里可打出 / 线索回到地点 / 诡计被弃置而不是进威胁区）；
`tests/carcosa-implementation-gaps.test.mjs` 原有的「敌人遭遇卡时不可打出」仍绿；
`replay --compare` 逐条一致；`effectsEntries` 86 → 85、逃生卡 23 → 22。

### 4.30 5a-5：卡号分支 → 条目级被动标记（1 个码）

03010 缜密分析是「卡号 → 行为」的典型：引擎里有两处认卡号。

| 位置 | 原来 | 现在 |
| --- | --- | --- |
| 投入卡牌后「横置抽 1 张」 | `owner.assets.find(a => a.code === '03010' && !a.exhausted)` | `registeredEntry(asset.code)?.passive?.analyticalMind` |
| 「其他地点调查员的检定可以远程投入」 | `other.code === '03002' && other.assets.some(a => a.code === '03010')` | `other.assets.some(a => registeredEntry(a.code)?.passive?.remoteCommit)` |

两条读取都走同一个条目（`MIGRATED_CARD_RULE_ENTRIES_5A5`），旧条目（`carcosaInvestigators` 的
`signatureEffects['03010']`）已删除。第二处的 03002 条件是「这张卡只属于潘明」的同义表达，
改成「控制着带 `remoteCommit` 标记的支援」后语义等价（卡面原文就是缜密分析授予远程投入）。

验收：`tests/carcosa-investigators.test.mjs` 的 C1 用例（远程投入 + 横置抽牌 + JSON 幂等）保持绿；
`tests/phase5-migration.test.mjs` 追加一条注册表断言；`replay --compare` 逐条一致；
`effectsEntries` 87 → 86、`effectsTopLevelFields` 47 → 46、`legacy` 60 → 59。**`engineCodes` 不变**
（03010 仍以 `requestChoice({ source: '03010' })` 的形式留着一个 `reference` 计数，属 Phase 6 文案批次）。

### 4.29 5c-21：以折扣打出另一张牌（1 张）

03033 解锢灵魂的旧 handler 不只是「选一张法术然后打折」——它先筛掉**打出去没有合法目标**的法术
（需要敌人目标的战斗/躲避事件在没有敌人时不能当候选，否则选中后白打一张）。这一步要一个同源读点：

| 新增 api | 说明 |
| --- | --- |
| `api.cardHasLegalTarget(seat, code)` | 这张牌现在打出去有没有合法目标；与 `effectError` / `validateMove` 用的是同一份 `abilityTargets`，没有目标要求时恒为真（与旧 handler 的判定一致） |

描述子只做三件事：`api.cardTraits` 筛法术/仪式 → `api.choice` 选牌 →
`api.playCard(chosen, { discount: 3, noAction: true })`（旧写法是 `inv.carcosaPlayDiscount = 3` + `doPlay(..., false, true)`，
`api.playCard` 内部就是这两步）。旧条目与 `uncageTheSoul` 分支都已删除，卡包 `abilityLayerCodes` 已登记。

验收：`tests/phase5-migration.test.mjs` 一条（候选只列法术 / 费用被压到 0 / 不额外花行动）；
`replay --compare` 逐条一致；`engineCodes` 120 → 119、`effectsEntries` 88 → 87、逃生卡 24 → 23。

### 4.28 5c-20：条目级打出限制 + 两区查找（1 张）

04010 走私货物的旧条目带 `playRestriction: 'noReadyEnemy'`，**不能**改写成 `playCondition`：
`legalMoves` 只用 `cardPlayBlockedReason` 过滤手牌、**不检查** `playCondition`，改写法会让这张卡在
"有未横置敌人"时出现在合法动作里（AI 一走就非法）。所以先补读点、再迁卡：

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| 条目级 `playRestriction` / `teamLimit` | `ability.js` 的 `ENTRY_KEYS` + 注册表归一化 | 与 `uses`/`fast` 同层，迁移后不必保留旧条目 |
| 读点回落 | `engine.js` 的 `cardPlayBlockedReason` | 先读条目、再回落 `EFFECTS`（两条通道同一处判定，`legalMoves` 与 `validateMove` 同源） |

04010 的结算搬进 `played` + `resolve`：`api.cardTraits` 筛[[违法]] → `api.choice` 选区域 →
弃牌堆走 `api.moveCard({ from: 'discard', to: 'hand' })`，牌库顶走
`api.searchTop({ amount: 9, trait: 'Illicit', traitZh: '违法', mandatory: true })`。
旧条目（`content/packs/tfaInvestigators/manifest.js` 的 `signatureEffects`）与引擎的 `smuggledGoods`
分支都已删除，随之失去引用的局部助手 `illicitTrait` 也一并清掉。

验收：`tests/phase5-migration.test.mjs` 三条（打出限制挡在合法动作外 / 弃牌堆找回违法卡 / 没有违法卡时只给牌库顶）；
`replay --compare` 逐条一致；`engineCodes` 121 → 120、`effectsEntries` 89 → 88、逃生卡 25 → 24。

### 4.27 5c-19：`entersPlay` 的 resolve 读点与牌库顶附属（2 张）

这一批先把**入场钩子**补成「数据体或 resolve」二选一（与弱点 resolve 同形），再迁两张卡：

| 卡 | 旧原语 | 新写法 | 删掉的引擎实现 |
| --- | --- | --- | --- |
| 04021 爱丽·霍洛维兹博士 | `tfaPlayer.horowitzSearch`（`entersPlay` 数据体） | `entersPlay` + `resolve`：`api.topDeckCodes` → 筛[[遗物]] → `api.choice` → `api.attachCardFromDeck` → `api.shuffleDeck` | `horowitzSearch` 分支 |
| 03158 求助盟友 | `carcosaPlayer.callingInFavors` | `played` + `resolve`：`api.returnAssetToHand` + `api.searchTop` + `api.playCard`（折扣 = 返回那张的费用） | `callingInFavors` 分支 + 随之失去引用的局部 `chooseAsset` 助手 |

接线（这是本批"能力"部分，不是迁卡）：

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| `entersPlay` 允许只带 `resolve` | `ability.js` 的 `LIFECYCLE_RESOLVE_KINDS`（`played` / `entersPlay`） | 效果 DSL 表达不了时由 resolve 接管；`commit`/`weakness`/`leavesPlay` 仍要求数据体 |
| 入场段的 resolve 优先 | `engine.js` 的 `doPlay` 资产入场 | 先看描述子有没有 `resolve`，没有才走 `resolveEffect(entersPlayEffect(…))`；读点仍是 lifecycle |

新增四个薄包装：`topDeckCodes`（只读牌库顶 N 张）、`attachCardFromDeck`（从牌库取一张附属到支援）、
`shuffleDeck`、`returnAssetToHand`（离场钩子照常结算）。

验收：`tests/phase5-migration.test.mjs` 两条（04021 的遗物被附属 / 03158 的盟友回到手牌再免费打出）；
`tests/card-lifecycle.test.mjs` 里「04021 的 entersPlay 数据体」那条断言改成**resolve 型读点**。
`replay --compare` 逐条一致；`engineCodes` 123 → 121、`effectsEntries` 90 → 89、逃生卡 27 → 25。

### 4.26 5c-18：最后一批「纯 handler」逃生原语（5 张）

这五张卡在 5b/5c 早期就把**数据**搬到了描述子，但效果体仍是
`{ type: 'carcosaPlayer'|'tfaPlayer', action: '…' }`——引擎里那段 `effect.action === '…'` 就是它的实现
（handoff §5 第 5 条：这类分支不是死代码）。5c-18 按正确顺序做：**先写 `resolve`，再删分支**。

| 卡 | 旧原语 | 新写法 | 删掉的引擎分支 |
| --- | --- | --- | --- |
| 03024 田野调查 | `carcosaPlayer.fieldwork` | `api.phaseTestBonus(inv.seat, 2)` | `fieldwork` |
| 03195 扒手 | `carcosaPlayer.pickpocketing` | `api.reactionContext()` + `api.choice` + `api.drawCardsLogged` / `api.gainResources` | `pickpocketing` |
| 03305 阿登森林护甲 | `carcosaPlayer.armorArdennes` | `api.cancelDamage(1)` | `armorArdennes` |
| 04158 追忆未来 | `tfaPlayer.recallTheFuture` | `api.nameChaosToken(inv.seat, { asset: source })` | `recallTheFuture`（同时从 `TFA_PLAYER_WAVE3_ACTIONS` 摘除） |
| 04159 再试一次 | `tfaPlayer.tryAndTryAgain` | `api.recallCommittedSkill(inv.seat, { source: '04159' })` | `tryAndTryAgain`（同上） |

五个新包装都只是「已有引擎入口的别名」，内容层仍然不碰 state：

| 新增 api | 说明 |
| --- | --- |
| `api.phaseTestBonus(seat, amount)` | 本阶段下一次技能检定 +N（读点仍是 `performTest` 的 `inv.fieldwork`，字段名沿用旧原语） |
| `api.drawCardsLogged(seat, amount)` | 「抽 N 张」并把引擎的抽牌日志写进事件流——`api.drawCards` 会丢掉那几行，而它们进 `state.log`（= 进指纹） |
| `api.cancelDamage(amount)` | 取消正在分配的伤害（优先写 `reaction.context.cancelDamage`，与旧分支同一接线点） |
| `api.nameChaosToken(seat, { asset })` | 检定开始时指定一个混乱标记；命中后横置 +2 仍由引擎的标记揭示段处理 |
| `api.recallCommittedSkill(seat, { source })` | 把本次检定投入的一张自己的技能牌收回手牌（询问来源与文案与旧 handler 逐字一致） |

验收：`tests/phase5-migration.test.mjs` 的 5c-18 四条（逃生前缀消失 + 田野调查 +2 + 扒手二选一/日志）；
04158 / 04159 的完整流程在 `tests/tfa-player-acceptance.test.mjs`，03305 在
`tests/carcosa-implementation-gaps.test.mjs`（都已在 `fast` tier）。
`replay --compare` 逐条一致；`engineCodes` 126 → 123、逃生卡 32 → 27、descriptor 363 → 368。

### 4.25 5c-17：手铐（1 张）

新增 `api.attachSelfTo(code, enemyId)`：把这张支援从场上拿下（保留其附属）并挂到敌人身上，
同时横置敌人、脱离交战——与引擎里的写法逐字一致。

04265 的描述子现在完整表达：同地点人形敌人筛选 → 战斗检定（难度 = 敌人躲避值）→ 成功则铐住。
`countsAs: 'evade'` 保持"不引发借机攻击"的旧语义。旧条目与引擎分支都已删除。

### 4.24 5c-16：发掘古物（1 张）

| 新增 api | 说明 |
| --- | --- |
| `api.cardCost(code)` | 卡面费用（检定的难度用） |
| `api.putAssetIntoPlay(seat, code)` | 从手牌移除一张支援并直接放置入场（不付费用） |

04024 的整段结算（筛选探求者支援 → 智识检定 → 放置入场 → 遗物再抽 1 张）现在全在描述子里，
引擎分支与旧条目都已删除。

### 4.23 5c-15：弃牌堆招募与检定加成（2 张成功 / 1 张回退）

| 卡 | 状态 | 说明 |
| --- | --- | --- |
| 03238 幸运邂逅 | ✅ 已迁 | `api.recruitAllyFromDiscard` + 删引擎分支 + 删旧条目 + 卡包登记 |
| 04156 挥金如土 | ✅ 已迁 | `api.addTestPendingBonus(2)` + `api.addExtraOnSuccess({ type: 'gainResource', amount: 3 })` |
| 03189 我会在地狱里见你 | ⏸ 回退 | 描述子与引擎分支仍有细微差异（三局 replay 全红），保留原实现；新增的 `api.lethalSelfDamage` 留着备用 |

**这轮的顺序经验**：先写描述子 → 删旧条目 → 删引擎分支 → 跑 replay；03189 在第二步之后就已经不一致，
说明差异来自结算本身（`defeatedBy` / 创伤 / 致命伤害的写法），不是接线问题。

### 4.22 5c-14：连续打出与免费放置（2 张）

| 新增 api | 说明 |
| --- | --- |
| `api.playCost(seat, code)` | 读打出费用（含折扣预览） |
| `api.cardName(code)` / `api.cardTraits(code)` | 卡面读数（提示文案与特质筛选） |
| `api.markSleightOfHand(code)` | 给刚入场的支援打「障眼戏法」标记 |

| 卡 | 改法 |
| --- | --- |
| 03023 时刻警惕 | 循环 3 次：`api.choice` 选手牌 → `api.playCard(code, { discount: 1, noAction: true })` |
| 03029 障眼戏法 | `api.choice` 选物品 → 免费 `api.playCard` → `api.markSleightOfHand` |

两张卡的旧条目已删、卡包已登记（否则旧逃生原语仍会生效）。

### 4.21 5c-13：通用检定 api（2 张）

| 新增 | 说明 |
| --- | --- |
| `api.startTest({ skill, difficulty, seat, source, skillBonus, peril, resolve })` | 内容层自己发起检定并给"成功之后"的闭包 |
| `api.handSize(seat)` / `api.applyHorror(seat, n)` | 手牌上限与直接恐惧（养神术的溢出惩罚） |

| 卡 | 改法 |
| --- | --- |
| 03032 炼金转化 | `api.startTest` + `api.gainResources` + `api.harm` |
| 04267 养神术 | `api.startTest` + `api.drawCards` + `api.handSize` + `api.applyHorror` |

**踩到的坑**：`abilityApi` 里早就有 `test(seat, skill, difficulty, options)`，我新增的 `test(spec)` 把它覆盖了，
导致一批不相关的卡片检定全部失败——改名为 `startTest` 后恢复。教训：给 api 加方法前先 `grep` 同名键。

### 4.20 5c-12：秘籍与临时屏障（2 张）

| 卡 | 改法 | 删掉的引擎实现 |
| --- | --- | --- |
| 04307 秘籍 | 主动：`api.skipNextTestTokens(seat)`（**下一次**检定）；反应：`api.skipTestTokens()`（本次检定） | `pnakoticNextTest` / `pnakoticSkipTest` 两段 |
| 04312 临时屏障 | `played` 描述子 + `api.evade(..., { evadeModifier: -1, evadeSecondUpTo })` + `api.fromDiscardCode()` | `impromptuBarrier` |

这轮又抓到一处语义细节：秘籍的两段能力**不是同一个效果**（"下一次"vs"本次"），一开始用一个 api 代替导致验收失败，
拆成 `skipNextTestTokens` / `skipTestTokens` 后恢复。

### 4.19 5c-11：逃生原语改写（2 张，真正的"删分支"）

第 17 轮的教训是「逃生通道的引擎分支不是死代码」。这批按正确顺序做：**先把条目里的
`effect: { type: 'tfaPlayer', action: … }` 换成 `resolve`，再删引擎分支**。

| 卡 | 改法 | 删掉的引擎实现 |
| --- | --- | --- |
| 04197 奥利芙·麦克布莱德 | `api.planTestReveal({ count: 3, choose: 2, source: '04197' })` | `effect.action === 'oliveMcBride'` + 调度清单项 |
| 04200 学无止境 | 新 api `api.retryLastFailedTest(cardLabel, skillBonus)` | `effect.action === 'liveAndLearn'` + 调度清单项 |

两张卡的 `escape` 通道消失（44 → 42），条目里不再有逃生原语。

### 4.17 5a-2 / 5a-3：卡号分支第一次真正搬出引擎（4 个码）

前两批 5a 只删死分支；这两批开始把**仍然活着**的卡号分支搬到内容层：

| 批 | 卡号 | 做法 | 读点 |
| --- | --- | --- | --- |
| 5a-2 | 01101 / 01102 / 01103 | 敌人型基础弱点的关键词表（猎手 / 猎物 / 强制毁灭 / 谈判费用）搬到 `src/cards/card-rules.js` 的 `ENEMY_WEAKNESS_EXTRA` | 引擎改为 `enemyWeaknessExtra(code)`；`01103` 的「清空调查员文本」改成 `isTextBlankEnemy(code)` 数据标记 |
| 5a-3 | 02088 | 「清空盟友卡面文本」搬到 `BLANKS_TRAITS` | 引擎改为 `blanksTraits(code).includes('ally')` |

这样 `engine.js` 里不再出现这 4 个卡号，而行为完全不变（replay 逐条一致）。
留下的一类是 `requestChoice({ source: '0xxxx' })` 的**来源标签**——它们会进状态指纹，属于"改法会变行为"，
归到 Phase 6 与 UI 文案一起处理。

### 4.16 5b-11：耗尽自愈 + 被动与反应组合（5 张）

| 卡 | 声明 |
| --- | --- |
| 04025 挑夫 | `forcedUpkeepPayOrDiscard` + `stats` |
| 04147 伊塔卡 | `exhaustOnEnemyDefeatedHealHorror` + `stats` |
| 03313 报纸（2） | 被动 `investigateBonusIfNoClues` + `legacyReaction`（发现线索时额外 1 个） |
| 04008 杰克·威廉斯 | 被动 `noOpportunityFirstAction` + `legacyReaction`（地点揭示后横置抽 1） |
| 04023 埃兹特利之牙 | 被动 `treacheryTestStats` + `legacyReaction`（诡计检定成功后横置抽 1） |

新增条目字段 `exhaustOnEnemyDefeatedHealHorror` 与读点回落；`reactions` 组只剩 2 张已知问题卡。

### 4.15 5b-10：封印与附属（5 张）

`sealOnEnter` / `substituteSealedElderSign` / `attachTo` / `onAttach` 成为条目级字段。这批的关键是读点：

| 读点 | 改动 |
| --- | --- |
| `doPlay` 的资产入场 | `eff` 合并条目级 `sealOnEnter`（04013/04235 的入场封印） |
| `attachTo` 的附属判定 | `EFFECTS[...]?.attachTo` → 条目回落（04019/04020/04193） |
| `onAttach` 的加值 | 同上（04193 的 +2 弹药） |
| `codexSealedElderSign` / `assetCapacityValue` | 替换旧印与宿主生命/神智也认条目 passive |

### 4.14 5b-9：规则性字段搬到条目（6 张）

`healSelfHorrorAfterTurn` / `forcedUpkeepPayOrDiscard` / `defeatedDamage` / `redirectOneHorrorToSelf` / `cannotLeavePlay`
五个字段成为条目级字段，`assetEffect` 合并；三处直接读 `EFFECTS[code]` 的地方（被击败反伤两处、`assetCannotLeavePlay`）补注册表回落。

| 卡 | 字段 |
| --- | --- |
| 02027 雇佣打手 / 04025 挑夫 | `forcedUpkeepPayOrDiscard` + `stats` |
| 02033 / 02035 彼得·希尔维斯特 | `healSelfHorrorAfterTurn` + `stats` |
| 02106 弟兄塞维尔 | `defeatedDamage` + `assignHarmAtLocation` + `stats` |
| 03315 神圣先知 | `redirectOneHorrorToSelf` + `statsPerAssetHorror` |
| 03009b 邪教徒（剧情签名弱点） | `cannotLeavePlay` + 四项 `-1` |

### 4.13 5b-8：被动数据体搬到条目（20 张）

两批：`5b-8a` 纯被动 15 张、`5b-8b` 被动 + 主动能力 5 张。`passive` 整块搬到条目（过渡方案），
同时把四处「遗留桥接」改成同源读点，否则被动会静默失效：

| 读点 | 改动 |
| --- | --- |
| `modifiers.legacyStatDelta` | `EFFECTS[code].passive` → 条目回落（`getStat` 的属性加成） |
| `doPlay` 的资产入场 | `extraAction` / `onPlayDoom` 等改为合并条目 passive |
| `assetEffect` | 合并条目级 `fast` / `noOpportunityAttack`（01055 的能力不引发借机攻击靠它） |
| `assignDirectHarm` / `noOpportunityFirstAction` 判定 | 统一走 `assetPassiveData(code)` |

一次回退：03143 是**剧情资产**（eotp 遭遇卡），不属于玩家卡包；已恢复旧条目并从 `carcosaPlayer` 撤回登记，
它的迁移要等非玩家卡通道（`encounter-abilities`）。

### 4.11 5c-10：从弃牌堆打出 / 打出后去向（3 张）

这批把旧 DSL 的两个顶层字段搬进描述子：`playableFromDiscard`（能不能从弃牌堆打出）与
`shuffleBackAfterPlay` / `removeAfterPlay`（打出后洗回牌库 / 移出游戏）。读点：`playAccess()` 与 `doPlay` 的收尾段。

| 卡 | 字段 | 结算 |
| --- | --- | --- |
| 03196 量子通量 | `removeAfterPlay` | `api.shuffleDiscardIntoDeck` + `api.drawCards(1)` |
| 04033 临时武器 | `playableFromDiscard` + `shuffleBackAfterPlay` | `api.fromDiscardCode()` 判定来源，`api.fight(..., { enemyFightMod: -1 })` |
| 04272 应急处理 | 同上 | `api.investigate({ shroudMod: -1, clueBonus })` |

新增两个 api：`fromDiscardCode()`（当前这张牌的来源）与 `shuffleDiscardIntoDeck(seat)`。

### 4.12 5b-6d：被动 + 反应（2 张）

02020（手牌上限 +2）与 03269（意志/智识 +1、理智 -2、弃置自身治愈恐惧）的 `passive` 整块搬到条目级字段
（`assetEffect` 合并、`scoreCard` 与图鉴同步读点）。**这是过渡方案**：5b-8 会把这些键逐个换成 `modifiers` 目标，
现在先保证 `EFFECTS` 条目消失且行为/牌组不变。

### 4.9 5c-9：TFA 反应窗口事件（5 张）

| 卡 | 新包装 | 行为 |
| --- | --- | --- |
| 04028 你来处理 | `api.redirectEncounterTo(seat)` | 自己的遭遇卡改由别人接手，并获得 1 资源 |
| 04032 黑暗预言 | `api.planTestReveal({ count, choose, symbolOnly })` | 本次检定改为揭示 5 个标记选 1 个 |
| 04034 狗屎运 | `api.shuffleEnemyToEncounterTop(enemy)` | 刚躲避失败的非精英敌人放回遭遇牌库顶 |
| 04104 枪法如神 | 既有 `api.fight`（可打连接地点） | 忽略冷漠与反击，未交战目标 +1 伤害 |
| 04202 勇斗异劫 | `api.stat` + `api.addExtraChaosChoices` | 额外揭示「难度-属性」数量的标记 |

### 4.10 5b-7：天赋牌（15 张）+ 一条新的迁移纪律

`freeTriggers`（「花 1 资源，本次检定 +N」这类天赋）原本是 `EFFECTS[code].freeTriggers`，读点在
`applyFreeTriggers` 一处。这批把数组搬到**条目级字段**（`freeTriggers` / `minimumHandForBoost` / `composure`），
由 `assetEffect` 合并两条通道——15 张卡的数据逐字保留，评分口径（`scoreCard`）与沉静（分配恐惧时必须优先给它）同步改读点。

| 卡 | 字段 |
| --- | --- |
| 01017 / 01034 / 01049 / 01062 / 01077 | 两组 `+1` 天赋（core） |
| 02187 / 02189 / 02191 / 02193 | Dunwich 天赋（`+2`/`+3`、毁灭代价、`minimumHandForBoost`） |
| 03035 | 灵力祭祀刀：`Spell` 检定 +2 + 主动攻击能力 |
| 03107 / 03109 / 03111 / 03113 / 03115 | 五张「沉静」天赋（`fast` + `composure`） |

**纪律（新增守卫）**：迁走的卡必须登记进卡包的 `abilityLayerCodes`，否则包的 `deckbuilding` 变 false、
自动牌组池少一张、开局牌组与 replay 基线都会变。`tests/architecture-guard.test.mjs` 现在有一条用例专门检查这件事——
这一轮正是被它抓住的：恢复丢失的 02025 时忘了登记，`notz-strict-random-3p` 的第 9 步（hubAutoDeck）立刻不一致。

### 4.8 5c-8：反应窗口的快速事件（能力接线 + 3 张）

上一轮 03314 的回退暴露了缺口：**事件卡在反应窗口打出**（旧条目 `fast: true, reaction: { when }`）
由 `reactionWindow` 读 `EFFECTS[code].reaction` 枚举，能力层的 `played` 描述子没有这条接线。这批把它补上：

| 改动 | 位置 | 作用 |
| --- | --- | --- |
| 描述子允许 `played` + `fast` + `trigger` | `ability.js` 的校验 | 快速事件声明自己能在哪个窗口打出 |
| 候选枚举合并 | `reactionWindow` | 同一张手牌先看旧 `reaction`，再看 `fast` 描述子的 `trigger`；条件用同一份 `criteria` 旧字段 |
| 结算分支 | `playReactionCard` | 有描述子就走 `executeDescriptor`（`alreadyPaid`：费用与「快速打出」日志已在上面写过，`silent` 不再重复打日志） |
| 新 api | `reactionContext` / `redirectEncounter` / `cancelCurrentAttack` / `prepareEvadeBonus` | 反应窗口里能改的三件事：接手的座位、取消攻击、下一次躲避加值 |

迁移的三张：

| 卡 | 旧形态 | 新写法 |
| --- | --- | --- |
| 03022 我来处理 | `fast + reaction{encounterDrawn, otherInvestigator, nonPerilOnly}` | `played` + `fast` + `trigger` + `criteria` + `api.redirectEncounter` |
| 03267 窄路逃生 | `fast + reaction{opportunityAttack, selfOnly}` | `played` + `fast` + `trigger` + `api.cancelCurrentAttack` / `api.prepareEvadeBonus` |
| 03314 内讧 | `fast + reaction{enemyPhaseBegins}`（上一轮回退的那张） | `played` + `fast` + `trigger` + `api.preventNonEliteAttacks` |

验收：`carcosa-implementation-gaps` 里 03314 的用例重新变绿；`replay --compare` 仍逐条一致。

### 4.5 5c-5：Carcosa / TFA 移动、战斗与治疗（5 张）

| 卡 | 旧原语 | 新写法 | 删掉的引擎分支 |
| --- | --- | --- | --- |
| 03034 星界旅行 | `carcosaPlayer.astralTravel` | `played` + `api.moveInvestigator` + `api.random` 抽标记 + `api.discardAsset` / `api.damage` | `astralTravel` |
| 03153 灵魂风暴 | `carcosaPlayer.stormOfSpirits` | `played` + `api.fight`（skill: willpower） | `stormOfSpirits` |
| 03197 充能 | `carcosaPlayer.recharge` | `played` + 目标选择 + `api.addUses(3)` / `api.discardAsset` | `recharge` |
| 03237 伏击 | `carcosaPlayer.waylay` | `played` + `api.test(agility, api.enemyEvade)` + `api.defeatEnemy` | `waylay` |
| 04304 煤油 | `tfaPlayer.kerosene` | `action` + `api.healHorror` / `api.addAssetHorror(-2)`（筛选用 `api.cardSanity`） | `kerosene` |

这批新增两个薄包装：`api.enemyEvade`（敌人当前躲避值）与 `api.cardSanity`（卡面恐惧上限）；
同时验证了「旧原语里的符号标记代价」可以按卡各写一次，不需要共享闭包。

---

## 5. 门禁证据

采集环境：Windows / Node 24.19，仓库内既有失败按 Phase 0/4 记账（不是本阶段引入）。

| 门禁 | 结果 |
| --- | --- |
| `node tools/replay-fixtures.mjs --check` | ✔ 10 局 / 529 步 / 530 个逐步指纹全部一致（迁移前基线见 §5.1） |
| `node tools/replay-fixtures.mjs --compare artifacts/replay-before.json` | ✔ 每批都跑过：与迁移前基线逐条一致（5b-1…5b-8、5b-10…5b-14、5c-1…5c-39、5a-1…5a-5） |
| `node tools/audit-abilities.mjs --check` | ✔ 两份账本 + 两份白名单与实现一致（白名单只收缩：EFFECTS 57 项、engine 码 101 项） |
| `node --test tests/architecture-guard.test.mjs` | ✔ 10/10（含死分支守卫与「卡包登记完备」两条） |
| `node tools/migrate-card.mjs --verify` | ✔ 59 个批次全部「旧条目已删 + 能力层有条目」 |
| `node tools/audit-dead-primitives.mjs --check` | ✔ 35 个旧原语分派点，0 个死分支（架构守卫同时校验） |
| `npm run test:fast` | 7 条既有失败（Phase 0 记账：`rules-n3` 5、`campaign-http-n4` 1、`checkpoint-rewind` 1；原第 8 条 `03310` 已随 5c-36 修好）；**新增 0 条** |
| `npm run test:slow` | 11 条既有失败（Phase 4 记账：`campaign-n4` 8、`notz-n4` 1、`dunwich-rules` D9 1、`p2-hub-http` 1）；新增 0 条 |
| `npm run test:assets` | 4 条既有失败（`import-cards` 的 N1 输出稳定性与只读导入 2 条、`presentation-http` 的「胆量」卡背 1 条、`p6-content` 的失败/撤退轨迹 1 条——后者的 `campaignResult` 结局与 Phase 4 golden 基线一致，是记账中的既有漂移）；新增 0 条 |
| 战役验收 | `core-ledger` / `carcosa-all-card-ledger` / `carcosa-player-acceptance` / `tfa-*` 全绿（验收账本的证据文件哈希随测试改动一起重算） |

### 5.1 迁移前后怎么证「行为零变化」

每条批次都按路线 §7 的命令执行：

```powershell
node tools/replay-fixtures.mjs --baseline ..\..\artifacts\replay-before.json   # 迁移前（本次：381/529 步…见下）
# …迁卡…
node tools/replay-fixtures.mjs --compare  ..\..\artifacts\replay-before.json   # 迁移后
```

本次的基线采集于 Phase 5 开工前（10 局 / 529 步 / 4 战役 / 5 关卡 / 3 种 uiState）。
所有批次对比都输出「与基线逐条一致（行为零变化）」；四次漂移被门禁抓住并修掉，
记录在 §5.2——这些正是「只改读点不改行为」的边界。

### 5.2 被 replay 门禁抓住的两个坑（已修）

1. **自动牌组换人**：`dunwichSupport` 的 `02021` 迁走后，包清单的「有行为实现」判定失效，
   `expansionPlayerCodes` 少 1 张 → 自动构筑牌池 102 → 101 → 弱点随机数错位。修复：支援包也导出
   `abilityLayerCodes`，工具把迁走的卡登记进去。**教训**：任何「卡包/清单按 effects 表判定」的地方，
   迁移都必须同步登记，否则指标下降会连带改变开局牌组。
2. **共享同一 handler 的卡必须一起迁**：`noStoneUnturned` 同时被 03026（6 张）与 03307（全部）使用；
   只迁一张会让另一张失去行为。工具判据只看单卡，这类「共享原语」需要在 5c 人工拆分（已在 §6 列出）。

3. **迁移前要核对条目的所有顶层字段**：03314 的旧条目是 `fast + reaction{enemyPhaseBegins}`（事件在反应窗口打出），
只搬 handler 会让它变得不可打出；5c-8 补上「反应窗口的快速事件」接线后才重新变绿。
4. **恢复/迁移一张卡必须同时登记卡包**：02025 在早前的批量删除里被误删，恢复描述子时忘了登记，
`notz-strict-random-3p` 第 9 步（hubAutoDeck）立刻不一致——`architecture-guard` 现在有专门用例拦这类问题。
6. **删掉的分支要放回同一个分派器**：03189 / 03238 / 04156 的迁移回退时，我把三段 `effect.action` 分支
   插到了错误的分派函数（`tfaPlayerEffect3` 而不是 `carcosaPlayerEffect` / `tfaPlayerEffectCore`），
   结果卡片变成"未实现的玩家卡效果"。replay 只覆盖到其中两张（被 `未实现的卡尔克斯玩家卡效果` 抓住），
   **04156 是 tfa 验收用例抓到的**——说明 replay 与验收缺一不可。
   另一个结论：**给 api 加方法本身是零风险**（无人调用就不影响指纹），可以先把 api 放进去、再逐卡迁移。
5. **逃生通道的卡：引擎分支不是死代码**：03195 / 04197 早已迁到能力层，但它们的条目写的是
   `effect: { type: 'carcosaPlayer', action: 'pickpocketing' }` 这类**战役逃生原语**——引擎里那段
   `effect.action === 'pickpocketing'` 就是它的实现。当成死分支删掉后 `tfa-player-acceptance` 立刻失败
   （"olive mcbride reveals three tokens…"），已整体回退（账本用 `--allow-growth` 恢复两项）。
   **判据**：只有条目里不再有 `effect.type` 逃生原语的卡，它的引擎分支才是死代码。

---

## 6. 未完成清单（Phase 5 剩余）

`npm run cards:migrate:list` 会打印当前判定；下面按「缺什么读点」分组：

| 组 | 当前 | 缺的能力 | 建议批次 |
| --- | --- | --- | --- |
| 剩余 `reactions` 卡 | **2 张**（01082 既有付费 bug、02310 需要 `forcedMythosEndDiscard`） | 01082 的 `cost.assetHorror` 引擎从未付费（既有 bug）；02020/03269 需要被动新读点；04023/03313 的被动键没有目标；02310 需要 `forcedMythosEndDiscard`；04008 需要自定义 `prompt` | 5b-6d（先补读点） |
| 非 `stats` 的 `passive` | **8 张**（02110/03264/03308 永久卡、03010、01018/01027/01028、03143 剧情资产） | | 30 种键：`extraSlots`/`sanityBonus`/`handSizeBonus`/`evadeBonus`/`hostHealth`… 前四个有现成或近成的修正目标 | 5b-8 |
| 打出后去向字段（`attachTo`/`exileAfterPlay`/`removeAfterPlay`/`shuffleBackAfterPlay`/`becomesAsset`） | **~15 张** | `played` 描述子的「打出后去向」字段 + 读点（B6 已能表达） | 5b-9 |
| `engine:` 标记卡（行为全在引擎里） | **5 张** | 01014 / 01072 / 01094 / 01095 / 01117 逐张改写成描述子 | 5a-1（续） |
| 5c 剩余逃生卡 | **0 张** ✅ | 5c 阶段完成（93 → 0，全部走描述子通道） | — |
| 5a 引擎卡号分支 | **101 个码**（`condition` 25 / `block` 48 / `reference` 28 / `table` 0） | `reference` 是「搬家即可」（但要等文案 i18n）；`condition`/`block`（73 个行为分支）要逐卡迁移。死分支清理已成套路 | 5a-5… |

已完成的能力接线（不再列进上表）：`reactions`（`legacyReaction`，5b-6）、`freeTriggers`/`composure`（5b-7）、
「事件在反应窗口打出」（5c-8）。

同时记四笔容易忘的账：

- **E1（文案 i18n）**：本次没有触碰 `engine.js` 的 868 处中文字面量；一旦做，`state.log` 会变，
  必须重采 golden 基线（见 [`phase4-replay.md`](phase4-replay.md) §7）。
- **`addPendingTestBonus` 丢失（既有问题）**：窗口内写入的 `pendingBonus` 在下一个待决选择后归零，
  04160（Phase 2 卡）同样复现。做「检定加值」类卡（04151/04154/04160 等）之前应先修它，
  否则加值只能靠日志观测。
- **`evadeSuccess` 窗口没有 `successBy`（5c-18 记录，未修）**：`doEvade` 触发窗口时只传
  `{ enemy, location }`，所以 03195「检定成功且超过难度 2 点改为两项都做」这句自始不可达
  （旧 handler 读 `state._reaction?.successBy` 恒为 0）。5c-18 按原样搬运；补上这个上下文字段
  属于**规则改动**（会改变该卡的提示与结算），要单独一批，并同步更新
  `tests/phase5-migration.test.mjs` 里那条「按原样保留」的用例。
- **冻结守卫只在 `fast` tier 跑**：迁移批次仍应执行 `npm run test:fast`；涉及战役的批次再加跑对应验收文件
  （`npm run test:carcosa:player`、`npm run test:tfa:player`、`npm run test:dunwich:acceptance`）。

---

## 7. 复现步骤

```powershell
cd games/arkhamhorror

# 1) 采集迁移前基线（一次）
node tools/replay-fixtures.mjs --baseline ..\..\artifacts\replay-before.json

# 2) 看当前哪些卡可机械迁移
npm run cards:migrate:list
node tools/migrate-card.mjs --report

# 3) 迁一批（工具会拒绝不可机械迁移的卡）
node tools/cards-migrate.mjs --batch 5b-1 --codes 01089 01090 …

# 4) 生成/补齐骨架（可选）
node tools/scaffold-card.mjs --batch 5b-1

# 5) 验收
node tools/migrate-card.mjs --verify
node tools/audit-dead-primitives.mjs --check   # 5a：确认没有留下"已无数据引用"的旧原语分支
npm run cards:audit
node tools/replay-fixtures.mjs --check
npm run test:fast
```

回滚：每次迁移只改「旧条目删除 + 生成文件新增」，`git diff` 里能逐卡回退；
`ability-migration-batches.js` 的块按批次分组，删掉一个块即可整体撤回该批（同时要删白名单条目并重跑 `cards:audit:write`）。
