# 七循环《地球边缘》通用原语与证据契约（P2）

本文记录《地球边缘》（Edge of the Earth）在批量卡牌（P5–P7）之前交付的**通用原语**：API、读点、状态与存档、注册期校验、失败语义与测试证据。原则：

- 原语可用**不代表**任何卡牌、剧本或战役已可玩；逐卡字面行为在 P5–P7 逐张验收，最终以 `audit/eote-migration.json` 为准。
- 卡牌/关卡只能通过 `ctx.api` 或已登记的描述子使用这些接口，不得直接写状态；引擎里没有按卡号/关卡名的分支。
- 先复用再新增：可复用项在目录里标 `reuse` 并给出读点；新增项标 `extend` / `new`，每项都有正常与负面路径测试。
- `escape` 保持为空：本轮没有「只服务单张卡的一次性 resolve」需要登记。

可复算输入：`audit/eote-mechanism-scan.json`（P1 扫描）、`audit/eote-primitive-plan.json`（本阶段计划与状态）、只读 `audit/eote-primitive-catalog.json`（目录快照）。生成与校验：

```powershell
node tools/audit-eote-primitives.mjs --write   # npm run plan:eote:primitives
node tools/audit-eote-primitives.mjs --check   # npm run audit:eote:primitives
node tools/verify-eote.mjs --node              # audit/eote-node-acceptance.json
node tools/verify-eote.mjs --regression        # audit/eote-regression.json（test:fast + replay 对比）
```

## 1. 状态与存档（可选扩展，不提升顶层 schema）

EotE 新增状态放在既有 JSON 容器的可选扩展里（`src/engine/eote-state.js`），带 `version: 1`：

| 容器 | 路径 | 生命周期 | 说明 |
| --- | --- | --- | --- |
| 场景级 | `state.scenarioFlags.mechanics.eote` | 单关／单章节 | `shelter`（营地与已揭示地点）、`climb`、`city`、`tekeli`（元数据）、`facilities`、`towerSeals`、`deckTop`、`crossSeat`、`roundDistance` |
| 战役级 | `state.campaign.eote` | 跨关持久 | `partners`、`seals`、`memorials`、`supplies`、`mirage`（幻景版本快照）、`disciplines`（演武） |
| 复用容器 | `mechanicState.keys` / `mechanicState.scenarioDecks` | 单关／跨关 | 数值钥匙条目标 `kind:'value'`（彩色钥匙读点全部过滤、行为零变化）；忒咳哩-哩牌实体复用 `scenarioDecks.tekeli` |

- **读点从不初始化**：`eoteScenarioState(state)` / `eoteCampaignState(state)` 默认 `create=false` 返回 `null`；旧存档、旧战役读到的是字节不变的状态，旧存档缺少整个扩展时所有校验跳过。
- 首次真正使用某原语时才 `create=true` 建立容器；容器与子记录形状由 `validateEoteContainers` + 各模块的 `validateEoteXxx` 校验。
- `save-migration.js#migrateState` 在读档（普通存档、续算基底、并行线）时调用 `src/engine/eote-primitives.js#validateEoteState`，非法形状直接拒绝读档，不在新规则下静默续算。
- 本轮**不提升** `STATE_SCHEMA_VERSION` / `RULES_VERSION`（与 TIC/TDE 的「可选扩展」口径一致）；以后改变扩展形状必须显式提升 `version` 并登记迁移。

## 2. 通用 API 总表（P2 实现项）

单卡/章节通过 `ctx.api.mechanics.*` 使用；参数错误抛错，资源不足或状态非法返回 `false`/`null` 且不产生部分写入。

| 原语 | 入口与参数 | 约束与读点 |
| --- | --- | --- |
| `chaos.frost` | `frostPoolCount(state)`、`frostPoolRoom(state)`、`addFrost(state,count,{exact})`、`payFrost(state,count,{sealed,selection})`；常量 `FROST_POOL_LIMIT=8`、`EOTE_FROST_STATE=null` | 寒霜 8 枚实物，袋内＋本次检定揭示区＋封印区共用同一物理池（`POOL_LIMITS.frost=8`，与祝福/诅咒共用 count/room/add/pay/replace/seal/release 读点）；满池普通加入返回 0、`exact:true` 返回 false 且不写入；支付不足无部分扣减；寒霜不参与轮末替换表。规则读点 `extraRevealForFrost(token)`、`shouldAutoFailForFrost(drawn)` 与既有 `tests.js` 结算一致；`combat-odds.js` 预览 frost = -1。无新增持久状态。 |
| `chaos.tokenEffects` | `chaosTokens.treat({index,as,modifier,cancel,stop,retain,autoSuccess,toPool})`；`as` 白名单新增 `frost` | `setTokenTreatment` 只改揭示后的结算面，物理标记仍按原面归还；`as:'frost'` 使该枚进入 frost 分支（-1、追加揭示、第 2 枚自动失败），`modifier` 可覆盖本次修正（地点「首枚 frost 视为 -3」，如 08604/08623 的规则）；未知 `as`/字段仍抛错。 |
| `campaign.partner` | `initializePartners(state,{partners:[{code,damage,horror}],resoluteForms?})`、`partnerState`、`partnersWithStatus`、`remainingPartners`、`adjustPartnerHarm`、`setPartnerStatus`、`isPartnerAlive`、`resoluteFormOf`、`chooseMissingPartners(state,shelterValue,random)`、`validateEotePartners` | 状态 `campaign.eote.partners.roster[{code,damage,horror,status,resolute?}]`。四态 safe/mia/eliminated/resolute；非法转移返回 false 不写；伤害/恐惧非负、治疗下限 0。检查点 I：存活伙伴洗混后前 `shelterValue` 名安全、其余记 MIA（random 注入时确定）。名册与坚毅替换由内容层初始化，引擎不写卡号。 |
| `campaign.seals` | `initializeSeals(state,{kinds})`、`sealState`、`sealsOf`、`placedSeals/activatedSeals/heldSeals/sealsAt`、`placeDormantSeal`、`recoverSeal`、`activateSeal/deactivateSeal`、`placeSeal`、`unplaceSeal`、`validateEoteSeals` | 状态 `campaign.eote.seals.entries[{kind:'A'–'E',active,placedBySeat,locationId}]`。生命周期：剧本强制休眠放置 → 取回控制 → 激活一次 → 放到门/高塔；放置要求 active+未放置+控制者本人；`deactivateSeal` 仅用于剧本重置；`unplaceSeal` 回到休眠无控制者。座位/地点引用校验，非法操作抛错或 false 无部分写入。 |
| `campaign.memorials` | `initializeMemorials(state,{entries:[{partnerCode,relicCode}]})`、`memorialFor`、`crossedOutMemorials`、`claimedMemorials`、`claimMemorial`、`claimAllAtInterlude`、`validateEoteMemorials` | 状态 `campaign.eote.memorials={entries,claimed?}`。伙伴 eliminated/mia 视为已划去；同一伙伴只能领取一次（重复/未划去返回 null，批量幂等）；返回遗物卡号，加入牌组由调用方用既有 `campaignCardChange`。 |
| `campaign.supplies` | `initializeSupplies(state,{items,recoveredKey})`、`supplyItems`、`supplyCarrier`、`carriedSupplies`、`assignSupply/releaseSupply`、`dropSupplyAt`、`recoverSupply`、`recoveredSupplies/missingSupplies/droppedSupplies`、`validateEoteSupplies` | 状态 `campaign.eote.supplies={items,recoveredKey,carriers?,dropped?}`；回收唯一权威是 `campaign.records[recoveredKey]`（默认 `SuppliesRecovered`，复用 record-sets）。同一物资至多一名控制者，控制与掉落互斥。「Uses (N supplies)」次数仍走既有 uses，本原语不消费次数。 |
| `campaign.flows` | 现有节点类型 + `stepReturn {type:'stepReturn',rules:[{id,when,next,effects?}],next}`（有序首命中回场）、`completedCampaignSteps(campaign)`、条件 `{completedStep:'id'|['id',…]}`；导出 `STRUCTURAL_NODE_TYPES`/`BRANCH_NODE_TYPES`/`COMPLETED_STEP_RECORD_KEYS`、`campaignGraph`/`validateCampaignGraph` | 检查点/幕间分支 = 相邻 `partGate`（0→next、1→自动、≥2→问玩家）；`stepReturn` 实现参考 `nextStep` 的有序 if/else 链（`branch` 要求唯一命中，幻景回场两主线都完成时会抛错）；`completedStep` 并集 `scenarioResults` 与 `records.completedSteps`/`campaignCompletedSteps`。注册期 `validateCampaignGraph` 失败关闭：未知节点/出口、非分支节点写 options、选项 id/next、条件语法（含 recordSchema 类型匹配）、效果与挂起效果白名单。读点：`content/registry.js#validateCampaignGraph`（注册）、`campaign-flow.js#walkCampaign`/`flowCondition`/`completedCampaignSteps`（运行）。 |
| `campaign.epilogue` | `isEpilogueBranches(table)`、`normalizeEpilogueBranches(table)`、`resolveEpilogueBranches(table,campaign)`、`flattenEpilogueBranches(table)`；表形状 `{records,rows:[{id,when,title?,textKey?,section?}]}` | rows 按声明顺序多条可同时命中（EotE 尾声：4 组伙伴配对 + Ashevak + 肯斯勒研究 + 丹佛斯 + 封印/回收计数）；`when` 只允许记录条件（record + equals/atLeast/includes，嵌套 all/any/not），匹配复用 `flowCondition` 单一语义源；注册期拒绝重复 id/未知记录/类型不符；坏表 resolve 失败关闭（branches=[]）并给中文 reason。TDE 双轴矩阵原函数与语义保留。 |
| `scenario.mirageVersions` | `MIRAGE_VERSIONS`、`mirageState/mirageVersion/mirageVisitCount/mirageTotalVisits/nextMirageVersion`、`noteMirageVisit(state,version)`、`saveMirageVersion(state,version,snapshot)`、`restoreMirageVersion(state,version)`、`validateEoteMirage` | 状态 `campaign.eote.mirage={version,visits,snapshots}`（复用 eote-state 容器与版本）；I→II→III 顺序强制、最多 3 次、重复记录当前版本幂等；snapshot 是版本作用域场景局部纯 JSON 深拷贝（拒绝 undefined/函数/NaN/Date）；`restoreMirageVersion` 只返回副本不写状态；主线 records/parts/xp/trauma/scenarioResults 全程不被触碰；读点从不初始化、非法不落部分写入。 |
| `location.shelter` | `readShelter(def|location)`、`locationShelter(state,id)`、`campShelter(state)`；常量 `SHELTER_MAX=9` | Shelter 是印刷数据（`shelter` 字段或 `meta.shelter`，缺省 0），只读不写；合法 0..9，非整数/越界抛错，未知地点抛 RangeError；`campShelter` = 营地地点庇护值（无营地返回 null）。检查点 I「按庇护值保护伙伴」由内容层用该值随机。 |
| `scenario.camp` | `campLocationId`、`setCampLocation`、`revealedLocations`、`recordRevealedLocation`、`inheritRevealedLocations`、`campState`、`validateEoteCamp` | 状态在场景级 `eote.shelter = { camp?, revealed? }`（营地与庇护值规则绑定）；营地 id 必须来自 `state.locations`；检查点继承先整体校验再写入、返回新增条数；跨关营地记录属战役层。 |
| `scenario.facility` | `initializeFacilities(state,{facilities:[{id,kind}],towers:[...]})`、`facilityState`、`activateFacility`、`destroyFacility`、`validateEoteFacilities` | 设施/高塔 id 都是 `state.locations` 的场地地点；建局严格校验字段白名单、id/`towerIndex` 唯一、重复初始化抛错；设施状态 `{kind,activated,activatedBy?,destroyed}`，激活只能一次、摧毁幂等。15 设施/5 高塔只是内容数据。 |
| `scenario.sealTowers` | `towerState`、`towerHealth`、`damageTower`、`collapsedTowers`、`towerSeals`、`placeTowerSeal`、`removeTowerSeal` | 状态 `eote.facilities.towers.<id>` + `eote.towerSeals={towerId:sealId}`；生命=显式 health 或地点线索值，伤害夹取、打满置 collapsed（幂等、超额不溢出）；封印 id 对引擎不透明，单塔单封印、跨塔唯一；激活/控制权归 `campaign.seals`，坍塌塔仍留场。 |
| `scenario.keys` | `initializeValueKeys(state,[{id,value,holder?}])`、`valueKeysAt`、`spendValueKeys(state,target,{values,destination?})`、`valueKeyIds`；常量 `VALUE_KEY_FACES`、`VALUE_KEY_VALUE_LIMIT=9` | 《古老者之城》物理钥匙卡（identity：skull/cultist/tablet/elderthing 或 -9..9），与 TIC 彩色钥匙两套 identity，复用 `mechanicState.keys` 容器（数值条目 `kind:'value'`；彩色读点全部按 kind 过滤、行为零变化）；花费是多重集原子配对，不足/不匹配返回 false 且无部分花费；数值钥匙始终正面朝上。 |
| `location.vertical` | `locationLevel(state|location)`、`setLocationLevel`、`levelsOrdered(target)`、`levelNeighbors(state,id)`；`validateEoteLevels` | 印刷 Level 是地点对象字段（0 = 山脚，与 TDE `verticalIndex` 是两套语义）；`levelsOrdered` 未声明 Level 排最后；`levelNeighbors` 按既有 connections 分 above(+1)/below(−1)/sameLevel；非负整数校验。 |
| `scenario.climb` | `climbDestinationError`、`ascend(state,inv,toId)`、`descend`、`climbState`、`fallDamage(state,from,to)`、`cluesLostOnMove(state,inv,{clueCount})`、`dropExpeditionAssets(state,inv,{assetIds})`；`validateEoteClimb` | 合法攀登 = 既有连接 + Level 差恰为 ±1（跨层拆多次移动）；`ascend` 返回 `{seat,from,to,fromLevel,toLevel,direction:'up',enterFromBelow:true}` 并只写瞬时标记 `eote.climb.seats[seat]`（位移仍走权威管线）；`cluesLostOnMove`/`dropExpeditionAssets` 只返回应处理的数据、不改 inv；非法状态返回 false 无部分写入。 |
| `location.grid`（城市扩展） | `configureCityscapes(state,{rows,columns,layout})`、`cityscapeOf`、`revealedGrid`、`lookRow/lookColumn`、`teleportGrid`、`moveAcrossGrid`、`validateEoteCityscape`；原 7 个网格导出（`gridPosition/gridLocations/connectGrid/configureGrid/placeGridLocation/connectGridPair/expandGridFrom`）全部保留 | 布局 `eote.city.cityscape`（row=y, column=x）；同布局幂等、不同布局抛错；公开投影省略未揭示格（不泄露名称/卡号）；传送/跨格移动只校验规则并返回 transition，不搬调查员。 |
| `scenario.cityVote` | `initializeCity(state,{cityscapes:[...],keys?},{shuffle,placeLocation})`、`cityscapes`、`visibleOnRow/visibleOnColumn(state,index,{seat})`、`keyOnLocation`、`placeKey/takeKey/moveKey/swapKeys`；`validateEoteCity` | 16 格随机分配（注入 shuffle 或 randomValue），候选不足/坏回调/格子被占返回 false 且零写入；`visibleOn*` 无 seat = 仅已揭示公开投影，带 seat = 私密窥视（含揭示面身份，只能发给该座位）。钥匙只按 card/marker id 簿记，不与其它模块耦合。 |
| `scenario.tekeliDeck` | `initializeTekeliDeck(state,{cards,copies?})`、`tekeliShuffleIn(state,seat,count,{shuffle})`、`tekeliDraw`、`tekeliReturn(state,code,{destination,seat,shuffle})`、`tekeliDeckSize`；`validateEoteTekeli`；底层 `scenario-decks.js` 的隐藏洗入/抽/回底/张数 | 卡面/份数由参数传入（缺省 7 面 × 3+3+2+2+2+2+2 = 16 张）；牌实体复用 `mechanicState.scenarioDecks.tekeli`，元数据 `eote.tekeli`；洗入不查看、只回受信任 code，观察者只能看张数；默认回牌库底；随机性只走 randomValue 或注入 shuffle。 |
| `physical.faces` | `planPhysicalFace`、`planAssetFaceFlip(entity,nextCode,{definitionFor,pairs?})`、`applyPhysicalFace` | 只出换面计划不执行；支援双面（Unbroken/Broken）显式 `pairs` 时补 linked 元数据后复用资产换面；实例 id/横置/控制权/附属/uses 不随计划改变；敌人换面路径不变。 |
| `investigator.deckTop` | `revealDeckTop(state,seat,{public=false,discount=0})`、`deckTopCard`、`clearDeckTop`、`markDeckTopPlayed`、`deckTopDiscountUsed`、`playDeckTop(state,seat,{discount,cost})`、`deckTopWeaknessDraw` | 状态 `…eote.deckTop={seats,played}`；顶牌=牌库数组末尾，揭示不移动牌；默认私密、`public:true` 才公开；每轮一次按回合号记账；弱点按 subtype 判定后移入手中并清揭示；空牌库/无揭示返回 false。打出经 `play-channels` 的 `deckTop` 通道（折扣来自状态）。 |
| `investigator.roundDistance` | `roundStartLocation`、`noteRoundStartLocation`、`travelDistance`、`roundDistanceReward` | 状态 `…eote.roundDistance={seat:locationId}`；距离由 `map-graph.js#roadDistance` 现算不存派生值；未记录/未定位/不连通 → null（奖励 0）。 |
| `investigator.crossSeatPlay` | play-channels 的 `otherHand` 通道 + `grantCrossSeat(state,seat,{fromSeat,codes,costSplit?})` / `clearCrossSeatGrant` / `crossSeatData` / `validateEoteCrossSeat` | 状态 `…eote.crossSeat.grants={seat:{fromSeat,codes,costSplit?}}`；枚举同地点、非本人、asset+[[Item]]、授权 codes 内且真实在对方手牌；move 暴露 `fromOtherHand/ownerSeat/crossSeatCostSplit`，uiKey `otherHand:<ownerSeat>:<code>`；授权先整体校验再写入；控制权与费用分摊留给集成层（本原语 no card effects）。 |
| `investigator.discipline` | `initializeDisciplines(state,{sets:[{unbrokenCode,brokenCode,burdenCode}]})`、`disciplineFace/faceCode`、`flipDiscipline`、`disciplineBurden`、`bondsOfDiscipline`、`selectDisciplines(state,{available,count,random})` | 状态 `campaign.eote.disciplines={sets,faces,selected}`（跨关持久）；两面卡号各自全局唯一；`to` 缺省切换、同面返回 changed:false；命运重担同卡可被多组共用；选择必须注入确定性 random；重复 initialize/未知卡号抛错。 |

## 3. 复用边界（reuse，25 项）

`audit/eote-primitive-plan.json#reuse` 逐项登记模块与读点。要点：常规费用/目标/伤害/修正走 `effects.js` + `ctx.api`；敌人关键词（猎手/冷漠/庞大/反击/警戒/精英）与遭遇结算（涌动/险境/显现/隐藏）复用既有读点；地点连接/印刷值读 `location-connections.js` / `location-facts.js`；战役记录与集合记录读 `campaign.js` / `record-sets.js`；`skill test` 管线复用 `tests.js`（P2 只补 frost 分支的 treatment 修正读点）；既有 7 个打出通道保持不变（新增 `deckTop`/`otherHand` 追加在末尾）。

## 4. P3 / P4 边界（不在本轮实现）

- **P3（关键词与规则书）**：`keyword.mirage`、`keyword.shelter`、`keyword.partner`、`keyword.resolute`、`keyword.expedition`、`keyword.level`、`keyword.key`。P2 已交付其引擎数据/状态读点（地点 Level、shelter、伙伴状态机、数值钥匙、寒霜）；P3 负责关键词解析、时机词与规则书条目。`keyword.expedition` 仍为 P1 目录里的 blocked 项，P3 裁决 trait 还是规则关键词。
- **P4（新增交互与界面）**：`interaction.frostReveal`（连续揭示/自动失败提示/池余量）、`interaction.partnerSetup`（伙伴选派与跨关状态面板）、`interaction.sealPlacement`（封印放置/激活选择与投影）、`interaction.tekeliShuffle`（无查看洗入与隐藏信息）、`interaction.deckTopReveal`（牌库顶私人投影与打出入口）。P4 另需给 `src/integration/mechanic-view.js#view.keys` 补 `kind==='value'` 过滤，避免数值钥匙被当彩色钥匙投影。
- **P5/P7**：调查员特殊规则（攻击后反应、跨关营地、演武入场）、逐卡行为与八章流程在对应阶段验收；本阶段不认证任何卡牌字面行为。

## 5. 注册期校验、失败语义与存档

- 建局/初始化：未知字段、重复 id、未知卡号、非法 level/shelter 值、坏洗牌回调在注册期抛 `TypeError`/`RangeError`；初始化失败零写入。
- 运行时：资源不足/状态非法返回 `false`/`null`，不产生部分扣减或半写状态；需要选择的入口在现有规则事务内执行。
- 存档：`migrateState` 在普通存档、`continuation.base`、并行线三处调用 `validateEoteState`；坏数据拒绝读档。读点永不初始化容器；旧存档字节不变。
- 随机：只走 `randomValue(state)`（会写 `rngState`）或调用方注入的确定性回调/洗牌函数，测试据此可复现。

## 6. 测试与证据

| 证据 | 内容 |
| --- | --- |
| `tests/eote-primitives-frost.test.mjs` | 寒霜池上限/原子支付/违反诚实性、追加揭示、第二枚自动失败、视为 frost、treat 修正覆盖、JSON 往返 |
| `tests/eote-primitives-campaign.test.mjs` | 伙伴四态/持久伤害/检查点抽选、封印生命周期、纪念逝者领取幂等、物资控制/掉落/回收 |
| `tests/eote-primitives-flow.test.mjs` | 八章主线/检查点分支/三次幻景切入/回场分支/`stepReturn` 注册校验/尾声矩阵/版本快照与读档校验 |
| `tests/eote-primitives-geo.test.mjs` | 庇护值读点、营地/揭示继承、设施激活与高塔坍塌、数值钥匙原子花费 |
| `tests/eote-primitives-travel.test.mjs` | Level/攀登/坠落、城市格网公开与私密投影、隐藏洗入与忒咳哩-哩牌库、原网格 API 兼容 |
| `tests/eote-primitives-investigator.test.mjs` | 牌库顶揭示隐私与每轮折扣、轮初距离、演武翻面/选择、支援换面、跨座位授权与非法拒绝、通道顺序不变 |
| `audit/eote-node-acceptance.json` | `node tools/verify-eote.mjs --node`：7 个 eote Node 专项全绿，记录运行前后证据源 SHA-256 |
| `audit/eote-regression.json` | `node tools/verify-eote.mjs --regression`：test:fast 对比 P0 冻结失败清单（无新增）+ replay 13 局 `--compare` 零漂移 |
| `audit/eote-primitive-plan.json` / `audit/eote-primitive-catalog.json` | 60 项目录分相账本与只读目录；`--check` 逐字节复算 |

## 7. 实现口径与裁决记录

1. **数值钥匙落点**：放进既有 `mechanicState.keys`（条目 `kind:'value'`），彩色钥匙读点全部按 kind 过滤，行为零变化；这样不需要给 eote 容器加 keys 槽，也不复制钥匙存储。
2. **营地状态落点**：与庇护值规则绑定，放在 `eote.shelter = { camp?, revealed? }`；跨关营地记录属战役层，不在本原语写。
3. **坠落伤害**：参考实现与卡面没有通用坠落伤害；`fallDamage` 按「每坠落 1 层 1 点」的可复算基线实现并在代码注释标明，内容层可用卡面数值覆盖（P5–P7 接线时复核）。
4. **位移归属**：`ascend/descend/teleportGrid/moveAcrossGrid` 只校验 + 记录瞬时标记 + 返回 transition，不直接搬 `inv.location`，避免绕过权威移动事务（揭示、敌人跟随、事件窗口）。
5. **忒咳哩-哩牌库**：实体复用 `scenarioDecks.tekeli`，元数据放 `eote.tekeli`；`tekeliReturn` 的 deck/anyDeck/discard 去向需要调用方传 `seat`；物理副本共用 code，副本守恒由弱点结算调用方保证。
6. **跨座位代打**：引擎只提供授权、枚举、取牌与元数据；「归牌主控制、双方分摊费用」属于调查员能力接线（P5），本阶段不实现卡面效果。
7. **frost 修正读点**：为支持地点「首个 frost 视为 -3」，`tests.js` 的 frost 分支改为读取 `tokenEffect(...).modifier`（默认 -1），并给 `tokenEffect` 补 frost 默认修正 -1；旧对局无 treatment 时行为逐字节不变（replay 已验证）。
