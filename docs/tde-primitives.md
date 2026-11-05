# 食梦者规则原语

原语通过引擎公共 API 调用，单卡条目只读状态。登记、读点与测试由 `tools/tde-primitive-spec.mjs` 定义，`tools/audit-tde-primitives.mjs` 实跑复核。

## window.afterAlarmRaised

警报提升窗口。通过公共原语实现，旧单卡特例已移出 escape。

接口：`window.afterAlarmRaised`。

证据：`tests/tde-completion-primitives.test.mjs`。

## play.alternateCost

支付前替代费用。通过公共原语实现，旧单卡特例已移出 escape。

接口：`play.alternateCost`。

证据：`tests/tde-completion-primitives.test.mjs`。

## skill.forcedCommit

强制投入与负图标。通过公共原语实现，旧单卡特例已移出 escape。

接口：`skill.forcedCommit`。

证据：`tests/tde-completion-primitives.test.mjs`。

## effect.capabilityRestrictions

持续效果能力限制。通过公共原语实现，旧单卡特例已移出 escape。

接口：`effect.capabilityRestrictions`。

证据：`tests/tde-completion-primitives.test.mjs`。

## campaignPart

双 part 状态与切换。schema 仍为 7：parts 是可选字段，非 TDE 状态字节不变（schema 7→8 推迟到 P5，见路线图 R12 与 P3 报告）。

接口：`createPartsState({ mode, seatParts, activeParts, currentPart }) / setPart(state, part)`。

证据：`tests/tde-campaign-parts.test.mjs`。

## recordInPart

按线隔离的记录读写与勾销。记录是存在性语义（值假 = 未记录），与 campaign-effects 的读法一致；勾销 = 删除键并返回旧值。

接口：`partRecord(campaign, part, key) / recordInPart(campaign, part, key, value) / crossOutInPart(campaign, part, key)`。

证据：`tests/tde-campaign-parts.test.mjs`。

## seatPartMap

房间座位↔线内连续座位映射。映射由 seatParts 确定性派生，不持久化第二份真相；越界线内座位返回 null，不做静默截断。

接口：`seatPartMap(seatParts) / laneSeatOf(seatParts, roomSeat) / roomSeatOf(seatParts, lane, laneSeat)`。

证据：`tests/tde-campaign-parts.test.mjs`。

## chaosBag.multiPart

两袋混乱袋。活动线读 campaign.chaosBag 并与 state.chaosBag 同步；非活动线落 parts 快照；逐章符号表属 P8。

接口：`partChaosBag(state, part) / mutateBothBags(state, mutate)`。

证据：`tests/tde-campaign-parts.test.mjs`。

## inPart

数据作用域绑定（不换运行时）。只绑定 records/chaosBag 等逐线数据，不换 currentPart、不换 state.investigators（运行时重建属 P5 lane adapter）。

接口：`inPart(state, part, fn)`。

证据：`tests/tde-campaign-parts.test.mjs`。

## partFlowCondition

Flow 的 part 条件。未知条件键返回 false，由 P5 的 flow 加载期校验拒绝；本批不接 campaign-flow（P5 接线）。

接口：`partFlowCondition(campaign, condition)`。

证据：`tests/tde-campaign-parts.test.mjs`。

## counter.investigator

按调查员的计数器。警报等级 0–5+（按调查员、非全桌）与赏金共用；只读函数不建字段。

接口：`counterOf / addCounter / setCounter / setCounterMax / highestCounter / counterAtLeast / counterSummary`。

证据：`tests/tde-primitives-counters.test.mjs`。

## enemy.swarmingValue

Swarming X 求值。四种 X 口径（固定 / [per_investigator] / 警报等级 / 剧本参考卡伤害数）；未知 X 拒绝静默按 0。

接口：`swarmingSpec(text) / swarmingCount(spec, { numInvestigators, x }) / swarmingCountForText(state, text, options)`。

证据：`tests/tde-primitives-swarming.test.mjs`。

## swarm.placeCards

蜂拥卡放置与击败判定。蜂拥卡是独立实体（hostId 反查）；抽不够抛错；溢出伤害逐张扣蜂拥卡。真实实体生成与攻击接线属 P8。

接口：`placeSwarmCards / swarmCardsOf / removeSwarmCard / clearSwarmCards / swarmCanBeDefeated / swarmHostOf`。

证据：`tests/tde-primitives-swarm.test.mjs`。

## location.veiled

掩藏地点。官方 rules.veiled：已揭示面入场、无线索时 [fast] 翻面、翻过一次不能再翻；「翻面出 b 面故事卡」与「B3 洗回牌堆」是两件事（P4 更正 P3 的「翻面前不可调查」口径）。

接口：`isVeiledLocation / veiledFlipBlockedReason / canFlipVeiledLocation / flipVeiledLocation / shuffleVeiledIntoDeck / normalizeVeiledScenario`。

证据：`tests/tde-primitives-veiled.test.mjs`。

## tokenBag

蛛群滋生袋。独立 token 袋（与混乱袋语义不同）；infestation test 与护工替换属 P8 章节脚本。

接口：`createTokenBag / revealTokenFromBag / addTokenToBag / returnTokenToBag / tokenBagInfo / markInfested / infestedCount`。

证据：`tests/tde-primitives-token-bag.test.mjs`。

## location.verticalChain

纵向地点链。用 verticalIndex + 既有 connections 表达上下层，不新建循环专属布局；布局渲染属 P5。

接口：`linkVerticalChain / orderVerticalChain / chainNeighbors / moveAlongChain / normalizeVerticalChain`。

证据：`tests/tde-primitives-vertical-chain.test.mjs`。

## location.placeBondedLocation

地点型 Bonded（梦境之门）。只负责成对放置/链接/成对移除；地点定义与实体构造由内容层注入（spawnLocation）。

接口：`bondedCodesOf / placeBondedLocation / bondedPartnerOf / removeBondedLocation / normalizeBondedLocations`。

证据：`tests/tde-primitives-bonded-location.test.mjs`。

## campaign.epilogueMatrix

双线结局矩阵。4×4=16 段；完整性校验（缺格/多格点名）与查表分开；正文接线属 P8-T。

接口：`normalizeEpilogueMatrix / epilogueFor / flattenEpilogueMatrix / locateEpilogue`。

证据：`tests/tde-primitives-epilogue-matrix.test.mjs`。

## deck.myriadLimit

多重构筑限制。按标题共享 3 张额度（跨卡号同名的 Myriad）；只拦 Myriad，普通同名上限属别的校验。

接口：`isMyriad / validateMyriadLimit / addCardRespectingMyriad / myriadUsage`。

证据：`tests/tde-primitives-myriad.test.mjs`。

## location.doom

地点上的毁灭。地点上的毁灭是毁灭（计入议程阈值、被 B4 骷髅读取），06 段没有「毁灭地点」规则（P4 更正 P3 的阈值/移除口径）。

接口：`locationDoomOf / addLocationDoom / removeLocationDoom / totalLocationDoom / highestLocationDoom / normalizeLocationDoom`。

证据：`tests/tde-primitives-location-doom.test.mjs`。

## scenario.markerCount

剧本参考卡计数。通用命名计数（默认 reference），A2 神迹与 B3 的参考卡 X 共用；只读不建字段。

接口：`markerCountOf / addMarker / setMarkerCount / referenceMarkerCount / resetMarkerCount / markerSummary`。

证据：`tests/tde-primitives-marker-count.test.mjs`。

## assetDefeat

支援被击败的唯一判定点与 assetDefeated 窗口。applyHarm 与「移动伤害」共用同一判定；窗口上下文带 damage/horror，`shuffledIntoDeck` 是「改为洗回牌库」的通用出口（托米·马尔登）。

接口：`isAssetDefeated / assetHarmCapacity / checkAssetDefeated（窗口 assetDefeated）`。

证据：`tests/tde-investigators.test.mjs`。

## harm.moveBetween

伤害/恐惧在调查员与支援之间移动。「移动」不是承受/治疗：不触发受到伤害窗口、不走 soaking；受目标容量限制，支援到上限后由 assetDefeat 判定。

接口：`harmOf / harmRoom / moveHarm（ctx.api.moveHarm / harmRoomOf）`。

证据：`tests/tde-investigators.test.mjs`。

## counter.card

卡牌实例上的具名计数器（赏金）。状态形状 `card.markers[counterId]`；未知 id 在注册期报错。敌人身上的赏金上限 = 敌人生命值，由调用方传入。

接口：`cardCounterOf / addCardCounter / setCardCounter / moveCardCounters / totalCardCounters`。

证据：`tests/tde-investigators.test.mjs`。

## investigator.restrictedAction

受限额外行动（法术 / 赏金）。第四循环的法术专用行动改成同一本账（`spellOnlyActions` 字段与函数名保留）；额度是「最后 N 个行动」，普通行动不能花。

接口：`grantRestrictedAction / actionsAvailable / consumeAction / clearRestrictedAction / restrictedActionRule`。

证据：`tests/tde-investigators.test.mjs`。

## search.modify

查找牌库前的能力窗口。曼蒂·汤普森「额外查找 3 张或多结算 1 个目标」；顺带修掉 lookZoneAdapter 只看 3 张的写死上限。

接口：`窗口 searchWouldResolve（context.extraCards / context.extraTargets）`。

证据：`tests/tde-investigators.test.mjs`。

## search.cardInPile

被查找到的牌自身的规则。神秘证据（揭示抽走 + 发现线索）与惊人的发现（弃掉 + 取消查找 + 抽遭遇卡）。

接口：`条目标 `searchedCardRule`（读点 deck-ops.js 的 searchedCardsWindow）`。

证据：`tests/tde-investigators.test.mjs`。

## upkeep.replaceDraw

补给阶段抽牌整段替换。派翠丝·海瑟薇「弃掉手牌中全部非弱点卡牌，抽到 5 张」；未声明该键的调查员行为不变。

接口：`investigatorRule(code).upkeepDraw`。

证据：`tests/tde-investigators.test.mjs`。

## investigator.cardRules

调查员卡面的常驻规则键。三个读点都已在既有引擎里；本批只补 handSizeModifier 与 shuffleDiscardAfterTest 两个声明键。

接口：`investigator.handSizeModifier / investigator.startsWith / elderSign.shuffleDiscardAfterTest`。

证据：`tests/tde-investigators.test.mjs`。

## play.fromHandFree

从手牌免费打出另一张同名卡。托尼的 .38「打出后免费从手牌打出另一张同名枪」；与正常支付/入场共用 doPlay。

接口：`ctx.api.playCardFromHandFree(seat, code, { discount })`。

证据：`tests/tde-investigators.test.mjs`。

## play.asIfAtLocation

事件如同位于连接地点打出。卢克·罗宾逊每回合 1 张事件。

接口：`beginAsIf / endAsIf`。收尾玩家窗口里的快速事件同样按该地点结算：选项 id 用
`fast-card:<卡号>:asif:<地点 id>` 与普通打出区分（`src/engine/encounter.js#playerWindow`）；
同名的普通/如同位于变体不得共用一个 id，否则 `requestChoice` 会抛「选择选项 id 重复」软锁。

证据：`tests/tde-investigators.test.mjs`。

## location.bondedDreamGate

梦境之门的放置、翻面与连接。06013 放置 a 面，06014 翻成或放置 b 面。除卢克外不能进入。

接口：`placeDreamGate / flipOrPlaceDreamGate / setDreamGatesAside`。

证据：`tests/tde-investigators.test.mjs`。

## enemy.hiddenInHand

手牌中的隐私敌人。06017。成功弃掉，失败则生成并交战。

接口：`fightHidden / evadeHidden / hiddenEnemiesAttackFromHand`。

证据：`tests/tde-investigators.test.mjs`。

## completion

补全支付前替代费用、强制投入、能力限制和警报提升窗口；实体蜂拥、个人绑定池、起始梦境和全局敌人走相同的规则管线。完整回归见 `tests/tde-completion-primitives.test.mjs` 与 `tests/tde-completion.test.mjs`。
