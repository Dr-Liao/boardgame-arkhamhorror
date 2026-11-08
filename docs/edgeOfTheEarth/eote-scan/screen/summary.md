# EOTE 机械筛查汇总（Lead 生成）

> 以下全部是**候选线索**，最终结论必须由审计员人工复核并给 `file:line` 证据。

```json
{
 "generatedAt": "2026-11-08T11:04:19.885Z",
 "scope": {
  "cards": 403,
  "investigators": 22,
  "player": 115,
  "campaign": 266
 },
 "integrity": {
  "total": 403,
  "withEntry": 401,
  "withoutEntry": [
   "08596",
   "08621"
  ],
  "issueCards": 151,
  "markerCards": 37,
  "byKind": {
   "no-implemented-flag": 144,
   "entry-no-code": 32,
   "empty-behavior": 7
  }
 },
 "keywordCoverage": {
  "flaggedCards": 61,
  "byFeature": {
   "取消": 2,
   "快速": 19,
   "伤害": 5,
   "恐惧": 6,
   "强制": 1,
   "资源": 3,
   "检定": 33,
   "弃牌": 4,
   "搜索": 7,
   "充能/弹药/次数": 1,
   "反应": 5,
   "投入": 2,
   "攻击行动": 2,
   "消耗": 1,
   "治疗": 2
  }
 },
 "flagsReadpoints": {
  "declared": 747,
  "unread": 207,
  "unreadUniqueKeys": [
   "actRule.studyHistory",
   "actRule.discernShoggoths",
   "actRule.hiddenPower",
   "actRule.returnTekeliWeaknesses",
   "actRule.forcedOnEnemyEnter",
   "actRule.removeElderThingTokens",
   "actRule.defeatElderThingsAtLocation",
   "locationRule.blocksClueDiscovery",
   "flags.doubleKeyTokenModifier",
   "flags.frostForcedDamage",
   "flags.frostForcedHorror",
   "enemyRule.blocksKeysWhileReady",
   "enemyRule.onDefeatDoom",
   "enemyRule.anyEmpty",
   "enemyRule.takesKeyOnEngage",
   "enemyRule.readiesOnKeyControlled",
   "enemyRule.placesKeyOnLeave",
   "flags.frostWeakness",
   "flags.healAsOneDamageApproximation",
   "flags.agendaVersion",
   "agendaRule.freeMoveToPrisonOfMemories",
   "flags.failBy1Take1HorrorForPlus1",
   "flags.harderShroudOrExtraAction",
   "flags.millDeckForTekeliliWeaknesses",
   "flags.shroudPlus1AndCannotLeave",
   "flags.take1HorrorThenExtraClueOnSuccess",
   "flags.shuffleTekeliliIntoDeck",
   "flags.doubleEffectThenDiscoverClue",
   "flags.take1DamageThenExtraClueOnSuccess",
   "flags.shuffleTekeliliOrExtraAction",
   "flags.shuffleIntoDeckInsteadOfBottom",
   "flags.heal1Horror",
   "flags.damageTo6RemainingHealth",
   "flags.horrorOrRemoveSecret",
   "flags.surgeOncePerPhase",
   "flags.nonEliteAttackPlus2NoRetaliate",
   "enemyRule.flipOnDefeat",
   "flags.attachLocationClues",
   "flags.discardWhenLocationFlipped",
   "treacheryRule.attachToNearestUnflippedLocation",
   "flags.partnerRules",
   "flags.heal2HorrorAfterFreeSpend",
   "flags.afterTekeliliResolvedDraw3DiscardWeaknesses",
   "flags.evadeBase6ThenMayMove",
   "flags.heal2DamageAfterFreeSpend",
   "flags.cancelFrostThenRevealOrSpendSupply",
   "flags.fightBase6NonEliteCannotAttackThisRound",
   "flags.investigateBase6LookTopCard",
   "flags.blankNonWeaknessTreacheryText",
   "flags.gain1ResourceMoveUpTo3",
   "flags.seepingNightmareAdvance",
   "agendaRule.forcedAdvanceHold",
   "agendaRule.removeDoomOnHold",
   "agendaRule.spawnFromBeneath",
   "flags.deeperIce",
   "flags.beneathHolder",
   "enemyRule.hunterWhenNoBeneath",
   "enemyRule.removeBeneathOnDefeat",
   "flags.surgeIfNoSeepingNightmare",
   "treacheryRule.spawnBeneathOrHunterAttack",
   "flags.sealRecover",
   "flags.spawnFarthestOuterRing",
   "flags.enemyPhaseEndReadyIfActivatedSeal",
   "flags.nearestSealHolder",
   "flags.finalMirageDoomReplacement",
   "agendaRule.namelessInPlay",
   "actRule.pylonAttackable",
   "actRule.clueReactionDamage",
   "flags.pylonKind",
   "locationRule.enterCostCluePerInvestigator",
   "flags.cannotTakeDamage",
   "flags.exhaustNearestOnSuccess",
   "flags.spawnNearestStandingPylon",
   "flags.protectsReadyPylon",
   "flags.moveTowardPylonAtEnemyPhaseEnd",
   "flags.finalMirage",
   "flags.resolutionByRecords",
   "actRule.namelessGainsHunter",
   "actRule.finalMirageOutcome",
   "flags.objectiveRun",
   "locationRule.objectiveRun",
   "enemyRule.moveDownToBelow",
   "enemyRule.blocksAscendWhileEngaged",
   "flags.replacesTekeliShuffleAtLocation",
   "flags.heal2Horror",
   "flags.draw2AfterTekeliliResolved",
   "flags.evadeBase5ThenMayMove",
   "flags.heal2Damage",
   "flags.cancelFrostRevealNewToken",
   "flags.fightBase5NonEliteCannotAttackThisRound",
   "flags.investigateBase5LookTopCard",
   "flags.moveEntryTest",
   "flags.shelterToken",
   "flags.tekeliliOnFail",
   "flags.campCandidate",
   "flags.shroudWhenAttached",
   "locationRule.shroudWhenAttached",
   "flags.entryGroupCluesPerInvestigator",
   "flags.firstFrostModifier",
   "flags.surgeOnAttachedTreachery",
   "flags.moveSurchargeFromTreacheryLocation",
   "flags.attachToPossessedEnemy",
   "flags.difficultyBonus",
   "flags.memorial",
   "flags.eventCard",
   "flags.draw3AnyFreeWindow",
   "flags.footwear",
   "flags.gain3ResourcesDraw1RemoveFromGame",
   "flags.attachToPartnerAsset",
   "flags.turnEndDirectHorror",
   "flags.tekeliliDoubleResolution",
   "flags.drawTekeliliAndResolveThenShuffle",
   "flags.moveSurchargeAtEnemyLocation",
   "flags.clueDiscoveryDiscardNonWeakness",
   "flags.returnToTekeliliDeckBottom",
   "flags.sealAwareToken",
   "flags.towerAwareToken",
   "flags.claimedSealsKeptOnResign",
   "flags.roomSeal"
  ]
 },
 "duplication": {
  "textDuplicateGroups": 9,
  "clonePairs": 48,
  "reprintRecords": 3,
  "crossCycleSameText": 4
 },
 "tests": {
  "strong": 139,
  "file-only": 152,
  "none": 112
 },
 "perceivability": {
  "flaggedCards": 29
 },
 "scenarios": {
  "chapters": 8,
  "chapterIssues": 0,
  "flowIssues": 0,
  "flowFiles": 11
 },
 "knownDeviations": {
  "simplified": 26,
  "deferred": 28,
  "primitiveRequests": 25,
  "entryMarkers": 51
 },
 "primitiveCompliance": {
  "directWrites": 0,
  "engineLiterals": 100,
  "escapeCards": 182,
  "forbiddenImports": 0
 }
}
```

## 逐类线索
- 条目完整性：151 卡有结构问题；37 卡头注释含 TODO/近似/简化 等标记（screen/integrity.json）
- 打印模板→实现特征：61 卡候选（screen/keyword-coverage.json）
- 声明未接线：207 条声明 key 在引擎/内容中找不到读点（screen/flags-readpoints.json）
- 复用/重复：同文组 9、源码近似对 48、重印记录 3、跨循环同文 4（screen/duplication.json）
- 测试覆盖：{"strong":139,"file-only":152,"none":112}；可疑标题 156（screen/tests-coverage.json）
- 可感知性静态线索：29 卡（screen/perceivability.json）
- 章节完整性：{"chapters":8,"chapterIssues":0,"flowIssues":0,"flowFiles":11}（screen/scenario-integrity.json）
- 已知偏差：simplified=26 / deferred=28 / primitiveRequests=25（screen/known-deviations.json）
- 原语合规：直写=0 / 引擎卡号字面量=100 / 逃逸=182（screen/primitive-compliance.json）