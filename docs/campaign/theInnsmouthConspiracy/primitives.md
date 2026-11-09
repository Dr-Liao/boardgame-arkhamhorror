# P0–P3 原语与证据契约

本文件记录《印斯茅斯暗潮》迁移前置阶段交付的通用能力。逐卡规则仍由后续单卡描述子负责；原语可用不表示卡牌、剧本或战役已经可玩。阶段状态以 `audit/tic-migration.json` 为准。

P4 新增的选择、隐私投影和浏览器通路见[交互契约](interactions.md)。`commitOrigins.withdraw(seat,index)` 在判定前收回投入实体；投入与奖励队列同步移除，避免重复结算。`chaosRevealStepEnded` 在存在订阅者时也覆盖普通数字标记。

## 来源、目录与扫描

`tools/scan-tic-scope.mjs` 从卡池与参考工程锁定卡号、关联面、三包分区、八章提示卡、四档初始混乱袋、共享遭遇组、外部依赖及逐文件 SHA-256。`tools/scan-tic-mechanisms.mjs` 对正背面文本分类，登记原语、关键词、规则书、交互、章节和纯内容，并逐段盘点中英指南与幕间来源；分类结果不充当字面行为验收。

P0–P4 将三个 `tic*` 包仅作为目录注册；P5 调查员包的独立开放由[调查员契约及审计](investigators.md)负责，战役和一般玩家包继续为 `catalog-only`。八章各有独立 `scenarios/<id>/index.js`，可在隔离注册表中校验目录合同。完整指南与实际规则尚未交付，因此这些占位章不加入生产关卡列表；P7 提升时必须一起接入完整指南。

可签入、可复算的最小输入保存在 `audit/tic-{scope,mechanism-scan,primitive-plan,primitive-catalog}.json`。大厅根目录 `artifacts/migration/tic/` 存运行镜像、replay 过程基线、日志、控制副本与截图，继续被忽略；不依赖 Mod 下的历史运行目录，也不用放开整个 artifacts 目录。`--check` 只比较，不重新写入报告或基线。

## 通用 API

先复用既有注册与枚举入口，再补下表的域接口。本轮不新增能力 kind、目标 kind 或打出通道。

| 盘点范围 | 既有入口及本轮裁定 |
| --- | --- |
| 能力 kind 与效果 | `src/engine/ability.js` 的 `ABILITY_KINDS`、`normalizeDescriptor` 与 `src/engine/effects.js` 的 `EFFECT_PRIMITIVES`；常规费用、抽牌、伤害、修正继续复用。实际枚举值收入原语目录。 |
| `ctx.api` | `src/engine/engine.js` 组合既有接口；新机制集中由 `api-mechanics.js` 组合，不在单卡建立状态写入入口。 |
| 窗口 | `src/engine/windows.js` 的注册表；新增三类窗口与调用点见下文，其余沿用。实际注册值收入原语目录。 |
| matcher | `src/engine/matcher.js` 的 `all/any/none/not`、座位、地点、敌人、标记与回合判定；新机制通过 API 查询后组合，无需增加通用谓词种类。 |
| 目标枚举 | `src/engine/targets.js` 的 `TARGET_KINDS`、`normalizeTarget`、`enumerateTargets`；敌人、调查员、地点、支援和手牌沿用原枚举。彩色钥匙、封印实体及乘客选择留给 P4 接入现有选择事务，不能伪装为已完成的卡牌目标交互。 |
| play channels | `src/engine/play-channels.js` 的 `createPlayChannels`；弃牌堆、威胁区、宿主下方、直觉、附属事件、背包及原定计划沿用既有打出协议。特殊投入由 `commitOrigins` 复用权威投入入口，不另建“如同手牌”通道。 |

单卡通过 `ctx.api` 使用以下域接口；章节运行时通过 `api.mechanics` 使用同一套接口。所有有选择或可中断副作用的调用都必须在现有规则事务中执行。参数错误抛错；资源不足或无合法目标返回 `false`／`null`，不能先支付部分费用再失败。

| 原语 | 入口与参数 | 约束与读点 |
| --- | --- | --- |
| `chaos.pool` | `chaosTokens.count/room/add(token,count,{exact})`、`pay(token,count,{sealed,selection})`、`replace(from,to,count,{exact})` | 祝福与诅咒分别最多 10 个；袋内、已揭示、封印区共用物理池。效果尽可能加入，费用使用 `exact:true` 并完整预检。支付可显式指定袋内／封印来源，重复或非法选择不扣费。 |
| `chaos.pool` 的轮末操作 | `chaosTokens.scheduleReplacement(from,to)` | 纯 JSON 记录本轮结束时的替换，`phases.js` 轮末结算，包含轮中后来加入的标记；出队后不重复执行。 |
| `chaos.seal` | `chaosTokens.seal(sourceId,token,count,{exact})`、`release(sourceId,token,count,{toPool})`、`revealSealed(sourceId,token)` | 按实例区分来源；释放回袋，`toPool` 回池。封印替代揭示进入当前检定的物理揭示区；支援离场沿用统一释放读点。 |
| `chaos.resolution` | `chaosTokens.treat({index,as,modifier,cancel,stop,retain,autoSuccess})` | 按物理标记下标处理，不把所有同面标记混为一枚。取消、停止继续揭示、修改修正与结束后去向分别声明。`tests.js` 的揭示管线读取，`chaos-bag.js` 收尾消费／归还。 |
| 检定外揭示 | `chaosTokens.inspect(count)` | 不结算祝福／诅咒的固有效果，不追加揭示、不消耗；检定结束清理逻辑不与普通揭示混用。 |
| `location.flood` | `water.level(id)`、`effectiveLevel(seat,{reduce,immune})`、`set(id,level,{cannotIncrease})`、`change(id,delta,options)` | 等级 0／1／2；变化夹取，非法等级拒绝。载具的 `protectsFromFlood` 参与有效等级。淹没本身不产生固有伤害。 |
| `investigator.air` | `water.beginAirTurn(seat,{damage,protectedFromAir})`、`endAirTurn(seat)` | `scenario.mechanics.water.air` 可接入回合开始；位移、淹没变化与回合结束检查风险。已获得空气后本回合不会再次创建同一次风险；伤害走直接伤害入口。特别卡牌／议程的豁免由其描述子按来源传入，不按卡号判断。 |
| `scenario.keys` | `keys.initialize(specs)`、`at(target,{reveal})`、`placeRandom(target)`、`claim(seat,color)`、`transfer(color,from,to,options)`、`give(from,to,colors)`、`spend(seat,color,to)`、`onExit(target,location,seat)` | 一种颜色一个实体；隐藏查询只返回 `unrevealed`，随机放置不返回颜色。取得需地点无剩余线索；转交必须同地点并拥有钥匙。敌人击败／移除、调查员淘汰及支援离场有清理读点。花费默认放到提示卡区域 `reference`。 |
| `scenario.vehicle` | `vehicles.register(id,{location,capacity,running,protectsFromFlood})`、`of/accessError/enter/leave/running/move/remove` | 每轮共用一次上下车机会；在车内不能独立移动。移动预检所有乘客并走权威位移入口，保留进入地点、揭示及敌人跟随语义。动态阻止移动时抛错，由整个规则事务回滚。多名剩余乘客需明确选择驾驶者，淘汰读点接入此选择。 |
| `location.graph` | `map.paths(from,to,canEnter)`、`distance(from,to)`、`neighbors(cells,cell)`、`initializeRoad(spec)`、`extendRoad(from,count)` | 最短路径保留等长选择，洞穴仅正交相邻。道路首张来自道路牌库，补绕路牌、确定性打乱后放入前方新列；有前方地点时不重复扩展。同列不相连，相邻列全部互连。地点 id 必须对应章节定义。 |
| `campaign.recordSet` | `recordSets.values/add/remove`、`claimReward(id)` | 集合增删幂等，只读不初始化。调用方只在首次领取成功时结算奖励，并与记账处于同一事务。记忆、嫌疑人、藏身处的剧情含义留在内容层。 |
| `test.commitOrigin` | `commitOrigins.beneath/store/take`、`commit(seat,{host,code,from,retain})` | 原区可为宿主下方或弃牌堆，投入复用既有资格／费用／图标入口。失败恢复原区顺序，`retain` 的宿主下方牌在检定结束时返回原宿主；不能复制一张牌同时留在两个区。 |
| `deck.traitLimit` | `validateTraitLimits(codes,cards,limits)`，经 `validateDeckRules` 统一调用 | 不同卡名、职业、等级的契约共用单张上限；初始构筑、部分构筑及升级共享校验。错误提示使用中英文词典。 |
| `turn.promise` | `promise(seat,sourceId,event)` | `draw/play/commit` 三种事件，限自己的回合。抽牌、打出和投入都有读点，首次违背触发 `promiseBroken`，同一声明不重复触发；来源离场后失效。卡牌的惩罚由描述子结算。 |
| `uses.transfer` | `useTokens.move(fromId,toId,type,count)`、`spend(seat,assetId,type,count,providers)` | 同地点转移秘密／充能或合并支付；调用方提供卡面允许的代付来源，原语检查实体、区位、类型和总量；费用不足无部分扣除。 |
| `enemy.immunity` | `effect-provenance.js` 的 `enemyIsSlumbering / enemyEffectAllowed / enemyPlayerEffectBlocked / enemyModifierAllowed`；条目键 `enemyRule.slumbering`（布尔，注册期校验） | 沉睡＝免疫调查员行动与玩家卡效果，遭遇/剧本来源照常；判定读**当前印刷面**，换面/文本抹除立即失效。动作与伤害入口 fail-closed，写入口只拒绝「明确来自玩家卡」的效果。读点：`legalMoves`/`validateMove`（攻击/躲避/额外躲避/交战）、`canDamageEnemy`、`enemyAttack`、`engageEnemy`（交战是无条件的）、`targets.js` 的敌人类目标枚举、`entityModifierTotal`/`entityRuleActive`/运行期 `statMods` 修正行。 |
| `enemy.aloof` | `enemy-aloof.js` 的 `enemyIsAloof(state,enemy,{isBlanked,entryOf})`；条目键 `enemyRule.losesAloofWhen(state,enemy)`（函数，注册期校验） | 实例布尔（印刷/藏身处/剧本授予）之上再求值印刷正文里的**连续条件**（07086「有调查员没有手牌时失去冷漠」）；条件不写 state。读点：`aloofPreventsAttack`（攻击合法性）、`engagesAutomatically`（自动交战）、`describe` 的关键词展示。 |
| `encounter.search` | `scenario-runtime` 的 `takeEncounterCard(code,{pile})`、`canEnemyEnterLocation(codeOrEnemy,locationId)`；共享写法 `_shared.js` 的 `searchEncounterEnemyAndSpawn`；`api.discardChosen(seat,n,source)`（实体能力面委托场景运行时同一实现） | 搜索遭遇牌库/弃牌堆的**唯一**取出入口（牌库按顶到底），`canEnemyEnterLocation` 与生成/猎人移动共用同一份 `enemyOnlyTraits` 判定；候选过滤、选择、生成、交战、洗牌由共享写法一次完成（07090）。`discardChosen` 是「选择并弃掉手牌」的唯一实现（07088 此前调用能力面同名方法会拿到 undefined）。 |
| `parley.forbidden` | `parley.js` 的 `parleyForbidden(state,inv,entity)`；实体规则目标 `cannot:parley`、能力禁止 `capability:parley`；实体规则目标 `loses:aloof`（读点 `enemyIsAloof`） | 「不能谈判」与「失去冷漠」的唯一读点：`parleyMoves`（合法性枚举）与 `parleyTargetError`（`validateMove`/执行前校验）共用，伪造命令同样被拒。幕/议程行默认被 `entityRuleActive` 跳过，这两条按印刷是全局规则，单独在 `SCENE_ENTITY_RULES` 里放行（07124–07127）。 |
| `aside.hazard` | `scenario-runtime` 的 `putNextToAgenda(code)`；`treacheryRule.discardOneAtRoundEnd`（轮末每轮最多弃 1 张同名副本）；修正 `audience:'all'`（无控制者来源） | 「放到密谋牌库旁」的遭遇卡是真实旁置实例，同时是**修正来源**：`entityModifierRows` 的 `aside` 行（07095「每个地点隐藏值 +1」）与 `modifierSourceRows` 的旁置行配合 `audience:'all'`（07107「调查员不能谈判」）。旧口径 `discardAtRoundEnd`（弃掉这张卡，全部副本）保持不变。 |
| `enemy.damage.sourceTraits` | 条目键 `enemyRule.damageReductionExceptSourceTraits: { amount, minimum, traits }`（注册期校验）；读点 `combat.js` 攻击伤害段 | 按**攻击来源卡**特性减伤（07094）：武器取 asset 卡号、事件取 `sourceCode`，空手攻击同样减伤；下限按 `minimum`。与 `damageReductionWhileExhausted` 同一位置，不影响非攻击来源的伤害。 |
| `spawn.mostClues` | 条目级 `spawnMostClues`；读点 `enemies.js#spawnEnemy`（与 `spawnFarthestFromAll` / `spawnAncientFirst` 同段）；`api.scenario.preventEnemyReady(enemy, rounds)`（既有） | 「生成 - 线索最多的地点」（07105）：已揭示地点并列时由领队选择，`api.spawn(ignoreSpawn=true)` 的剧情生成点优先。`preventEnemyReady` 写 `enemy.preventReady`，读点是补给阶段的重整判定。 |
| `investigator.trait` | 授予目标 `add:investigatorTrait`（`GRANT_TARGETS` 第五种，需 `value`）；读点 `stats#investigatorTraits` / `investigatorHasTrait`，卡面入口 `api.investigatorTraits` / `api.investigatorHasTrait` | 「你获得某特性」（07106 深潜者）：与 `add:trait`（这张卡自己）分开，授予的是**控制者本人**；读点合并卡面特性 + 运行期 `inv.traits`（04085）+ 声明式授予，去重且大小写不敏感；卡离场时授予随修正行消失，不写 `inv.traits`。注意修正管线的 `maxHealth` / `maxSanity` 目标目前**没有读点**，威胁区的神智/生命惩罚请用 `threatEffect.sanityModifier` / `healthModifier`。 |
| `movement.surcharge` | `actRule` / `agendaRule` 的 `movementActionSurcharge`（数字或 `{ amount, betweenTraits? }`，注册期校验）；读点 `turn-flow.js#actionCost`；求取空气由 `flood.js` 的 `beginAirTurn` / `checkAirAfterMove` / `endAirTurn` 承担 | 「你不在载具上时，作为在[[海洋]]地点间移动的额外费用，花费 2 行动」（07164–07166）：只加在**基础移动行动**上，起止地点都要带 `betweenTraits` 特性，载具上的调查员不付；当前幕/议程的条目相加。「求取空气」由 `scenario.mechanics.water.air` 驱动，不需要条目再声明。 |
| `vehicle` | `api.mechanics.vehicles.*`（能力面与 `api.vehicles.*` 同一实例）：`register / of / accessError / enter / leave / setDriver / running / move / remove`；状态在 `mechanicState.vehicles`，id = 剧情支援实例 id | 载具移动会逐个用权威位移入口搬乘客（任何一位的目的地校验失败整段不生效），并同步**载具物理卡的 location**（否则下一次 `[action]` 的范围判定会读旧地点）。`leave` 记 `vehicleAccess[seat] = round`，「本轮不能再进入」直接复用这个读点（07187）。载具的 `protectsFromFlood` 让乘客的有效淹没等级为 0，同时豁免求取空气。 |
| `vehicle.restriction` | 敌方：`enemyRule.engagedRestrictions: ['enterVehicle','gainResources']`（读点 `enemy-entry.js#enemyEngagedRestricts`）；威胁区：`treacheryRule.forbidsVehicles: true`（读点 `vehicles.js#vehicleAccessError`）；资源获得读点 `resource-bank.js#gainResource` | 「与你交战时你不能进入载具或获得资源」（07183）与「你不能进入载具」（07188）：两条都只禁**进入**、不禁离开；威胁区那条随卡离场自动失效，敌方那条随交战状态失效。资源获得在 `gainResource` 的唯一入口处返回 0。 |
| `storyAsset.remove` | `api.scenario.removeStoryAsset(id)`（id 可写实例 id 或卡号） | 「将这张剧情支援从游戏中移除」（07168 渔船）：只从场上移除、**不进弃牌堆**，并触发 `storyAssetLeftPlay` 离场清理。载具类还要同时 `vehicles.remove(id)` 注销登记表。卡面「你在某辆载具上」用 `_shared.js#vehicleAssetOf(state, seat)` 读（`vehicleOf` → 载具物理卡）；乘客快照用 `vehiclePassengers`，两者在叶子模块 `vehicle-state.js`，避免卡条目 import `vehicles.js` 造成 ESM 循环。 |
| `road.hazard` | 条目 `locationRule.vehicleLeft` / `vehicleEntered`（事件 `{ vehicleId, seats, origin, destination }`）；分发 `road-hazards.js#dispatchVehicleEvent`（由 `vehicles.moveVehicle` 回调）；记账 `api.roadHazardOnce(locationId, vehicleId)`；支付 `api.payGroupClues(amount, { atLocation, allowShort })`；共享工厂 `_shared.js#roadHazardCharge` / `roadHazardSufferer` | 道路危害模板（07204a–07210）：乘客快照 → 每载具每场一次 → 地点调查员共同支付（付款人是**车开走后**仍在该地点的人）→ 差额按卡结算。空车不触发也不烧记账。衍生物：`api.removeVehicleFromGame(id)`（07205）、`api.discardEncounterUntilSpawn({ trait, location })`（07209）、`api.mechanics.vehicles.lockUntil(id, round)`（07210，读点在 `moveVehicle`）。 |

新增窗口（都只在真有监听者时开窗，空窗口不改重放指纹）：`investigationPhaseEnds`（调查阶段结束，`runBetweenInvestigationPhases` 起始处；07330a/07331a）与 `enemyDamaged`（敌人受到伤害后，`damageEnemy` 与普通攻击路径都派发；07330b/07331b 的镜像强制）。探测入口是 `window-listeners.js` 的 `hasWindowListener`。

`keys` 的目标格式为 `location:<id>`、`investigator:<seat>`、`enemy:<id>`、`asset:<id>`、`setAside`、`reference` 或 `removed`。隐藏颜色只供受信任的规则代码读取；P4 的公开投影与交互仍须独立验收，不得直接向客户端发送权威钥匙表。

新增时机为 `chaosTokenResolved`、`chaosRevealStepEnded` 和 `promiseBroken`。前两者分别在祝福／诅咒结算后及揭示步骤结束后接线，后者由三类卡牌事件接线；注册与调用必须同时保留。标记的 `index` 取自相应上下文或 `tokens[]`，不要用卡面字符串代表一枚物理标记。

## 存档与复用边界

P6 的玩家卡扩展登记在 `primitive-catalog.playerExtensions`，请求处理见 `audit/tic-player-queue.json`，逐卡使用及测试见[玩家卡验收](players.md)。`playerTools` 是 `createPlayerApi` 提供的域接口；单卡不得直接修改该接口内部字段。`additionalTokenCost` 校验 token、操作、计数和封印范围；能力费用新增 `damage / doomOnSource / drawEncounter`，都走统一费用求值和预检。

`assetRule` 的 P6 声明包含共享秘密、同地点免费能力、额外交战、宿主额外法术槽、任意同地点控制者、无限容量、敌人入场伏击及无封印即弃掉。声明均在能力注册时校验，由资产、伤害、行动、入场或费用管线读取。`playTimingProvider` 返回快速时机、折扣与费用，由行动枚举及执行使用相同的实体来源；空白来源不可提供该能力。`deckConstruction.minimumTypes` 在构筑及升级共享校验，不能把无等级的专属牌当作等级 0 回收。

P6 续算使用可选 JSON 字段：`asset.paidX / restrictedActionSpent / capturedCards`，`playerWindowOccurrences`，以及当前检定的 `baseSkillOverride / tokenRedraws / ignoredTokenModifiers / rerollGuard / tokenRewards / releaseAfterTest`。读取存档时校验类型、非负计数、实体 ID、席位及弱点身份；旧存档缺少这些字段时不补写。测试覆盖 JSON 往返、非法续算、物理副本区分、额外行动后的回合推进和同地点费用支付。

新增机制懒初始化到既有 `scenarioFlags` 的可选扩展 `mechanics`，内部带 `version:1`；未使用的旧战役不会新增该字段。`save-migration.js` 在普通存档、续算基底和并行线读取时校验此扩展，拒绝未知版本与非法数据。这里扩展的是既有 JSON 容器，不提升顶层 schema；旧存档缺少该扩展时保持原状。以后若改变扩展形状，必须明确升级扩展版本并登记迁移，不能静默补解释。

原语计划同时登记已有的行动历史、使用次数、常规效果、研究升级、构筑、敌人和遭遇管线。本阶段不创建任何单卡行为文件，也不改变索引或放行卡牌。研究完成的具体日志键、特殊卡牌的豁免、幕／议程与玩家卡能力必须在 P5–P7 用实际描述子接线后才能确认字面行为。发现新的可复用缺口时重新打开对应原语项，按队列处理，不能绕过 `ctx.api`。

## 验证和可复算证据

在 Mod 目录执行：

```powershell
npm run scan:tic:scope:check
npm run scan:tic:check
npm run test:tic
node tools/verify-tic.mjs --node
npm run test:tic:rules:browser
node tools/verify-tic.mjs --regression
npm run audit:tic:primitives
npm run audit:tic:check
```

`verify-tic --node` 与浏览器 reporter 记录实跑结果及源码哈希；验收期间源码变化或验收后源码漂移时，审计不能继续使用旧的通过结果。原语计划中的 `done` 来自当前有效的专项测试和回归证据，不是手填状态。

修改前的工作区本来就有快测失败；初始标题清单和原始 replay 保存在 `audit/tic-baseline.json` 与 `tests/fixtures/replay/tic-baseline.json`。并发工作区改动导致失败集合变化时，`tools/tic-control-regression.mjs` 在大厅根 artifacts 中建立副本，仅在副本关闭本轮的目录、API 与特性限制接线，再复跑相关既有用例；不重置用户文件，不改写最初基线。`audit/tic-regression.json` 分开记录初始既有失败、控制副本复现的并发漂移及仍需修复的新增失败。

回放也保留两层比较：先对照最初基线；如有漂移，再逐步比较同一源码版本的运行结果与控制副本。只有全部逐步哈希一致，才能把该差异记为并发工作区漂移；报告中的 `matchesOriginalBaseline` 与 `matchesContemporaneousControl` 分开保留，不能把后者表述为“原始基线全部一致”。任何未在控制副本复现的新增失败仍会阻止 P2、P3 确认。

截图在 `artifacts/migration/tic/reports/screenshots/`，浏览器过程资料在本轮独立目录。Node、浏览器和回归运行均须重新验证当前源码后，才能重写并通过总审计。
