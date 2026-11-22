# 食梦者（The Dream-Eaters）原语账本

> 本文件由批次 4 Lead 依据 `artifacts/migration/tde/primitive-plan.json` 重新生成：
> 该文档在部分检出中缺失，但 TDE 原语计划/审计以它为文档证据。请随 TDE 原语变更同步维护。

## 原语清单

### completion

- `window.afterAlarmRaised` — 警报提升窗口（engine；状态：pending）
- `play.alternateCost` — 支付前替代费用（engine；状态：pending）
- `skill.forcedCommit` — 强制投入与负图标（engine；状态：pending）
- `effect.capabilityRestrictions` — 持续效果能力限制（engine；状态：pending）

### p31-双-part-状态与切换

- `createPartsState({ mode, seatParts, activeParts, currentPart }) / setPart(state, part)` — 双 part 状态与切换（campaign；状态：pending）

### p310-掩藏地点

- `isVeiledLocation / veiledFlipBlockedReason / canFlipVeiledLocation / flipVeiledLocation / shuffleVeiledIntoDeck / normalizeVeiledScenario` — 掩藏地点（engine；状态：pending）

### p311-蛛群滋生袋

- `createTokenBag / revealTokenFromBag / addTokenToBag / returnTokenToBag / tokenBagInfo / markInfested / infestedCount` — 蛛群滋生袋（engine；状态：pending）

### p312-纵向地点链

- `linkVerticalChain / orderVerticalChain / chainNeighbors / moveAlongChain / normalizeVerticalChain` — 纵向地点链（engine；状态：pending）

### p313-地点型-bonded梦境之门

- `bondedCodesOf / placeBondedLocation / bondedPartnerOf / removeBondedLocation / normalizeBondedLocations` — 地点型 Bonded（梦境之门）（engine；状态：pending）

### p314-双线结局矩阵

- `normalizeEpilogueMatrix / epilogueFor / flattenEpilogueMatrix / locateEpilogue` — 双线结局矩阵（campaign；状态：pending）

### p315-多重构筑限制

- `isMyriad / validateMyriadLimit / addCardRespectingMyriad / myriadUsage` — 多重构筑限制（engine；状态：pending）

### p316-地点上的毁灭

- `locationDoomOf / addLocationDoom / removeLocationDoom / totalLocationDoom / highestLocationDoom / normalizeLocationDoom` — 地点上的毁灭（engine；状态：pending）

### p317-剧本参考卡计数

- `markerCountOf / addMarker / setMarkerCount / referenceMarkerCount / resetMarkerCount / markerSummary` — 剧本参考卡计数（engine；状态：pending）

### p32-按线隔离的记录读写与勾销

- `partRecord(campaign, part, key) / recordInPart(campaign, part, key, value) / crossOutInPart(campaign, part, key)` — 按线隔离的记录读写与勾销（campaign；状态：pending）

### p33-房间座位线内连续座位映射

- `seatPartMap(seatParts) / laneSeatOf(seatParts, roomSeat) / roomSeatOf(seatParts, lane, laneSeat)` — 房间座位↔线内连续座位映射（campaign；状态：pending）

### p34-两袋混乱袋

- `partChaosBag(state, part) / mutateBothBags(state, mutate)` — 两袋混乱袋（campaign；状态：pending）

### p35-数据作用域绑定

- `inPart(state, part, fn)` — 数据作用域绑定（不换运行时）（campaign；状态：pending）

### p36-flow-的-part-条件

- `partFlowCondition(campaign, condition)` — Flow 的 part 条件（campaign；状态：pending）

### p37-按调查员的计数器

- `counterOf / addCounter / setCounter / setCounterMax / highestCounter / counterAtLeast / counterSummary` — 按调查员的计数器（engine；状态：pending）

### p38-swarming-x-求值

- `swarmingSpec(text) / swarmingCount(spec, { numInvestigators, x }) / swarmingCountForText(state, text, options)` — Swarming X 求值（engine；状态：pending）

### p39-蜂拥卡放置与击败判定

- `placeSwarmCards / swarmCardsOf / removeSwarmCard / clearSwarmCards / swarmCanBeDefeated / swarmHostOf` — 蜂拥卡放置与击败判定（engine；状态：pending）

### p61-支援被击败的唯一判定点

- `isAssetDefeated / assetHarmCapacity / checkAssetDefeated（窗口 assetDefeated）` — 支援被击败的唯一判定点与 assetDefeated 窗口（engine；状态：pending）

### p610-如同位于连接地点

- `beginAsIf / endAsIf` — 事件如同位于连接地点打出（engine；状态：pending）

### p611-梦境之门

- `placeDreamGate / flipOrPlaceDreamGate / setDreamGatesAside` — 梦境之门的放置、翻面与连接（engine；状态：pending）

### p612-手牌中的隐私敌人

- `fightHidden / evadeHidden / hiddenEnemiesAttackFromHand` — 手牌中的隐私敌人（engine；状态：pending）

### p62-伤害恐惧移动

- `harmOf / harmRoom / moveHarm（ctx.api.moveHarm / harmRoomOf）` — 伤害/恐惧在调查员与支援之间移动（engine；状态：pending）

### p63-卡牌具名计数器

- `cardCounterOf / addCardCounter / setCardCounter / moveCardCounters / totalCardCounters` — 卡牌实例上的具名计数器（赏金）（engine；状态：pending）

### p64-受限额外行动

- `grantRestrictedAction / actionsAvailable / consumeAction / clearRestrictedAction / restrictedActionRule` — 受限额外行动（法术 / 赏金）（engine；状态：pending）

### p65-查找牌库窗口

- `窗口 searchWouldResolve（context.extraCards / context.extraTargets）` — 查找牌库前的能力窗口（engine；状态：pending）

### p66-被查找到的牌

- `条目标 `searchedCardRule`（读点 deck-ops.js 的 searchedCardsWindow）` — 被查找到的牌自身的规则（engine；状态：pending）

### p67-补给阶段抽牌替换

- `investigatorRule(code).upkeepDraw` — 补给阶段抽牌整段替换（engine；状态：pending）

### p68-调查员卡面常驻规则

- `investigator.handSizeModifier / investigator.startsWith / elderSign.shuffleDiscardAfterTest` — 调查员卡面的常驻规则键（engine；状态：pending）

### p69-从手牌免费打出

- `ctx.api.playCardFromHandFree(seat, code, { discount })` — 从手牌免费打出另一张同名卡（engine；状态：pending）

## 验收口径

- 每项原语由 `artifacts/migration/tde/primitive-plan.json` 的 checks/tests 复算；
- 读点、文件、测试、docs 均存在时状态为 done；引擎边界（src/engine/**）不得出现 TDE 卡号/战役名。
