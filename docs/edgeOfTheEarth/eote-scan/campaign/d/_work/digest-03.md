# D 分片审阅摘要 3（08672–08683）

====================================================================================================
CODE 08672 | 08672 无名存在 / That Which Has No Name
- partition: eoteCampaign | type: agenda | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08672
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08672.js
--- EN TEXT ---
Forced - When 1 or more doom would be put into play, if there are any copies of The Nameless Madness still set aside: Instead, spawn 1 set-aside copy of The Nameless Madness at the location nearest to an investigator without a copy of that enemy that is connected to a location with a copy of that enemy.
Objective - At the end of the round, if all 15 copies of The Nameless Madness are in play and not every Mist-Pylon is collapsed, advance this agenda.

--- BACK EN ---
For each Mist-Pylon that is collapsed, set 3 copies of The Nameless Madness aside.
Each investigator loses all of their clues.
Remove each location except The Gate of Y'quaa from the game. Investigators and copies of The Nameless Madness are not defeated by this effect. All other cards at these locations are discarded.
Put the 4 set-aside Titanic Ramp locations into play in a straight line to the right of The Gate of Y'quaa. Put the set-aside Hidden Tunnel location into play to the right of the rightmost Titanic Ramp. Place each investigator and each remaining copy of The Nameless Madness in play at the leftmost Titanic Ramp.
Remove the act deck from the game and advance to the set-aside The Final Mirage. It is both the current act and the current agenda.

--- NUMS ---
{  "stage": 5,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.finalMirageDoomReplacement  <<UNREAD kind=undefined
  agendaRule.backEffect  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  agendaRule.objective  read@src/ai/agent-plans.js,src/engine/ability.js,src/engine/act-agenda.js
  agendaRule.forced  read@src/cards/card-effects.js,src/engine/ability-exec.js,src/engine/ability-rules.js
  agendaRule.rampSequence  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  agendaRule.namelessInPlay  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08672 无名者（That Which Has No Name）· 议程 5
// 强制 - 当 1+ 毁灭将被放置时，如果还有放一边的「无名的疯狂」：改为在「离调查员最近、且与已有
// 该敌人所在连接的地点」生成 1 份。目标 - 回合结束时，如果 15 份都在场且并非所有迷雾高塔坍塌，推进。
// 背面：清场 + 铺泰坦坡道 + 隐藏隧道（rampSequence，由 behavior 统一实现）。
export default {
  code: '08672',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    backEffect: 'rampSequence',
    objective: { type: 'namelessInPlay' },
    forced: {
      doomWouldBePlaced(state, agenda, api) {
        api.info?.('👁️ 无名者：毁灭将被替换为生成 1 份无名的疯狂（P8 毁灭替换批次近似）。')
      },
    },
  },
  flags: { finalMirageDoomReplacement: true },
}
====================================================================================================
CODE 08673 | 08673 摧毁高塔 / Collapse the Pylons
- partition: eoteCampaign | type: act | status(账本): simplified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08673
- 账本 reason: pending-primitive: p7-08673（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08673.js
--- EN TEXT ---
Each revealed Mist-Pylon can be attacked as if it were an enemy. Its fight value is equal to its shroud value and its health is equal to its clue value. While it has no health remaining, it is collapsed (it remains in play).
[reaction] When you discover 1 or more clues at a Mist-Pylon, spend those clues: Deal that much damage to that Mist-Pylon.
Objective - At the end of the round, if each Mist-Pylon is collapsed, advance this act.

--- BACK EN ---
Set all but 3 copies of The Nameless Madness aside.
Each investigator loses all of their clues.
Remove each location except The Gate of Y'quaa from the game. Investigators and copies of The Nameless Madness are not defeated by this effect. All other cards at those locations are discarded.
Put the 4 set-aside Titanic Ramp locations into play in a straight line to the right of The Gate of Y'quaa. Put the set-aside Hidden Tunnel location into play to the right of the rightmost Titanic Ramp. Place each investigator and each remaining copy of The Nameless Madness in play at the leftmost Titanic Ramp.
Remove the agenda deck from the game and advance to the set-aside The Final Mirage. It is both the current act and the current agenda.

--- NUMS ---
{  "stage": 3,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  actRule.objective  read@src/ai/agent-plans.js,src/engine/ability.js,src/engine/act-agenda.js
  actRule.backEffect  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  actRule.pylonAttackable  <<UNREAD kind=undefined
  actRule.clueReactionDamage  <<UNREAD kind=undefined
  actRule.collapsePylons  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  actRule.rampSequence  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
SIMPLIFIED: pending-primitive: p7-08673（近似已披露，不阻塞 gate） [p7-08673]
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08673 坍塌高塔（Collapse the Pylons）· 幕 3
// 卡面：每座已揭示的迷雾高塔可被当作敌人攻击（fight=帷幕、health=线索值）；生命为 0 即坍塌。
// [reaction] 在迷雾高塔发现 1+ 线索时，花费那些线索：对高塔造成等量伤害。
// 目标 - 回合结束时，如果每座迷雾高塔都已坍塌，推进。背面：rampSequence。
export default {
  code: '08673',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'collapsePylons' },
    backEffect: 'rampSequence',
    pylonAttackable: true,
    clueReactionDamage: true,
  },
}
====================================================================================================
CODE 08674 | 08674 迷雾高塔 / Mist-Pylon
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08674
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08674.js
--- EN TEXT ---
[fast] If you control the [seal_a] seal, and it is activated: You unleash the seal's power. Place the [seal_a] seal on this Mist-Pylon. For the remainder of the game, each time you deal damage to a Mist-Pylon, deal 1 additional damage.

--- BACK EN ---
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.

--- NUMS ---
{  "clues": 4,  "shroud": 1,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.pylonKind  <<UNREAD kind=undefined
  flags.mistPylon  read@src/engine/eote-facilities.js
  locationRule.enterCostCluePerInvestigator  <<UNREAD kind=undefined
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08674 迷雾高塔（Mist-Pylon）· 深潜组地点
// 卡面（背面）：进入迷雾高塔的额外费用：此地点的调查员团队花费 1×人数线索。
// [fast] 如果控制激活的 seal_a：把 seal_a 放到此高塔；此后你对迷雾高塔的伤害 +1。
// 读点：locationRule.fastActions → behavior.performAction 的 heartOfMadnessUnleash 分支；
// 高塔寿命/坍塌走 P2-D eote-facilities。
export default {
  code: '08674',
  scope: 'location',
  implemented: true,
  locationRule: {
    enterCostCluePerInvestigator: 1,
    fastActions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessUnleash:A', actions: 0,
        label: '🔓 迷雾高塔：释放封印 A 的力量（fast）' })
    },
  },
  flags: { pylonKind: 'A', mistPylon: true },
}
====================================================================================================
CODE 08675 | 08675 迷雾高塔 / Mist-Pylon
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08675
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08675.js
--- EN TEXT ---
[fast] If you control the [seal_b] seal, and it is activated: You unleash the seal's power. Place the [seal_b] seal on this Mist-Pylon. For the remainder of the game, reduce the shroud value of each Mist-Pylon by 2.

--- BACK EN ---
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.

--- NUMS ---
{  "clues": 1,  "shroud": 5,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.pylonKind  <<UNREAD kind=undefined
  flags.mistPylon  read@src/engine/eote-facilities.js
  locationRule.enterCostCluePerInvestigator  <<UNREAD kind=undefined
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08675 迷雾高塔（Mist-Pylon）· 深潜组地点
// 卡面（背面）：进入迷雾高塔的额外费用：此地点的调查员团队花费 1×人数线索。
// [fast] 如果控制激活的 seal_b：把 seal_b 放到此高塔；此后每座迷雾高塔的帷幕 -2。
// 读点：locationRule.fastActions → behavior.performAction 的 heartOfMadnessUnleash 分支；
// 高塔寿命/坍塌走 P2-D eote-facilities。
export default {
  code: '08675',
  scope: 'location',
  implemented: true,
  locationRule: {
    enterCostCluePerInvestigator: 1,
    fastActions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessUnleash:B', actions: 0,
        label: '🔓 迷雾高塔：释放封印 B 的力量（fast）' })
    },
  },
  flags: { pylonKind: 'B', mistPylon: true },
}
====================================================================================================
CODE 08676 | 08676 迷雾高塔 / Mist-Pylon
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08676
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08676.js
--- EN TEXT ---
[fast] If you control the [seal_c] seal, and it is activated: You unleash the seal's power. Place the [seal_c] seal on this Mist-Pylon. For the remainder of the game, each investigator gets +1 to each of their skills while they are at a Mist-Pylon.

--- BACK EN ---
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.

--- NUMS ---
{  "clues": 2,  "shroud": 4,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.pylonKind  <<UNREAD kind=undefined
  flags.mistPylon  read@src/engine/eote-facilities.js
  locationRule.enterCostCluePerInvestigator  <<UNREAD kind=undefined
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08676 迷雾高塔（Mist-Pylon）· 深潜组地点
// 卡面（背面）：进入迷雾高塔的额外费用：此地点的调查员团队花费 1×人数线索。
// [fast] 如果控制激活的 seal_c：把 seal_c 放到此高塔；此后调查员在迷雾高塔时所有技能 +1。
// 读点：locationRule.fastActions → behavior.performAction 的 heartOfMadnessUnleash 分支；
// 高塔寿命/坍塌走 P2-D eote-facilities。
export default {
  code: '08676',
  scope: 'location',
  implemented: true,
  locationRule: {
    enterCostCluePerInvestigator: 1,
    fastActions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessUnleash:C', actions: 0,
        label: '🔓 迷雾高塔：释放封印 C 的力量（fast）' })
    },
  },
  flags: { pylonKind: 'C', mistPylon: true },
}
====================================================================================================
CODE 08677 | 08677 迷雾高塔 / Mist-Pylon
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08677
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08677.js
--- EN TEXT ---
[fast] If you control the [seal_d] seal, and it is activated: You unleash the seal's power. Place the [seal_d] seal on this Mist-Pylon. For the remainder of the game, whenever an investigator at a Mist-Pylon would be dealt 1 or more damage and/or horror, cancel 1 of that damage or horror.

--- BACK EN ---
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.

--- NUMS ---
{  "clues": 2,  "shroud": 3,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.pylonKind  <<UNREAD kind=undefined
  flags.mistPylon  read@src/engine/eote-facilities.js
  locationRule.enterCostCluePerInvestigator  <<UNREAD kind=undefined
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08677 迷雾高塔（Mist-Pylon）· 深潜组地点
// 卡面（背面）：进入迷雾高塔的额外费用：此地点的调查员团队花费 1×人数线索。
// [fast] 如果控制激活的 seal_d：把 seal_d 放到此高塔；此后迷雾高塔上的调查员每次受到伤害/恐惧时取消 1 点。
// 读点：locationRule.fastActions → behavior.performAction 的 heartOfMadnessUnleash 分支；
// 高塔寿命/坍塌走 P2-D eote-facilities。
export default {
  code: '08677',
  scope: 'location',
  implemented: true,
  locationRule: {
    enterCostCluePerInvestigator: 1,
    fastActions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessUnleash:D', actions: 0,
        label: '🔓 迷雾高塔：释放封印 D 的力量（fast）' })
    },
  },
  flags: { pylonKind: 'D', mistPylon: true },
}
====================================================================================================
CODE 08678 | 08678 迷雾高塔 / Mist-Pylon
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08678
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08678.js
--- EN TEXT ---
[fast] If you control the [seal_e] seal, and it is activated: You unleash the seal's power. Place the [seal_e] seal on this Mist-Pylon. For the remainder of the game, each enemy gets -2 fight and -2 evade while it is at a Mist-Pylon.

--- BACK EN ---
As an additional cost for you to enter Mist-Pylon, investigators at your location must spend 1 [per_investigator] clues, as a group.

--- NUMS ---
{  "clues": 3,  "shroud": 2,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.pylonKind  <<UNREAD kind=undefined
  flags.mistPylon  read@src/engine/eote-facilities.js
  locationRule.enterCostCluePerInvestigator  <<UNREAD kind=undefined
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08678 迷雾高塔（Mist-Pylon）· 深潜组地点
// 卡面（背面）：进入迷雾高塔的额外费用：此地点的调查员团队花费 1×人数线索。
// [fast] 如果控制激活的 seal_e：把 seal_e 放到此高塔；此后迷雾高塔上的每名敌人 fight/evade -2。
// 读点：locationRule.fastActions → behavior.performAction 的 heartOfMadnessUnleash 分支；
// 高塔寿命/坍塌走 P2-D eote-facilities。
export default {
  code: '08678',
  scope: 'location',
  implemented: true,
  locationRule: {
    enterCostCluePerInvestigator: 1,
    fastActions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessUnleash:E', actions: 0,
        label: '🔓 迷雾高塔：释放封印 E 的力量（fast）' })
    },
  },
  flags: { pylonKind: 'E', mistPylon: true },
}
====================================================================================================
CODE 08679 | 08679 无名疯狂 / The Nameless Madness
- partition: eoteCampaign | type: enemy | status(账本): simplified
- pack: eoec | klass: mythos | traits: Ancient One,Eidolon,Elite | xp: null | quantity: 15
- 账本 reason: pending-primitive: p7-08679（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08679.js
--- EN TEXT ---
Alert. Massive. Retaliate.
The Nameless Madness cannot take damage.
Forced - After you successfully evade or attack The Nameless Madness: For each point you succeeded by, exhaust the nearest ready copy of The Nameless Madness.

--- NUMS ---
{  "damage": 1,  "horror": 1,  "quantity": 15,  "encounterCode": "stirring_in_the_deep",  "subname": "The Entity in the Mirage",  "subnameZh": "幻景中的存在" }
--- FLAGS DECLARED ---
  flags.namelessMadness  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  flags.cannotTakeDamage  <<UNREAD kind=undefined
  flags.alert  read@src/engine/card-lookup.js,src/engine/combat-odds.js,src/engine/combat.js
  flags.massive  read@src/engine/combat.js,src/engine/describe.js,src/engine/enemies.js
  flags.retaliate  read@src/engine/card-lookup.js,src/engine/combat-odds.js,src/engine/combat.js
  flags.exhaustNearestOnSuccess  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
SIMPLIFIED: pending-primitive: p7-08679（近似已披露，不阻塞 gate） [p7-08679]
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08679 无名的疯狂（The Nameless Madness）· 深潜组敌人 ×15
// 卡面：Alert. Massive. Retaliate. 不能受到伤害。
// 强制 - 你成功规避或攻击它后：按成功差值每 1 点，重整最近的一份已重整的同名副本。
export default {
  code: '08679',
  scope: 'enemy',
  implemented: true,
  flags: {
    namelessMadness: true,
    cannotTakeDamage: true,
    alert: true,
    massive: true,
    retaliate: true,
    exhaustNearestOnSuccess: true,
  },
  enemyScript: {
    onSpawn(state, enemy, api) {
      api.info?.('👁️ 无名的疯狂：Alert/Massive/Retaliate，且不能受到伤害。')
    },
  },
}
====================================================================================================
CODE 08680 | 08680 解开封印的幻影 / Unsealed Phantasm
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Eidolon,Shoggoth | xp: null | quantity: 2
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08680.js
--- EN TEXT ---
Spawn - The nearest Mist-Pylon that is not collapsed (or your location, if there are none in play).
While Unsealed Phantasm is ready and at a Mist-Pylon, damage cannot be dealt to that Mist-Pylon.
Forced - At the end of the enemy phase, if Unsealed Phantasm is ready: Move it once toward the Mist-Pylon nearest to it that is not collapsed.

--- NUMS ---
{  "health": 5,  "damage": 2,  "horror": 2,  "victory": 1,  "quantity": 2,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.unsealedPhantasm  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  flags.spawnNearestStandingPylon  <<UNREAD kind=undefined
  flags.protectsReadyPylon  <<UNREAD kind=undefined
  flags.moveTowardPylonAtEnemyPhaseEnd  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08680 未封幻影（Unsealed Phantasm）· 深潜组敌人
// 卡面：Spawn - 最近的未坍塌迷雾高塔（没有则在你的地点）。
// 当它已重整且在迷雾高塔时，该高塔不能受到伤害。
// 强制 - 敌人阶段结束时，如果它已重整：朝最近的未坍塌迷雾高塔移动 1 格。
export default {
  code: '08680',
  scope: 'enemy',
  implemented: true,
  flags: {
    unsealedPhantasm: true,
    spawnNearestStandingPylon: true,
    protectsReadyPylon: true,
    moveTowardPylonAtEnemyPhaseEnd: true,
  },
}
====================================================================================================
CODE 08681 | 08681 最终幻景 / The Final Mirage
- partition: eoteCampaign | type: act | status(账本): simplified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08681
- 账本 reason: pending-primitive: p7-08681（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08681.js
--- EN TEXT ---
The Nameless Madness gains hunter.
Forced - When 1 or more doom would be put into play: Instead, spawn 1 set-aside copy of The Nameless Madness at the leftmost investigator's location.
Objective - Run.

--- BACK EN ---
Check the Campaign Log.
- If all 5 Mist-Pylons were collapsed and Dr. Kensler has a plan, proceed to (→R1).
- If all 5 Mist-Pylons were collapsed and the truth of the mirage eludes you, proceed to (→R2).
- Otherwise, proceed to (→R3).

--- NUMS ---
{  "stage": 4,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.finalMirage  <<UNREAD kind=undefined
  flags.resolutionByRecords  <<UNREAD kind=undefined
  actRule.objective  read@src/ai/agent-plans.js,src/engine/ability.js,src/engine/act-agenda.js
  actRule.backEffect  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  actRule.namelessGainsHunter  <<UNREAD kind=undefined
  actRule.runToHiddenTunnel  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  actRule.finalMirageOutcome  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
SIMPLIFIED: pending-primitive: p7-08681（近似已披露，不阻塞 gate） [p7-08681]
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08681 最终幻景（The Final Mirage）· 幕 4 / 议程 6 双面
// 卡面：无名的疯狂获得 hunter。强制 - 当 1+ 毁灭将被放置时，改为在左侧调查员所在地点生成 1 份。
// 目标 - 逃跑（Run）。背面：检查战役日志：五座高塔全坍塌且肯斯勒有计划 → R1；
// 五座高塔全坍塌但真相未明 → R2；否则 → R3。
export default {
  code: '08681',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'runToHiddenTunnel' },
    backEffect: 'finalMirageOutcome',
    namelessGainsHunter: true,
  },
  flags: { finalMirage: true, resolutionByRecords: true },
}
====================================================================================================
CODE 08682 | 08682 巨大坡道 / Titanic Ramp
- partition: eoteCampaign | type: location | status(账本): simplified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08682
- 账本 reason: pending-primitive: p7-08682（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08682.js
--- EN TEXT ---
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (4). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.

--- BACK EN ---
Titanic Ramp is connected to the locations to its left and right.

--- NUMS ---
{  "clues": 1,  "shroud": 1,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.ramp  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js,content/campaigns/edgeOfTheEarth/story-text.js
  locationRule.leaveTestDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
  locationRule.spendClueAutoSucceed  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
SIMPLIFIED: pending-primitive: p7-08682（近似已披露，不阻塞 gate） [p7-08682]
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08682 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (4)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 读点：locationRule.leaveTestDifficulty / spendClueAutoSucceed → behavior.locationLeaveTest。
export default {
  code: '08682',
  scope: 'location',
  implemented: true,
  locationRule: {
    leaveTestDifficulty: 4,
    spendClueAutoSucceed: true,
  },
  flags: { ramp: true },
}
====================================================================================================
CODE 08683 | 08683 巨大坡道 / Titanic Ramp
- partition: eoteCampaign | type: location | status(账本): simplified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08683
- 账本 reason: pending-primitive: p7-08682（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08683.js
--- EN TEXT ---
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (3). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.

--- BACK EN ---
Titanic Ramp is connected to the locations to its left and right.

--- NUMS ---
{  "clues": 1,  "shroud": 2,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  flags.ramp  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js,content/campaigns/edgeOfTheEarth/story-text.js
  locationRule.leaveTestDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
  locationRule.spendClueAutoSucceed  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
SIMPLIFIED: pending-primitive: p7-08682（近似已披露，不阻塞 gate） [p7-08682]
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08683 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (3)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 读点：locationRule.leaveTestDifficulty / spendClueAutoSucceed → behavior.locationLeaveTest。
export default {
  code: '08683',
  scope: 'location',
  implemented: true,
  locationRule: {
    leaveTestDifficulty: 3,
    spendClueAutoSucceed: true,
  },
  flags: { ramp: true },
}