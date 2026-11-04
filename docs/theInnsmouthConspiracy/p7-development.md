# P7 开发验收记录

P7 **已完成**（2026-11-04 晚，多智能体收口轮）：八章逐章 12 项验收 **8/8** 全绿；逐卡账本 252 张
`missing=0`（234 verified + 17 书面简化 + 1 印刷无行为）；八章指南/叙事完整；桌面 1440 与移动 390
浏览器验收 38 例全绿。生产注册按 P8 口径：内容注册表收录 TIC 战役与 8 章目录（`development`，
大厅启动开关留待 P8），见本文件末尾「P7 收口」一节。

- [x] 锁定 P7 改动前 replay 基线：`audit/tic-p7-baseline.json`、`tests/fixtures/replay/tic-p7-baseline.json`。
- [x] 补齐非玩家行动、团队费用、钥匙支付、隐藏牌堆、地图与水位等开发接口，并建立实际规则管线专项。
- [x] 接入闪回 I–XIII 的正文、记忆及奖励处理；使用实际行动、存档恢复和物理卡守恒专项复验。
- [x] 完成全部共享遭遇卡与八章逐卡行为（逐卡账本 `audit/tic-all-card-acceptance.json`）。
- [x] 接通闪回 XIV、并行场景目标、四段幕间、升级窗口和完整结局。
- [x] 完成八章中英文冒险指南、每章规则及桌面 1440／移动 390 浏览器验收。
- [x] 冻结来源与索引，重建审计，完成全量快测及全部既有 replay 对比。

## 2026-11-03 20:30 现场（交接后的第一轮）

接手时交接文档列的 9 项失败已逐项定位并修复，当前源码的全量快测与既有 replay 都通过：

- `npm run test:fast`：5883 项、5880 通过、0 失败、3 跳过（`fast-eighth.log`，82s）。
- `node tools/replay-fixtures.mjs --compare tests/fixtures/replay/tic-p7-baseline.json`：13 局 / 797 步逐条一致，行为零变化（`replay-fifth.log`）。
- 新增 `tests/tic-scenario-reference-final.test.mjs`（200 例）：07041/07123/07163 三张提示卡的四档难度、取消窗口、depths、路障与带类型战斗/躲避分支全部实跑通过。

### 失败根因与修复

| 交接失败 | 根因 | 处理 |
| --- | --- | --- |
| 旧异端者翻面 | `enemy-faces.js` 新 fallback 对已离场/不匹配的实体直接调 `applyPhysicalFace` 并抛错 | 新增 `physicalFacePlanIfAny` 探测接口；不在场或非合法同类型双面时保留旧的「返回 null」语义，只有真实双面才替换印刷值 |
| Flashback 真实 Depth 行动 | 夹具假设「拿完三件遗物也不推进」，但 07167 印刷目标是「控制紫/白/黑三把钥匙，推进」 | 每个地点改为在「三处已揭示」同一初始局面的副本上验证；另加一例断言三遗物真的完成幕目标并进入 interlude3 → horrorInHighGear，同时核对记忆与 terror 记录 |
| 07283 Grand Entryway | 夹具把「洞穴」写成 07291（达贡巢穴，特性是 Lair） | 改用真实 [[Cave]] 地点 07102；`locationRule.connectsToTrait` 双向连接、紫色钥匙与 3n 线索费用全部实跑通过 |
| 八张 scenario reference 无法归属 | 归属算法没有把「关卡自己的 referenceCode」当 token | `collectScenarioTokens` 增加 scenario/manifest 的 referenceCode 与 originalCode；复算 0 unresolved，且只有这 8 条路径变化 |
| Harper 议程 import `_roles.js` | 帮助模块放在了条目私有的旁路文件 | 身份表并入 `encounter-entries/_shared.js`，`content/.../role-data.js` 只读再导出，三张议程改走共享出口；守卫恢复 |
| tier/node-suite 不一致 | 6 个新用例文件未登记 | 6 个文件 + 新提示卡用例全部登记进 `tests/suites.mjs` 与 `tests/node-suite.mjs` |
| content 卡号规则分支 | `companions-setup.js` 用 `code === '07083'` 判断 | 改为内容数据常量列表（同伴进牌库/暂取），不再写按卡号分支；基线回到 0 |
| 覆盖度产物漂移 | 新条目与声明窗口未重建审计 | `audit-abilities --write` 后审阅：增长全部来自 TIC 非玩家条目（47→166 卡、795→940 能力、106→112 声明窗口），遗留指标 engineCodes/effectsEntries 仍为 0 |
| TCU 审计来源漂移 | 共享接口改动 + `tests/suites.mjs` 属于 TCU 玩家卡证据集 | 先重跑 `audit-tcu-player --write`（87/87 仍 verified、166 例通过），再重建 `audit/tcu-migration.json`：只有源哈希变化，gate 仍 pass |

同时修掉交接文档未记录的 TDE 账本漂移：`tools/audit-tde.mjs` 已把浏览器配置路径改成 `tests/playwright/playwright.tde.config.mjs`，但 `audit/tde-migration.json` 仍是旧路径与旧哈希。重建后只有 3 个源的哈希/路径变化，gate 仍 pass、388/388 逐卡与 671 例 Node 验收不变。

### 仍未完成（按交接优先级）

1. 沉睡与效果来源：**前两片已落地**（见下节与 2026-11-04 一节）：免疫/来源、typed target 过滤、持久修正行读点与五张古神面全部完成；剩余：地点/密谋钩子独立来源帧的逐卡复核。
2. 并行幕（Flashback XIV、多活动幕、各自进 Victory2、继续/结局选择）与载具原子乘客批移动、真实驾驶正反面、Road 移除、步行额外行动费用。
3. 剩余牌：07086 动态 Aloof、07106 调查员 DeepOne 持续 trait、捕获/押送，以及换面后 artCode/卡面图、敌人附件离场清理。
4. 八章指南与逐章验收：boss 实际入场、暗置身份、私有堆守恒、完整故事分支、布局；逐章 Node/replay/桌面 1440/移动 390。

### 2026-11-04 古神五面 + 两条剩余引擎读点（交接第 1、2 条）

交接时列的第一优先项（达贡/海德拉五张面）与「写 boss 卡前最后一小步」（typed target 过滤、持久修正行读点）已全部落地。

**引擎读点（都不写 state，重放零变化）**

- `src/engine/targets.js`：敌人类目标在合法性阶段就按**真实来源类别**过滤沉睡敌人——玩家卡来源看不到沉睡古神（治疗/横置/重整/抹除文本这类不改伤害的效果同样不出现），遭遇/剧本来源（地点、幕、密谋）照常看得到；显式 `source.effectSource` 优先于卡面类型。`resolveTarget`/`validateMove` 复用同一份枚举，没有「只有选择器受保护」的缺口。卡面类型与沉睡判定由 engine 通过 `setTargetHooks` 注入（`cardDef`/`entryOf`/`enemyBlanked`）。
- `src/engine/modifiers.js`：`entityModifierTotal` 与 `entityRuleActive` 两个实体读点都按**这一行自己的来源**过滤——玩家卡写的行对沉睡目标不生效，敌人光环/地点/幕/议程行照常；每次读点只做一次沉睡判定（地点这类非敌人实体直接短路）。
- `src/engine/enemies.js`：运行期数值行（`api.addEnemyStatModifier` 写入的 `enemy.statMods`）同一口径；行上没有来源时对沉睡目标 fail-closed，普通敌人照常。
- `src/engine/enemies.js#engageEnemy`：「不能与调查员交战」按印刷是无条件规则，基础行动、剧本/遭遇来源与自动交战都不放行（此前 `api.scenario.engage` 可以绕过）。
- 新增 `src/engine/window-listeners.js#hasWindowListener`：为「新事件类型」开窗前先问有没有监听者，空窗口不改变重放指纹（与神话阶段结束同一口径）。

**新窗口（各只有一个真实监听者，均为首次接线）**

- `investigationPhaseEnds`：`runBetweenInvestigationPhases` 起始处派发，只在真有监听者时开窗。
- `enemyDamaged`：原先只有 `scenarioBehavior.enemyDamaged` 钩子，条目级 `trigger: 'enemyDamaged'` 是死声明。现在 `damageEnemy` 与普通攻击路径都派发（context 带 `amount`/`source`，TIC 的 `eventWindowInstances` 让每次伤害是一个独立窗口实例）。

**五张古神面（同文卡共用 `_shared.js` 工厂，不再逐卡抄两遍）**

- `07292b` 觉醒达贡（达贡密教巢穴）：`enemyHealth` +6×人数（2 人局 18，实测 6+12）；本地检定失败后重整并攻击；`testEnds` 监听与翻面同一次检定不回头结算新面。
- `07330a`/`07331a` 沉睡达贡/海德拉（进入漩涡）：`enemyRule.slumbering`；调查阶段结束时「巢穴里有调查员且她处于重整」才放置 1 个毁灭；印刷 `[action]` 意志(4) 成功后可横置或移除 1 个毁灭、失败至少 3 点放置 1 个毁灭（失败 1–2 点不放置）。巢穴判定用地点 `originalCode`（07328/07329）。
- `07330b`/`07331b` 觉醒达贡/海德拉：每个有钥匙的[[圣堂]]地点 -1 攻击（非圣堂地点不计）；被躲避或受到伤害后对**同族子嗣**执行相同操作（伤害沿用同一来源、躲避走 `autoEvadeEnemy`）；无生命值 → 100 点伤害也不自动击败，伤害计数保留给幕目标。
- 印刷关键词（猎手/庞大/反击）与无生命值来自关卡遭遇定义，物理换面按新面重设并在翻回沉睡面时清零；换面保留 id/伤害/毁灭/钥匙/横置。

**可复算证据**

| 项目 | 结果 |
| --- | --- |
| `npm run test:fast` | **5912 项 / 5909 通过 / 0 失败 / 3 跳过**（新增 13 例古神与读点用例） |
| replay 对比（tic-p7-baseline.json） | 13 局 **797 步逐条一致**，行为零变化 |
| `npm run cards:encounter-check` | 通过（1227 条目、归属 0 unresolved、条目合规无基线外新增） |
| `node tools/audit-abilities.mjs --write` | 只有本次新增：非玩家卡 167→171、enemy 52→56、abilities 173→179、modifiers 63→65、windows 112→113；engineCodes/effectsEntries 仍为 0 |

### 2026-11-04 冷漠的有效读点 + 07086 洛依高尔

印刷里的冷漠大多离散（印刷/藏身处/剧本授予，入场时合成到 `enemy.aloof`），但 07086 印着**连续条件**：「洛依高尔所在地点有调查员没有手牌时，洛依高尔失去冷漠」。条件随手牌变化，不能写进 state。

- 新增 [src/engine/enemy-aloof.js](../../src/engine/enemy-aloof.js) 的 `enemyIsAloof(state, enemy, { isBlanked, entryOf })`：先看实例布尔，再问条目声明的 `enemyRule.losesAloofWhen(state, enemy)`；文本被涂白的敌人整段失效；条件抛错时保守地保持冷漠。
- 读点接线：`hidden-rules.js#aloofPreventsAttack`（攻击合法性，`moves.js` 的合法行动/提交校验都走它）、`engine.js#engagesAutomatically`（自动交战）、`describe.js` 的关键词展示（按有效冷漠，不再照抄实例快照）。注册期校验 `losesAloofWhen` 必须是函数。
- 卡牌 `07086`（许德拉的代理人，`_shared/agents_of_hydra/`）：冷漠条件 + 「敌军阶段结束时：此地与连接地点的每位调查员随机弃 1 张手牌」（`enemyPhaseEnds` 窗口 + `api.discardRandomFromHand`，范围外调查员不受影响）。
- 证据：`tests/tic-dynamic-aloof.test.mjs`（6 例）覆盖条件求值、文本空白、真实卡片的攻击目标与自动交战、范围弃牌与描述层关键词；全量快测 **5918 项 0 失败**、replay 13 局 797 步一致；能力审计只增加 07086 一项（非玩家卡 171→172、abilities 179→180）。

### 2026-11-04 遭遇堆搜索读点 + 07090 深潜者来袭（并修掉 07088 的调用错误）

07090 需要「查找遭遇牌库和遭遇弃牌堆，找出一个[[深潜者]]敌人，将其生成，与你交战，并混洗遭遇牌库」。此前没有任何**取出指定物理遭遇卡**的写入口，卡面只能直写 `state.encounterDeck`（违反一卡一文件口径的 R1）；「这个敌人能不能进入当前地点」也只有引擎内部函数。

- `scenario-runtime` 新增两个读点：`takeEncounterCard(code, {pile})`（按物理卡从牌库顶 / 弃牌堆取出，返回 `{pile}` 或 null）与 `canEnemyEnterLocation(codeOrEnemy, locationId)`（只读，与生成/猎人移动共用 `enemyCanEnterLocation`）。
- `_shared.js` 新增 `searchEncounterEnemyAndSpawn`：两个堆的候选合并、按 `cardCode` 让玩家选择、取出 → 生成 → 交战 → 洗牌，一套实现；候选过滤由调用方给出。
- 卡牌 `07090`（`_shared/creatures_of_the_deep/`）：本地点的深潜者先解除交战 → 本地与连接地点的深潜者与本调查员交战（同地点 `reengageEnemy`、连接地点 `engageAtInvestigator`）→ 没有任何敌人因此交战才搜索生成。搜索候选额外要求 `canEnemyEnterLocation` 为真（进不去当前地点的敌人不是合法候选）。
- 顺带修掉一个**真实缺陷**：`07088` 深潜者巨怪的「选择并弃掉你 1 张手牌」直接调 `api.discardChosen`，而实体能力面（abilityApi）没有这个方法——任何一次它与调查员交战都会抛 `TypeError`。现在能力面委托到场景运行时的同一份 `discardChosen`（逐张询问、`canDiscardFromHand`、`afterHandDiscard` 窗口都在原实现里）。
- 证据：`tests/tic-encounter-search.test.mjs`（8 例）覆盖取出顺序与弃牌堆回退、`enterOnlyTraits` 过滤、07090 的解除交战/连接地点带人/搜索生成与洗牌/两堆都没有时不凭空生成、以及 07088 的强制弃牌。全量快测 **5926 项 0 失败**、replay 13 局 797 步一致；`cards:encounter-check` 通过（1229 条目、合规无基线外新增）。

### 2026-11-04 「不能谈判」读点 + 07124–07127 压迫议程

「深陷其中」的四张压迫议程印着同一条连续规则：「每个[[嫌犯]]敌人失去冷漠，并且不能与之谈判」，外加「在你回合结束时，如果你位于完全淹没的地点」的递增惩罚。此前引擎既没有「某类敌人失去冷漠」的全局通道，也没有「不能谈判」的读点（`scenarioBehavior.parleyBlocked` 只是章节钩子，不是声明式规则）。

- 两条新增**实体规则目标**（`entityRuleActive` 读点）：`loses:aloof` 与 `cannot:parley`。幕/议程行默认被 `entityRuleActive` 跳过（只有实体/地点/光环行生效），这两条按印刷就是全局施加的，因此单独列入 `SCENE_ENTITY_RULES` 放行，其余规则行为不变。
- `enemyIsAloof` 现在按三级判定：实例布尔 → `loses:aloof` 实体规则（幕/议程/地点/敌人）→ 条目自己的连续条件 `enemyRule.losesAloofWhen`（07086）；文本被涂白时整段失效。
- `parley.js` 新增唯一读点 `parleyForbidden(state, inv, entity)`：调查员侧 `capability:parley`（07107「调查员不能谈判」）+ 目标侧 `cannot:parley`。`parleyMoves`（合法行动枚举）与 `parleyTargetError`（`validateMove`/执行前校验）共用同一份判定，不存在「只有选择器受保护」的缺口。
- 四张议程卡（`inTooDeep/07124–07127`）共用 `_shared.js` 的 `floodedTurnEndAgenda`：同一句规则写一次，条目只声明卡号与递增的伤害/恐惧/随机弃牌数量。「完全淹没」用 `effectiveFloodLevel ≥ 2`（含载具保护）；回合结束窗口 `turnEnded` 的 `seat` 正好是「你的回合」。
- 证据：`tests/tic-flooded-agendas.test.mjs`（6 例）覆盖嫌犯失去冷漠/非嫌犯保持冷漠、不能谈判（合法行动 + 伪造命令都拒绝）、`capability:parley` 全局禁止、规则随当前议程生效、完全淹没与部分淹没的分界、四张卡的伤害/恐惧/弃牌递增。全量快测 **5932 项 0 失败**、replay 13 局 797 步一致；能力审计只增加四张议程（非玩家卡 172→176、abilities 179→183）。

### 2026-11-04 「放到密谋牌库旁」的旁置通道 + 07095 / 07107

两张涨潮危害卡（07095 印斯茅斯之雾、07107 鬼祟的当地人）的显现有同一条模板：「检定 → 成功二选一（受伤/放到密谋牌库旁），失败两者都做」，接着是**全局持续效果**与「每轮最多弃 1 张」。

- 「放到密谋牌库旁」沿用 `api.putNextToAgenda`（06194/06096 的既有写入口，真实旁置实例）。
- 旁置卡现在是**修正来源**：`entityModifierRows` 增加 `aside` 行（07095 的 `locationShroud +1` 因此对所有地点生效）；`modifierSourceRows` 增加无控制者的旁置行，配合新增的 `audience: 'all'`（07107 的 `capability:parley` 因此对每名调查员生效）。`appliesTo` 只对声明 `audience:'all'` 的修正放行，其余修正仍要求同持有者。
- 轮末弃置新增 `treacheryRule.discardOneAtRoundEnd`：印刷「从场上弃掉 1 张…（每轮最多一次）」的卡每轮最多弃 1 张同名副本；旧口径 `discardAtRoundEnd`（06096/05102「弃掉这张卡」）保持不变。
- 证据：`tests/tic-aside-hazards.test.mjs`（5 例）覆盖 07095 的放置/恐惧/失败双结算与每个地点隐藏值 +1、07107 的全局禁止谈判（含伪造命令被拒）、以及「两种旁置卡各弃 1 张、剩余留到下一轮」。全量快测 **5937 项 0 失败**、replay 13 局 797 步一致；能力审计只增加这两张卡（非玩家卡 176→178）。

### 2026-11-04 07094 按攻击来源减伤 + 07105 线索最多生成点与谈判

- **07094 长翼者**（印斯茅斯之雾）：新增 `enemyRule.damageReductionExceptSourceTraits`（`{ amount, minimum, traits }`，注册期校验形状）。读点在 `combat.js` 的攻击伤害段（与既有 `damageReductionWhileExhausted` 同一处），按**攻击来源卡**的特性判定：武器支援取 asset 的卡号、事件取 `sourceCode`，空手攻击没有来源卡、同样减伤；下限按 `minimum`（1 点，不是 0）。印刷里「X 为所在地点隐藏值」在英文原文里也只有定义没有用法，按「印刷主文优先、差异写审计」的口径不虚构效果，已在卡片注释里记录。
- **07105 印斯茅斯闹事者**（当地人）：
  - 「生成 - 线索最多的地点」= 条目级 `spawnMostClues`，读点在 `enemies.js#spawnEnemy`（与 `spawnFarthestFromAll`/`spawnAncientFirst` 同段），已揭示地点并列时由领队选择；剧本 `api.spawn(ignoreSpawn=true)` 的剧情生成点仍然优先。
  - 谈判用「`cost: { action: 1, clues: 1 }` 扣线索 + `api.returnClueToLocation` 放到本地点」两个既有写入口合起来表达「将你的 1 个线索放到你所在地点」，并配 `range: 'connecting'`（连接地点的调查员也能触发）。
  - 「下一个补给阶段期间不重整」复用运行时既有的 `api.scenario.preventEnemyReady`（写 `enemy.preventReady`，读点是 `phases.js` 的补给阶段）——本轮曾重复实现过同名方法，被既有 TDE 用例（06092）当场抓出并修正；结论：**新增 api 前先按方法名全量 grep**。
- 证据：`tests/tic-fog-and-locals.test.mjs`（7 例）覆盖近战减伤 / 枪械不受影响 / 空手攻击下限 1 / 规则形状注册期拒绝、遭遇抽牌生成在线索最多的地点（含并列选择）、谈判把线索放到地点并让它在下一个补给阶段不重整、没有线索时行动不出现。全量快测 **5944 项 0 失败**、replay 13 局 797 步一致。

### 2026-11-04 07106 印斯茅斯面容 + 调查员特性的声明式授予

07106 印着「你得到-1[智力]、-1神智，并且你获得[[深潜者]]特性」，三条效果各走一条读点：

- **智力 -1**：威胁区卡的修正行（`modifierSourceRows` 把 `inv.threat` 当来源、持有者是控制者），`getStat` 走 `modifierTotal`，自动只作用于这张卡的持有者。
- **神智 -1**：走威胁区效果通道 `threatEffect.sanityModifier`（04085「伊格的诅咒」的既有读点，`getMaxSanity` 直接读它）。
- **[[深潜者]]特性**：新增授予目标 `add:investigatorTrait`（`GRANT_TARGETS` 的第五种），读点是 `stats.js#investigatorTraits` = 卡面特性 + 运行期 `inv.traits` + 声明式授予（去重、大小写不敏感）。消费点：`api.investigatorTraits` / `api.investigatorHasTrait`（卡面可读）与 `describe` 的「特性：…」行（AI/牌桌可见）。卡离场时授予随修正行一起消失，**不写 `inv.traits`**，因此多副本/其它来源不会互相覆盖。
- 顺带查清一个**存量缺口**：修正管线里的 `maxHealth` / `maxSanity` 目标目前**没有任何读点**（`getMaxSanity`/`getMaxHealth` 不带 state，读不到 `modifierTotal`），此前的条目也从未声明过它们。本轮因此改用 `threatEffect` 通道，并把「要么补 state-aware 读点、要么从 `MODIFIER_TARGETS` 删掉」记入待办。
- 证据：`tests/tic-innsmouth-look.test.mjs`（5 例）覆盖进场后的属性/特性、描述层可见、意志(3) 成功弃牌后全部恢复、失败保留、以及威胁区行动只对持有者出现；`tests/phase2-primitives.test.mjs` 的授予目标契约同步扩到五种。全量快测 **5949 项 0 失败**、replay 13 局 797 步一致。

### 2026-11-04 步行额外行动费用 + 07164/07165/07166

「大海的秘密」的三张版本议程（恶魔礁按记忆二选一 + 第二阶段）印着同一条全局规则：「你不在载具上时，作为在[[海洋]]地点间移动的额外费用，你必须花费 2 行动」，第二句是「求取空气」的强制结算。

- 新增 `movementActionSurcharge`（`actRule` / `agendaRule`，形状 `{ amount, betweenTraits? }` 或纯数字，注册期校验）：读点是 [turn-flow.js](../../src/engine/turn-flow.js) 的 `actionCost`——**只加在基础移动行动**上，起止地点都要带 `betweenTraits` 特性，在载具上的调查员不付（`vehicleOf` 按 `mechanicState.vehicles` 的乘客判定）。当前幕/议程两张条目相加，同一张卡只算一次。
- 三张议程卡（`devilReef/07164–07166`）只声明这条规则：`movementActionSurcharge: { amount: 2, betweenTraits: ['Ocean'] }`。
- 第二句「求取空气」**不需要条目声明**：引擎的 `flood.js` 已有 `beginAirTurn`（回合开始、`water.air` 驱动）→ `checkAirAfterMove`（进入未淹没/部分淹没地点或载具即解除）→ `endAirTurn`（回合结束结算 5 点直接伤害），恶魔礁与达贡巢穴都配置了 `water: { air: true, damage: 5 }`。本轮补了可复算用例证明这条读点真实生效。
- 证据：`tests/tic-walking-surcharge.test.mjs`（5 例）覆盖三张议程的「海洋→海洋 = 3 行动」、海洋→内陆与无该议程时 = 1 行动、注册期形状校验、完全淹没地点「回合开始→回合结束 5 点直接伤害」、以及载具 `protectsFromFlood` 把有效淹没压到 0 因而不记录空气风险。全量快测 **5954 项 0 失败**、replay 13 局 797 步一致。

### 2026-11-04 载具通道第一片：07178 渔船 + 07187 偷偷上船

载具状态本来就在 `mechanicState.vehicles`（id = 剧情支援实例 id，含 location/capacity/running/protectsFromFlood/passengers），写入口齐全：register/enter/leave/move/remove。本轮补掉了两个真实缺口并把渔船接上：

- **载具卡面不会跟着走**（真实缺陷）：`vehicles.moveVehicle` 只更新 `mechanicState` 里的位置并搬乘客，剧情支援实例自己的 `location` 停在原地——于是渔船移动一次后，下一次 `[action]` 的范围判定（`entityAbilityInRange` 读的就是这个字段）会指回旧地点。现在移动后同步载具物理卡的 `location`（只在已有该字段时同步，受控汽车不受影响）。
- **能力面没有 `api.mechanics`**：场景运行时把机制面挂在 `api.mechanics.*`，而能力面只把同一批入口摊平到顶层（`api.vehicles` 等），两个 api 面形状不一致，同一段结算换入口就会 `undefined`。现在能力面也挂 `mechanics`，且与摊平的入口**共用同一个实例**。
- **07178 渔船**：`[action]：将渔船移动到一个连接的[[海洋]]地点` → `api.vehicles.move`（逐个权威位移乘客、要求载具运行中、目标必须相邻、每位乘客都要通过进入地点的权威校验）。「视为未淹没」仍由 `protectsFromFlood` + `effectiveFloodLevel` 承担，条目不再声明。
- **07187 偷偷上船**：有载具时每位乘客二选一（1 伤害 + 1 恐惧 / 离开载具），没人在载具上则 `{ gainSurge: true }`。「离开后本轮不能再进入」不需要新字段：`leaveVehicle` 已经把 `vehicleAccess[seat]` 记成当前轮，`vehicleAccessError` 本轮直接拒绝再次进入。
- 证据：`tests/tic-fishing-vessel.test.mjs`（5 例）覆盖渔船行动出现与目标约束（只给连接的[[海洋]]地点）、移动带走乘客与卡面、内陆目标被排除、07187 的离开/承受/涌动三种分支。全量快测 **5959 项 0 失败**、replay 13 局 797 步一致。

### 2026-11-04 载具限制第二片：07183 追猎的深潜者 + 07188 拖入水底

两条「不能进入载具」的印刷来源不同，但共用同一处判定：

- `enemyRule.engagedRestrictions: ['enterVehicle', 'gainResources']`（07183「与你交战时，你不能进入载具或获得资源」）：新增读点 `enemy-entry.js#enemyEngagedRestricts`，接在 `vehicles.js#vehicleAccessError`（**只禁进入、不禁离开**）与 `resource-bank.js#gainResource`（获得资源的唯一入口）。
- `treacheryRule.forbidsVehicles: true`（07188「你不能进入载具」）：威胁区卡声明，读点同在 `vehicleAccessError`，卡离场即失效。
- **07183**：交战后不在载具上 → `api.loseResources(seat, 2)`；在载具上 → `vehicles.leave(..., { forced: true })`（被迫离开绕过「本轮已进出」校验）。
- **07188**：显现进入威胁区、若在载具上被迫离开；`[action]` 选战斗(3)或敏捷(3)，成功 `api.removeThreat` 弃掉本卡。
- 证据：`tests/tic-vehicle-restrictions.test.mjs`（5 例）覆盖交战期间禁止进入/禁止获得资源与解除后恢复、交战后「失去 2 资源 / 被迫离开」两支、07188 的入场被迫离开与检定成功后限制消失、两条声明的注册期形状校验。全量快测 **5964 项 0 失败**、replay 13 局 797 步一致。
- 过程记录：本轮改了 `resource-bank.js` / `vehicles.js` / `enemy-entry.js` 这些**共享接口**，TCU 玩家卡账本随来源哈希漂移，`P1 账本` 用例当场变红；按交接文档列的次序先 `npm run audit:tcu:player:write`（87/87 verified、166 例）再 `npm run audit:tcu`（9/9、377/377、releaseGate true）重建后恢复全绿。**改共享接口后必须重建这两本账，且只能串行跑。**

### 2026-11-04 载具通道第三片：07168 急涡水域（渔船撤退）

印刷一句话里塞了四件事，四件各有一个既有或新增读点：

- **「你在渔船上」**：新增 `_shared.js#vehicleAssetOf(state, seat)`（`vehicleOf` 找乘客所在载具 → 再取载具的**物理卡**，卡面条件不直接读 `mechanicState`，也不拿同卡号的第一张顶替）。
- **「渔船上的每位调查员撤退」**：新增只读入口 `vehiclePassengers(state, id)`（快照），逐个 `api.resign(seat)`——退场、线索/钥匙清理、`allResigned` 结算全部沿用既有入口。
- **「将渔船从游戏中移除」**：新增 `api.scenario.removeStoryAsset(id)`——只从场上移除、**不进弃牌堆**，并触发 `storyAssetLeftPlay` 的离场清理；配合 `vehicles.remove(id)` 注销载具。
- **「紫/黑/白钥匙放在当前场景上」**：`keys.transfer(color, 'investigator:<seat>', 'reference')`，只搬印刷点名的三色；**先搬钥匙再撤退**，否则撤退清理会先把钥匙留在原地（用例里用一把红钥匙对照验证了这个顺序）。
- 「其他每位调查员被抛下」没有额外机械动作：不在船上的人不撤退，局面照常继续。
- **ESM 循环修复**：`_shared.js` 起初 import `vehicles.js` 拿读函数，而 `vehicles.js` 为了校验会拉进 `ability.js` → `deck/availability.js`，触发 `Cannot access 'strictAcceptedCodes' before initialization`。现在读函数拆到叶子模块 `src/engine/vehicle-state.js`（只依赖 `mechanic-state.js`），`vehicles.js` 重新导出同一份实现，卡条目经由 `_shared.js` 只依赖叶子模块。
- 证据：`tests/tic-vortex-resign.test.mjs`（2 例，其中一个用两位调查员 + 四把钥匙逐项断言）覆盖「只有在渔船上才出现行动」与「撤退/移除渔船/三色钥匙归公/其余钥匙留在原地/另一个人被抛下」。全量快测 **5966 项 0 失败**、replay 13 局 797 步一致。

### 2026-11-04 道路危害整批（07204a–07210）+ 多智能体并行的分工口径

十一张道路地点印的是同一句模板：「强制 - 在有载具离开/进入本地点时：该载具上每有一位调查员，该地点的调查员必须共同花费 N 个线索…（每个载具每场游戏仅限一次。）」按「同句规则只写一次」先补原语，再由多个子智能体并行写卡：

- **分发口**：`vehicles.moveVehicle` 移动成功后回调 `vehicleLeft` / `vehicleEntered`，由 `road-hazards.js#dispatchVehicleEvent` 找到地点条目的 `locationRule.vehicleLeft` / `vehicleEntered`；两层的 `createMechanicsApi` deps 各自接线，事件形状 `{ vehicleId, seats, origin, destination }`。
- **每场一次**：`api.roadHazardOnce(locationId, vehicleId)`（`mechanicState.roadHazards` 记账，纯 JSON）；空车不触发、也不烧记账。
- **共同支付**：`groupPayment` 扩了 `allowShort`，返回 `{ paid, shortfall }`，暴露成 `api.payGroupClues(amount, { atLocation, allowShort })`；付款人是**车开走后仍在该地点**的调查员（与印刷时点一致）。
- **移除载具**：`api.removeVehicleFromGame(id)` 同时处理剧情支援（离场、不进弃牌堆）与受控载具（从持有者资产里移除并记 `removedFromGame`），再注销载具登记。
- **弃牌找敌人**：`api.discardEncounterUntilSpawn({ trait, location })`（07209a/b）。
- **禁止离开**：`api.mechanics.vehicles.lockUntil(id, round)`，读点在 `moveVehicle`（`state.round <= lockedUntilRound` 时拒绝）。
- **共享工厂**：`_shared.js#roadHazardCharge`（乘客快照 → 每场一次 → 共同支付 → 差额）与 `roadHazardSufferer`（领队选乘客）；卡文件只写差额后果。

**分工（本轮起改用多智能体并行）**：主进程独占 `src/engine/**`、`_shared.js`、两个索引、`content/**`、`docs/**`、`audit/**` 与全部门禁；子智能体只写分到的单卡文件（禁止改引擎/共享/索引/文档、禁止跑索引与测试），每张卡的文件头注释必须写明读点与共用模板位置。本轮 4 个子智能体并行产出 07204b/c、07205a/b、07208a/b/c、07209a/b 共 9 张，主进程补 07204a（范例）与 07210、全部原语与 8 例测试。

- 证据：`tests/tic-road-hazards.test.mjs`（8 例）覆盖差额恐惧/伤害、付款人线索足够时先付线索、每载具每场一次、荒凉道路弃牌找[[载具]]敌人并生成在本地点、蜿蜒长路进入放毁灭且锁到下一轮结束、崖边道路司机检定失败移除载具。全量快测 **5974 项 0 失败**、replay 13 局 797 步一致。

### 2026-11-04 07199b 击败替代接线（enemyWouldBeDefeated）

- 07199b 魔鬼礁石的骇物 → **`implemented: true`**：`spawnRearmost`（最后方生成）+ 击败替代。
- 击败替代走引擎既有的打断窗口：`kind:'forced'` + `trigger:'enemyWouldBeDefeated'` + `limit: perWindow/instance`，`resolve` 里 `api.enemyOutcomes.replace(context, { healAllDamage: true })`（与 07084「无毁烬时」同一写法），再 `api.exhaust(source)` + `api.scenario.preventEnemyReady(source, 1)` 落实「横置、本轮剩余时间不能重整」。
- 用例：把 4 点伤害的骇物「打死」，断言它仍在场、伤害清零、已横置、`preventReady = { from: 本轮, rounds: 1 }`。
- 全量快测 **5983 项 0 失败**、replay 797 步一致、覆盖度产物已重新生成（nonPlayerCards=191）。



- 新增 `enemyRule.cannotEnterTraits: ['Cave']`（注册期校验）：读点 `enemy-entry.js#enemyCanEnterLocation`，「不能进入[[洞穴]]地点」（07164b/07165b 魔鬼礁石的骇物）。与既有 `enterOnlyTraits`（只能进入）互补，两者可同时存在。
- `07199b` 已落盘：声明 `spawnRearmost: true`（最后方生成，读点已通），猎手/庞大/反击由内容层按印刷文本提供；「将要被击败时改为移除伤害并横置、本轮剩余时间不能重整」**未实现**——引擎已有 `enemyWouldBeDefeated` 打断窗口（windows.js:127，enemy-outcomes.js#interrupt），但条目还没接上，故 `implemented: false`，下一轮接窗口后再翻 true。
- 全量快测 **5982 项 0 失败**、replay 797 步一致、索引 1264 条目。



- **`spawnRearmost` 修好并打通抽牌路径**：坑有两处——①`mechanicState.road.columns` 的键是**地点实例 id**，不是卡号（第一版按卡号查，永远查不到）；②`encounter.js` 的敌人分支默认「与抽牌者交战」，于是落点被交战逻辑拉回抽牌者所在地点。现在 `encounter.js` 用 `printedSpawnLocation` 判据（`spawnFarthestFromAll` / `spawnMostClues` / `spawnRearmost` / `spawnAncientFirst`）跳过默认交战，位置交给 `spawnEnemy` 的条目分支解析。
- **07214 一车打手 → `implemented: true`**：最后方生成（列号最小、不交战）+ 猎手移动的同一阶段不能攻击（`enemyMoved` 的 `cause:'hunter'` + `skipEnemyAttackThisRound`）。
- **07213 追击快车 → 仍 `implemented: false`**：生成与「同车也攻击」都已实现；`enemyRule.attackDamageBonus` 的声明与读点也已接，但**实际伤害仍按印刷值结算**——`attack.plannedDamage` 只用于展示，伤害落实走的是 `enemy.damage + extraDamage` 的另一条路径。下一步要把伤害应用改成读 `plannedDamage`（或把加成并进 harm 的入参），改完即可翻 true。
- 证据：`tests/tic-chase-vehicles.test.mjs`（4 例）覆盖两张卡的最后方生成（并由列号推导期望值）、不自动交战、07214 已实现标记、07213 的声明与「当前实际伤害仍是印刷值」的差距断言。全量快测 **5982 项 0 失败**、replay 797 步一致。



- 新增条目级 `spawnRearmost`（读点 `enemies.js#spawnEnemy`，与 `spawnMostClues` 同段）：按 `mechanicState(state).road.columns` 取最小列号的地点，并列时领队选。
- 新增 `enemyRule.attackDamageBonus: { amount, unlessTargetInVehicle }`（读点 `enemies.js#enemyAttack` 的 `extraDamage` 汇总处）。
- 两张卡（07213 追击快车 / 07214 一车打手）保持 **`implemented: false`**：原语与声明已接，但用 `drawEncounter` 走到 `spawnRearmost` 时落点是抽牌者所在地点（列 3）而不是最后方（列 1），说明抽牌路径里还有一处会在我的分支之后改写 `loc`（疑似内容层把「生成 - 最后方的地点」解析成 `def.spawn` 占位后由交战/入场逻辑回落）。**未校正前不标记为已实现**，避免「声明了但行为不对」被算作完成。
- 现状：全量快测 **5978 项 0 失败**、索引 1263 条目一致、审计 nonPlayerCards=190。



- **07211a/b、07212a/b**（托马斯·道森的车 / 艾莲娜·哈珀的车）：运行面与熄火面各一个条目，互为反面（cards-data 的 `linkedToCode` 已声明成对关系）。
  - 「本载具正在运行。调查员不能进入或离开本载具」= 运行面条目上的 `assetRule.vehicleAccessLocked: true`，读点在 `vehicles.js#vehicleAccessError`，**按当前物理面判定**——翻到熄火面后条目不存在，锁定自动失效。
  - 「如果你是本载具的司机」= `_shared.js#vehicleDriverOf`（读 `mechanicState.vehicles[id].driver`），用描述子 `criteria` 过滤，非司机看不到行动。
  - 行驶 [action]：`api.drawEncounter(seat)` → `api.mechanics.vehicles.move` 到连接的[[道路]]地点，「每轮最多一次」用 `limit: { scope: 'perRound', owner: 'instance' }`。
  - 翻面 = `_shared.js#flipVehicleFace(state, api, id, nextCode, running)`：走引擎普通物理面入口（`api.flipAsset`，本轮补到能力面）+ 同步 `running`。
  - **setup 例外**：开局摆位不是「进入载具」，`enterVehicle(..., { setup: true })` 不看运行面锁定与敌方/威胁区限制（否则 1–4 人开局摆车会全部失败，本轮被 `High Gear real Np setup` 用例当场抓到）。
- **07213/07214**（追击快车 / 一车打手）：文件已落盘但 **`implemented: false`**，逐条差距写在文件头：
  - 已实现：07213「也攻击同一载具上的其他每位调查员」（`enemyAttacked` 窗口 + `api.enemyAttackByCard` + `vehiclePassengers`）、07214「通过猎手关键词移动的同一阶段不能攻击」（`enemyMoved` 的 `cause: 'hunter'` + `api.scenario.skipEnemyAttackThisRound`）。
  - 缺两条原语（下一轮补）：①条目级 `spawnRearmost`（按 `mechanicState.road.columns` 取最后方地点，`spawnEnemy` 与 `spawnFarthestFromAll` 同段）；②`enemyRule.attackDamageBonus: { amount: 2, unlessTargetInVehicle: true }`（读点 `enemies.js#enemyAttack`）。
- 工程提示：子智能体用 `Get-Content` 打印中文文件时控制台会显示乱码，但**文件本身是好的**（本轮一度误判为双编码，read 工具确认字节正确）——判定损坏必须用 read 工具，不能看 PowerShell 回显。
- 证据：`tests/tic-car-faces.test.mjs`（4 例）覆盖司机可见性、运行面禁止进出与翻面后解除、熄火面启动翻回、行驶抽牌+移动到[[道路]]地点。全量快测 **5978 项 0 失败**、replay 13 局 797 步一致、TCU 账本 gate pass。

**进度**：完整章验收仍是 **0/8**，生产注册未放开。`artifacts/migration/tic/p7/shards.json` 的 248 个分配号里仍有 **45** 个没有条目文件（其中 middle 只剩 8 张：07164b/07165b、07185、07199/07199b/07200/07201/07202）。

### 2026-11-03 21:00 效果来源 provenance（交接第 3 条第一片）

新增 [src/engine/effect-provenance.js](../../src/engine/effect-provenance.js)：进程内帧（WeakMap，**不写 state**，不改变存档与重放指纹）记录「现在这条效果来自哪张卡、属于玩家卡还是遭遇/剧本来源」。

- 权威口径：`asset/event/skill/investigator` **以及无人控制的 `story` 剧情资产**都是玩家卡来源；`enemy/location/act/agenda/treachery/scenario` 是遭遇来源；未知类型返回 null，不按 actor 座位猜。
- 接线：`runExecuteDescriptor` 在整段 resolve（含内部再开的窗口）压帧；`canDamageEnemy` 与 `legalMoves`/`validateMove` 的攻击、躲避、额外躲避、交战都先问 `enemyEffectAllowed`。
- 沉睡：条目声明 `enemyRule.slumbering: true`（注册期只接受布尔值）。沉睡敌人免疫玩家卡效果与调查员行动，剧本/遭遇来源（例如圣堂地点的印刷效果）照常，来源未知时 fail-closed；判定读**当前印刷面**，换面或文本被抹除后立即失效。
- 证据：`tests/tic-effect-provenance.test.mjs`（13 例）逐条验证分类、嵌套帧还原、真实描述子结算的来源、章节钩子的剧本来源帧（含 `Object.freeze` 的 behavior）、沉睡伤害双向、攻击/躲避/交战的合法行动与提交校验、沉睡敌人不被自动交战也不能攻击、玩家卡效果不能横置/位移/交战/躲避/击败而遭遇来源与敌人阶段重整照常、抹除文本恢复、注册期校验、存档无来源字段。全量快测 5896 项 0 失败、既有 replay 13 局 797 步一致（行为零变化）。
- 章节钩子来源帧：`scenarioBehavior(state)` 现在返回按 state 缓存的「剧本来源」包装（冻结友好，不用 Proxy），钩子内部写入算剧本来源，钩子里再结算某张卡仍压自己的帧。
- 沉睡的「不能攻击 / 不能与调查员交战 / 免疫玩家卡效果」已接线：`enemyAttack`、`engagesAutomatically`、`canDamageEnemy`、`legalMoves`/`validateMove`（攻击/躲避/额外躲避/交战）先问 `enemyEffectAllowed`（fail-closed）；`exhaust`/`ready`/`moveEnemy`/`engage`/`autoEvade`/`defeatEnemy`/`flipEnemy` 等写入口用 `enemyPlayerEffectBlocked`——只有来源明确是玩家卡才拒绝，敌人阶段与剧本自动结算（无来源帧）照常，圣堂之类的遭遇来源也照常。
- 尚未接线（写 boss 卡前最后一小步）：`typed target` 过滤与持久修正行读点（`enemyModifierAllowed` 已备好但尚无读点）。——**2026-11-04 已接线，见上节。**


### 尚未落盘的单卡（按 shards.json 与磁盘实测，2026-11-04 复算）

按权威分片逐号核对（`artifacts/migration/tic/p7/shards.json` 的 248 个分配号 ↔ 磁盘单卡文件），以下 **67** 张仍无条目文件（2026-11-03 的清单是 86 张，减去之后落盘的 07292b/07330a/07330b/07331a/07331b、07086、07090、07124–07127、07095、07107、07094、07105、07106、07164/07165/07166）。**不要预建空文件**：多数卡的印刷正文需要先补引擎接口（并行幕、载具/Road、捕获/押送），再按「一卡一文件 + 原语队列」写；印刷上没有特殊行为的卡（例如门扉地点 07320）按「一张有行为的卡 = 一个文件」本来就不需要条目。

- early 缺 4：07060, 07061, 07062a, 07099
- middle 缺 8：07164b, 07165b, 07185, 07199, 07199b, 07200, 07201, 07202
- late 缺 33：07232, 07233, 07234, 07235, 07236, 07237, 07238, 07239, 07247, 07249, 07250, 07252, 07252b, 07253, 07259, 07260, 07280, 07281, 07282, 07293, 07297, 07299, 07313, 07314, 07315, 07316, 07317, 07318, 07320, 07321, 07332, 07337, 07338

抽查确认这些号大多带真实印刷行为（例：07168 渔船撤退与钥匙放置、07204a 载具离场共同费用、07313 全程淹没的求取空气、07164 海洋移动额外费用、07280 幕目标），因此不能仅以「已有章节 behavior」计入完成。

| 已接接口 | 规则验收入口 |
| --- | --- |
| 遭遇牌成本、远程全组线索、实际幕行动、按钥匙条件闪回 | `tests/tic-scenario-cost-followup.test.mjs` |
| 钥匙复合成本及彩色选择 | `tests/tic-scenario-key-cost.test.mjs`、`tests/tic-scenario-interactions.browser.mjs` |
| 原子横置生成、显现生成地点、敌人线索转移 | `tests/tic-scenario-atomic-spawn.test.mjs`、`tests/tic-scenario-spawn-followup.test.mjs` |
| 特性连接、圣堂排水与躲避、场景记忆 | `tests/tic-scenario-template-followup.test.mjs` |
| 同行动内独立事件发生次数 | `tests/tic-scenario-occurrences.test.mjs` |
| 真实区域移动、实例槽位豁免、恰好下次重整 | `tests/tic-scenario-zones-followup.test.mjs` |
| 隐藏面水位限制、同地点威胁激活、只选钥匙、无生命值敌人 | `tests/tic-scenario-advanced-followup.test.mjs` |
| 闪回 I–XIII、实际深渊行动、钥匙关联遗物、控制三钥匙推进 | `tests/tic-flashbacks.test.mjs` |
| 恶魔礁与全速恐惧1–4人初始设置 | `tests/tic-scenarios-middle-setup.test.mjs` |
| 07041/07123/07163 提示卡四档难度与 typed 战斗/躲避分支 | `tests/tic-scenario-reference-final.test.mjs` |

开发日志、测试草稿、逐卡SHA、剩余请求和截图放在仓库根目录 `artifacts/migration/tic/p7/`；运行源码不依赖该目录。主路线图中的 P7 已勾选（2026-11-04 收口）。

## 2026-11-04 晚 · P7 收口（多智能体并行轮）

本轮从「44 张缺失 + 0/8 章验收」推进到 **P7 完成**。关键证据（可复算）：

### 1. 单卡：从 44 张缺失到 0 缺口
- 发现并合并嵌套仓库 backup 分支（`backup/local-commits-20261104`）里的上一轮 A1/A2 批实现与读点，净回收 19 张卡；剩余 25 张由 6 个 worker 并行落地：
  w2（07099/07259/07332/07338）、w4（07164b/07165b/07185/07199–07202 + 07166 onReveal/07202 objective）、
  w5（07232/07235/07280–07282/07299/07337）、w7（捕获/押送引擎 + 07233/07252/07252b/07253/07260）、
  w8（并行幕引擎 + 07316–07318）、w6（07060/07061 Harper 两幕 + 内容层 events/roundEnded/flashback14）。
- 逐卡账本 `audit/tic-all-card-acceptance.json`：252 张 = **verified 234 + simplified 17（书面简化）+ no-behavior 1**，`missing=0`、`blocked=0`；10 张共享遭遇卡由 `tests/tic-scenario-shared-encounters.test.mjs`（24 例）补齐。
- 新增引擎机制：捕获/押送（`src/engine/capture.js`）、并行幕（`src/engine/parallel-acts.js`）、
  act/agenda 牌库写入（`setActDeckCards/setAgendaDeckCards`）、洪水连通猎手移动、攻击附加标记、
  地点附属自身行动/封锁、伤害转移、inTooDeep 07124–07127 背面推进等；均带真实测试。

### 2. 八章逐章验收：8/8 × 12 项全绿
- 工具：`tools/audit-tic-scenarios.mjs`（w3 建立，Lead 修 literalScope 跨循环口径）+ `audit/tic-scenario-acceptance.json`。
- 逐章验收测试：`tests/tic-scenario-{thePitOfDespair,theVanishingOfElinaHarper,inTooDeep,devilReef,horrorInHighGear,aLightInTheFog,theLairOfDagon,intoTheMaelstrom}.test.mjs`（10+13+11+7+9+12+26+9 例，全部登记 suites/node-suite）。
- 12 项：sourceLocked / identityRegistered / setupAndZones / actsAndAgendas / locationsAndConnections /
  encounterBehaviors / literalCardBehavior / chaosEffects / resolutionsAndRecords / storyText / saveReplay / browserAcceptance **全部 8/8 通过**。
- 中英文指南：`tools/import-scenario-guides.mjs --check` 54 关通过；叙事 `tools/import-tic-story.mjs --check` 完整（8 章 + 基础 348 段译补）。

### 3. 浏览器验收（desktop 1440 / mobile 390）
- 八章 × 中英 × 桌面/移动共 32 例（`tests/tic-chapters-acceptance.browser.mjs`）+ tic-rules 6 例，
  `node tools/run-tic-browser.mjs` → **38 passed / 0 failed**；`audit/tic-browser-acceptance.json`
  `status:passed, scenariosComplete:true, coverage 4/4, links true, screenshots 68 全 exists`。
- 入口位置（剧本书右侧、混乱标记提示卡下方、折叠/展开、中英切换、加载失败重试、Escape 焦点返回）逐条断言；
  `web/ui-cards.js` 补 TIC 8 章提示卡映射，`games/arkhamhorror-merge` 旧快照归档（避免默认 server 选中旧 Mod）。

### 4. 门禁
- `node tools/audit-tic-scenarios.mjs --check` exit 0（8/8 章 12/12、复算一致）。
- `node tools/audit-tic.mjs --write/--check`：P0–P7 全 verified（TIC `audit/tic-migration.json`）。
- 全量 `test:fast` 绿；`replay-fixtures --compare tests/fixtures/replay/tic-p7-baseline.json` 13 局逐条一致；
  TDE/TCU 既有账本按同一证据链重建后 `--check` exit 0。
- 生产注册：`content/registered.js#ensureInnsmouthCatalogRegistered()` 以目录级（campaign status=development、
  8 章 development）注册 TIC，供内容注册表与反查测试 enumerate；大厅启动开关与 `playable` 升级留待 P8 发布口径。

### 5. 留给 P8 的显式项
- 真实大厅启动链路（生产 manifest/playable、unlock 链、地图布局模块）与发布门禁；
- TIC 行为级 replay baseline（当前 `saveReplay` 证据由逐章 Node JSON 往返支撑，TIC recipe 覆盖 0/8，已在
  `artifacts/migration/tic/p7/workers/w4/browser-acceptance-report.md` §7 记录）；
- 17 条 simplified 卡的行为请求（capture/parallel/harper 相关读点已落地，更多是对既有近似实现的书面简化）。
