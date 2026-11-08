# D 分片审阅摘要 2（08660–08671）

====================================================================================================
CODE 08660 | 08660 瘴气的召唤 / The Miasma Beckons
- partition: eoteCampaign | type: agenda | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08660
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08660.js
--- EN TEXT ---
Forced - If two or more activated seals are controlled by investigators at the same location: The latent energy stored within the seals fuses together, and the ensuing chain reaction sets off an electrostatic detonation that destroys all life on Earth. (→R3)

--- BACK EN ---
Check the seals controlled by each investigator (if a seal is not controlled by an investigator, skip it).
The investigator who controls the [seal_a] seal takes 1 damage (2 instead if the seal is activated).
The investigator who controls the [seal_b] seal discards 2 random cards from their hand (4 instead if the seal is activated).
The investigator who controls the [seal_c] seal takes 1 horror (2 instead if the seal is activated).
The investigator who controls the [seal_d] seal loses 1 action (2 instead if the seal is activated).
The investigator who controls the [seal_e] seal loses 3 resources (6 instead if the seal is activated).

--- NUMS ---
{  "doom": 6,  "stage": 2,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  agendaRule.forced  read@src/cards/card-effects.js,src/engine/ability-exec.js,src/engine/ability-rules.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08660 瘴气召唤（The Miasma Beckons）· 议程 2
// 背面：检查每名调查员控制的封印（无人控制的跳过）：[seal_a] 控制者受 1 伤害（激活则 2）；
// [seal_b] 控制者随机弃 2 张手牌（激活则 4）；[seal_c] 控制者受 1 恐惧（激活则 2）；
// [seal_d] 控制者获得 1 个线索；[seal_e] 控制者获得 2 资源。读点：章节 behavior.agendaLeftPlay 分派。
export default {
  code: '08660',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    forced: { anyWindow() { return undefined } },
    onLeave(state, agenda, api) {
      const seals = state.campaign?.eote?.seals?.entries || []
      const active = kind => seals.some(entry => entry.kind === kind && entry.active)
      const controlled = kind => seals.find(entry => entry.kind === kind && entry.placedBySeat != null)
      const a = controlled('A')
      if (a) api.damage?.(a.placedBySeat, active('A') ? 2 : 1)
      const b = controlled('B')
      if (b) api.discardRandom?.(b.placedBySeat, active('B') ? 4 : 2)
      const c = controlled('C')
      if (c) api.horror?.(c.placedBySeat, active('C') ? 2 : 1)
      const d = controlled('D')
      if (d) api.gainClues?.(d.placedBySeat, 1)
      const e = controlled('E')
      if (e) api.gainResources?.(e.placedBySeat, 2)
      api.info?.('🫀 瘴气召唤背面：按封印控制者结算伤害/恐惧/弃牌/线索/资源。')
    },
  },
}
====================================================================================================
CODE 08661 | 08661 疯狂的召唤 / Call of Madness
- partition: eoteCampaign | type: agenda | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08661
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08661.js
--- EN TEXT ---
Forced - If two or more activated seals are controlled by investigators at the same location: The latent energy stored within the seals fuses together, and the ensuing chain reaction sets off an electrostatic detonation that destroys all life on Earth. (→R3)

--- BACK EN ---
Each remaining investigator is defeated and must either suffer 1 mental trauma or shuffle the top 3 cards of the Tekeli-li deck into their deck.

--- NUMS ---
{  "doom": 6,  "stage": 3,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  agendaRule.madness  read@src/engine/scenario-runtime.js,src/engine/treachery-tokens.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08661 疯狂呼唤（Call of Madness）· 议程 3
// 背面：每名剩余调查员被击败，并必须选择承受 1 点精神创伤或把忒咳哩-哩牌库顶 3 张洗入牌库。
export default {
  code: '08661',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onLeave(state, agenda, api) {
      const active = (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
      for (const inv of active) {
        api.addTrauma?.(inv.seat, 'mental', 1)
        api.info?.(`🫀 疯狂呼唤：${inv.name || inv.seat} 被击败并承受 1 点精神创伤（忒咳哩-哩近似）。`)
        api.defeatInvestigator?.(inv.seat, { cause: 'madness' })
      }
    },
  },
}
====================================================================================================
CODE 08662 | 08662 蛰伏 / Dormancy
- partition: eoteCampaign | type: act | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08662
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08662.js
--- EN TEXT ---
Objective - If an activated seal is placed on The Gate of Y'quaa, advance.

--- BACK EN ---
Check which seal was just placed (do not remove it).
If it was the [seal_a] seal, the investigator who placed it heals 1 damage.
If it was the [seal_b] seal, the investigator who placed it draws 2 cards.
If it was the [seal_c] seal, the investigator who placed it heals 1 horror.
If it was the [seal_d] seal, the investigator who placed it may take an additional action this turn.
If it was the [seal_e] seal, the investigator who placed it gains 3 resources.

--- NUMS ---
{  "stage": 1,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  actRule.objective  read@src/ai/agent-plans.js,src/engine/ability.js,src/engine/act-agenda.js
  actRule.activatedSealOnGate  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08662 休眠（Dormancy）· 幕 1
// 正面目标：如果有激活封印放在伊夸之门上，推进。背面：按刚放上的封印种类分别治疗效果（由 P8 封印批次接通）。
// 读点：objective 数据由 definition/behavior.checkObjectives 读取（引擎 act-agenda.js 直接读 act.objective）。
export default {
  code: '08662',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'activatedSealOnGate' },
    onLeave(state, act, api) {
      api.info?.('🫀 休眠背面：检查刚放上门的激活封印并结算对应治疗/抽牌/额外行动（封印批次近似）。')
    },
  },
}
====================================================================================================
CODE 08663 | 08663 巨大封印 / The Great Seal
- partition: eoteCampaign | type: act | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08663
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08663.js
--- EN TEXT ---
Objective - Place as many activated seals as you can on The Gate of Y'quaa before whatever is inside escapes. If all five seals have been placed, advance.

--- BACK EN ---
(→R1)

--- NUMS ---
{  "stage": 2,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  actRule.objective  read@src/ai/agent-plans.js,src/engine/ability.js,src/engine/act-agenda.js
  actRule.allSealsOnGate  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-rules.test.mjs","tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08663 大封印（The Great Seal）· 幕 2
// 正面目标：把尽可能多的激活封印放到伊夸之门；五枚全部放上则推进（→R1）。
export default {
  code: '08663',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'allSealsOnGate' },
  },
}
====================================================================================================
CODE 08664 | 08664 冰川岩洞 / Glacial Grotto
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08664
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08664.js
--- EN TEXT ---
Forced - After Glacial Grotto is revealed: Place the dormant [seal_a] seal on it.
[action]: Test [combat] (2) to shatter the ice. If you succeed, investigators at Glacial Grotto may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.

--- NUMS ---
{  "clues": 0,  "shroud": 3,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.sealRecover  <<UNREAD kind=undefined
  flags.recoverSkill  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.recoverDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08664 冰川石窟（Glacial Grotto）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_a] 放到此处。[action]：检定 [combat] (2) 击碎冰层；
// 成功则此地点的调查员可以团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08664',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:A', actions: 1,
        label: '🧊 冰川石窟：检定 combat(2) 击碎冰层，团队花费线索取得 seal_a' })
    },
  },
  flags: { sealRecover: 'A', recoverSkill: 'combat', recoverDifficulty: 2 },
}
====================================================================================================
CODE 08665 | 08665 雕画密室 / Sculptured Crypt
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08665
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08665.js
--- EN TEXT ---
Forced - After Sculptured Crypt is revealed: Place the dormant [seal_b] seal on it.
[action]: Test [intellect] (2) to decipher the alien script. If you succeed, investigators at Sculptured Crypt may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.

--- NUMS ---
{  "clues": 0,  "shroud": 4,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.sealRecover  <<UNREAD kind=undefined
  flags.recoverSkill  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.recoverDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.intellect  read@src/ai/ai-context.js,src/ai/ai-dialogue.js,src/cards/card-catalog.js
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08665 雕塑墓室（Sculptured Crypt）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_b] 放到此处。[action]：检定 [intellect] (2) 解读异星文字；
// 成功则团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08665',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:B', actions: 1,
        label: '📜 雕塑墓室：检定 intellect(2) 解读异星文字，团队花费线索取得 seal_b' })
    },
  },
  flags: { sealRecover: 'B', recoverSkill: 'intellect', recoverDifficulty: 2 },
}
====================================================================================================
CODE 08666 | 08666 地城祭坛 / Undercity Altar
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08666
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08666.js
--- EN TEXT ---
Forced - After Undercity Altar is revealed: Place the dormant [seal_c] seal on it.
[action]: Test [willpower] (2) to break the ancient ward. If you succeed, investigators at Undercity Altar may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.

--- NUMS ---
{  "clues": 0,  "shroud": 3,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.sealRecover  <<UNREAD kind=undefined
  flags.recoverSkill  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.recoverDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.willpower  read@src/ai/ai-context.js,src/ai/ai-dialogue.js,src/cards/card-catalog.js
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08666 地底祭坛（Undercity Altar）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_c] 放到此处。[action]：检定 [willpower] (2) 打破远古结界；
// 成功则团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08666',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:C', actions: 1,
        label: '🕯️ 地底祭坛：检定 willpower(2) 打破结界，团队花费线索取得 seal_c' })
    },
  },
  flags: { sealRecover: 'C', recoverSkill: 'willpower', recoverDifficulty: 2 },
}
====================================================================================================
CODE 08667 | 08667 脓水隧道 / Ichor-Laden Tunnels
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08667
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08667.js
--- EN TEXT ---
Forced - After Ichor-Laden Tunnels is revealed: Place the dormant [seal_d] seal on it.
[action]: Test [agility] (2) to traverse the ichor. If you succeed, investigators at Ichor-Laden Tunnels may spend 1 [per_investigator] clues, as a group, for you to take control of the seal on it.

--- NUMS ---
{  "clues": 0,  "shroud": 3,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.sealRecover  <<UNREAD kind=undefined
  flags.recoverSkill  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.recoverDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.agility  read@src/ai/ai-context.js,src/ai/ai-dialogue.js,src/cards/card-catalog.js
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08667 脓液隧道（Ichor-Laden Tunnels）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_d] 放到此处。[action]：检定 [agility] (2) 穿过脓液；
// 成功则团队花费 1×人数线索，令你取得封印控制权。
export default {
  code: '08667',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:D', actions: 1,
        label: '🫧 脓液隧道：检定 agility(2) 穿过脓液，团队花费线索取得 seal_d' })
    },
  },
  flags: { sealRecover: 'D', recoverSkill: 'agility', recoverDifficulty: 2 },
}
====================================================================================================
CODE 08668 | 08668 灰岩洞穴 / Limestone Caverns
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08668
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08668.js
--- EN TEXT ---
Forced - After Limestone Caverns is revealed: Place the dormant [seal_e] seal on it.
[action] Investigators at Limestone Caverns spend 1 [per_investigator] clues and 3 [per_investigator] resources, as a group: Take control of the seal on Limestone Caverns.

--- NUMS ---
{  "clues": 0,  "shroud": 2,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.sealRecover  <<UNREAD kind=undefined
  flags.recoverSkill  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.recoverDifficulty  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  flags.recoverResourcesPerInvestigator  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js
  locationRule.scenarioAction  read@src/engine/dispatch.js,src/engine/moves.js,src/engine/script-cards.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08668 石灰岩洞（Limestone Caverns）· 大封印组地点
// 卡面：强制 - 揭示后把休眠 [seal_e] 放到此处。[action]：此地点的调查员团队花费
// 1×人数线索与 3×人数资源：取得此地点的封印控制权（无检定）。
export default {
  code: '08668',
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({ action: 'scenarioAction', rule: 'heartOfMadnessSeal:E', actions: 1,
        label: '⛰️ 石灰岩洞：团队花费线索与资源取得 seal_e（无检定）' })
    },
  },
  flags: { sealRecover: 'E', recoverSkill: null, recoverDifficulty: 0, recoverResourcesPerInvestigator: 3 },
}
====================================================================================================
CODE 08669 | 08669 原生质团 / Protoplasmic Mass
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Shoggoth | xp: null | quantity: 2
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08669.js
--- EN TEXT ---
Hunter.
Spawn - Location farthest from you on the outer ring.
Prey - Nearest investigator with a seal only.
Forced - When the enemy phase ends, if an investigator controls an activated seal: Protoplasmic Mass readies and resolves the enemy phase again (it resolves its hunter keyword and attacks a second time). (Limit once per phase.)

--- NUMS ---
{  "health": 4,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.prey  read@src/cards/campaign-view.js,src/engine/card-lookup.js,src/engine/card-ops.js
  flags.spawnFarthestOuterRing  <<UNREAD kind=undefined
  flags.enemyPhaseEndReadyIfActivatedSeal  <<UNREAD kind=undefined
  flags.nearestSealHolder  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08669 原质团（Protoplasmic Mass）· 大封印组敌人
// 卡面：Hunter。Spawn - 外环离你最远的地点。Prey - 最近的持有封印的调查员。
// 强制 - 敌人阶段结束时，如果有调查员控制激活封印：原质团重整并再次结算敌人阶段（每阶段限一次）。
export default {
  code: '08669',
  scope: 'enemy',
  implemented: true,
  flags: {
    prey: 'nearestSealHolder',
    spawnFarthestOuterRing: true,
    enemyPhaseEndReadyIfActivatedSeal: true,
  },
  enemyScript: {
    onSpawn(state, enemy, api) {
      api.info?.('🫀 原质团生成：优先选择最近的持封印调查员。')
    },
  },
}
====================================================================================================
CODE 08670 | 08670 静电释放 / Electrostatic Discharge
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08670.js
--- EN TEXT ---
Surge.
Revelation - Each investigator at the same location as a seal takes 1 horror, and 1 damage if that seal is activated

--- NUMS ---
{  "quantity": 2,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.surge  read@src/engine/encounter.js
  flags.revelation  read@src/engine/ability.js,src/engine/effects.js,src/engine/encounter.js
  flags.electrostaticDischarge  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js
  treacheryRule.surge  read@src/engine/encounter.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08670 静电放电（Electrostatic Discharge）· 大封印组诡计
// 卡面：Surge。揭示 - 与封印同地点的每名调查员受 1 恐惧；如果该封印已激活，改为受 1 伤害与 1 恐惧。
// 读点：章节 behavior.resolveEncounter 读取 flags.revelation 分派（条目内不改状态）。
export default {
  code: '08670',
  scope: 'treachery',
  implemented: true,
  flags: {
    surge: true,
    revelation: 'electrostaticDischarge',
  },
  treacheryRule: {
    surge: true,
  },
}
====================================================================================================
CODE 08671 | 08671 封印减弱 / The Seal Weakens
- partition: eoteCampaign | type: agenda | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08671
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08671.js
--- EN TEXT ---
（空）

--- BACK EN ---
Spawn 1 set-aside copy of The Nameless Madness enemy at the Mist-Pylon nearest to an investigator.
Check the Campaign Log. If the truth of the mirage eludes you:
You stare, dumbstruck, at the hideous phantasmagoria. The air shimmers with a dreamlike quality about its damnable form, an endless weave of intermingled nightmare and memory. The very sight of it drives you to your knees. It is the final truth. Reality was the mirage.
Each investigator searches their deck for each copy of Tekeli-li and draws them one at a time in a random order, without placing them on the bottom of the Tekeli-li deck. After resolving all of them, shuffle each of them back into their bearer's deck.

--- NUMS ---
{  "doom": 3,  "stage": 4,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
--- FLAGS DECLARED ---
  agendaRule.backEffect  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
  agendaRule.spawnNamelessAtPylon  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-rules.test.mjs","tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08671 封印渐弱（The Seal Weakens）· 议程 4
// 正面无文本；背面：在最靠近调查员的迷雾高塔生成 1 份放一边的「无名的疯狂」，并检查战役日志
// （真相分支由战役 flow 写入记录）。读点：behavior.agendaLeftPlay 按 backEffect 分派。
export default {
  code: '08671',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    backEffect: 'spawnNamelessAtPylon',
    onReveal(state, agenda, api) {
      api.info?.('🫀 封印渐弱：只等瘴气吞没最后的理智。')
    },
  },
}