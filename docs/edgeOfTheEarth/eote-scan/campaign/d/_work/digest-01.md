# D 分片审阅摘要 1（08648–08659）

====================================================================================================
CODE 08648 | 08648 疯狂之心 / The Heart of Madness
- partition: eoteCampaign | type: scenario | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08648
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08648.js
--- EN TEXT ---
Easy / Standard
[skull]: -1 (-3 instead if there is an [[Ancient One]] enemy at your location).
[cultist]: -1. If there is a seal at your location, or if your location is a Mist-Pylon, treat this token as a [frost] token, instead.
[tablet]: -3. If you fail, draw the top card of the Tekeli-li deck.
[elder_thing]: -4. If you fail by 3 or more, place 1 doom on the current agenda. This can cause the current agenda to advance.

--- BACK EN ---
Hard / Expert
[skull]: -2 (-4 instead if there is an [[Ancient One]] enemy at your location).
[cultist]: -1. If there is a seal at your location, or if your location is a Mist-Pylon, treat this token as a [frost] token in addition to its modifier.
[tablet]: -3. Draw the top card of the Tekeli-li deck.
[elder_thing]: -5. If you fail by 3 or more, place 1 doom on the current agenda. This can cause the current agenda to advance.

--- NUMS ---
{  "quantity": 1,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.tokenMeanings  read@src/ai/ai-context.js,src/engine/combat-odds.js,src/engine/treachery-tokens.js
  flags.sealAwareToken  <<UNREAD kind=undefined
  flags.towerAwareToken  <<UNREAD kind=undefined
--- TEST COVERAGE: strong ---
  STRONG: tests/eote-scenario-theHeartOfMadnessPart2.test.mjs:192 P7 theHeartOfMadnessPart2 混乱标记与 story：共用 08648 参考卡、结构可读
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08648 疯狂之心（The Heart of Madness）混乱标记参考卡 · scenario · the_heart_of_madness
// 归属：战役共用 · edgeOfTheEarth/_shared（Part I–II 共用印刷提示卡 08648）。
// 卡面：简单/普通 [skull] -1（所在地点有[[古神]]敌人改为 -3）；[cultist] -1（所在地点有封印或
//   是迷雾高塔时视为 [frost]）；[tablet] -3（失败抽忒咳哩-哩顶 1 张）；[elder_thing] -4（失败且
//   低 3 点以上在当前密谋放 1 毁灭）。困难/专家 [skull] -2（-4）；[cultist] -1 且再 -1；[tablet] -3；
//   [elder_thing] -5。
// 读点：卡面数值口径落在 flags.tokenMeanings（章节 chaos.js 的 tokenMeanings 与本表同源）。
export default {
  code: '08648', scope: 'scenario', implemented: true,
  flags: {
    tokenMeanings: {
      skull: '所在地点有[[古神]]敌人：简单/普通 -3、困难/专家 -4；否则 -1/-2',
      cultist: '-1；所在地点有封印或是迷雾高塔时视为 [frost]（困难/专家再 -1）',
      tablet: '-3；失败抽忒咳哩-哩牌库顶 1 张',
      elderthing: '简单/普通 -4、困难/专家 -5；失败且低 3 点以上在当前密谋放 1 毁灭',
    },
    sealAwareToken: true,
    towerAwareToken: true,
  },
}
====================================================================================================
CODE 08649 | 08649 伊夸之门 / The Gate of Y'quaa
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08649
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08649.js
--- EN TEXT ---
[action]: Place an activated seal you control on The Gate of Y'quaa.
[action]: Resign. You retreat, hoping you've done enough to seal away whatever lies beyond the gate. (If you control 1 or more seals, you retain control of them.)

--- BACK EN ---
A wall of churning miasma blocks the ancient gateway. Investigators and enemies cannot enter The Gate of Y'quaa. The Gate of Y'quaa cannot have attachments.

--- NUMS ---
{  "clues": 1,  "shroud": 1,  "quantity": 1,  "encounterCode": "the_heart_of_madness",  "subname": "Primordial Seal",  "subnameZh": "远古封印" }
--- FLAGS DECLARED ---
  flags.gate  read@src/campaign/part-flow.js,src/engine/actions.js,src/engine/api-misc.js
  flags.claimedSealsKeptOnResign  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08649 伊夸之门（The Gate of Y’quaa）· 地点 · the_heart_of_madness
// 卡面：[action]：将你控制的一个激活的封印放在伊夸之门上。
//   [action]：撤退。你撤退了……（如果你控制着 1 个或更多封印，你保留它们的控制权）。
//   背面：一堵翻滚的瘴气之墙挡住了古老的大门，调查员和敌人不能进入伊夸之门。伊夸之门不能拥有附属。
// 读点：放置封印走 campaign.seals.place（唯一写入口，要求已激活+控制者本人）；撤退走 api.resign；
//   背面「不能进入/不能拥有附属」需要引擎的地点背面进入限制读点（primitive-requests/p7-08649.json）。
const CODE = '08649'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { gate: true, claimedSealsKeptOnResign: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '将你控制的一个激活的封印放到伊夸之门上',
    resolve: ({ state, inv, source, api }) => {
      const held = api.mechanics.eoteCampaign.seals.held(inv.seat).filter(seal => seal.active)
      if (!held.length) {
        api.info('「伊夸之门」：你没有已激活且未放置的封印。')
        return
      }
      const kind = held.length === 1 ? held[0].kind : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择放到伊夸之门上的封印。', options: held.map(seal => ({ id: seal.kind, label: '封印 ' + seal.kind })) })
      if (!held.some(seal => seal.kind === kind)) return
      if (api.mechanics.eoteCampaign.seals.place(kind, { seat: inv.seat, locationId: source.id })) {
        api.info('🔯 「伊夸之门」：封印 ' + kind + ' 被放到大门上。')
      }
    },
  }, {
    kind: 'action', actionKind: 'resign', label: '撤退：离开伊夸之门（保留你控制的封印）',
    resolve: ({ inv, api }) => api.resign(inv.seat),
  }],
  note: '背面「调查员与敌人不能进入、不能拥有附属」需要引擎的地点背面进入限制读点（primitive-requests/p7-08649.json）。',
}
====================================================================================================
CODE 08650 | 08650 地热口 / Geothermal Vent
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08650
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08650.js
--- EN TEXT ---
[action] If you control the [seal_a] seal: Test [combat] (3). If you succeed, investigators at Geothermal Vent spend 1 [per_investigator] clues, as a group, to activate the [seal_a] seal. Then, remove 1 [frost] token from the chaos bag.

--- NUMS ---
{  "clues": 1,  "shroud": 4,  "quantity": 1,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.ancientFacility  read@src/engine/eote-facilities.js
  flags.roomSeal  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08650 地热口（Geothermal Vent） · 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_a]封印：检定[combat](3)。成功则位于本地的调查员
//   可以共同花费 1[per_investigator] 个线索来激活[seal_a]封印。然后，从混乱袋里移除 1 个[frost] 标记。
// 读点：共同花费逐位走 runtime.spendClues（先整体预检，不足不扣）；激活走 campaign.seals.activate
//   （P2 封印唯一写入口）。
const CODE = '08650'
const SEAL = 'A'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '控制封印 A：检定 combat(3)，成功后共同花费线索激活该封印',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      api.test(inv.seat, 'combat', 3, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
        const contributors = state.investigators.filter(mate => !mate.defeated && !mate.resigned
          && mate.location === source.id && (mate.clues || 0) > 0)
        const total = contributors.reduce((sum, mate) => sum + (mate.clues || 0), 0)
        if (total < required) {
          api.info('「地热口（Geothermal Vent）」：本地共同线索不足（需要 ' + required + '）。')
          return
        }
        let left = required
        for (const mate of contributors) {
          if (!left) break
          const pay = Math.min(left, mate.clues || 0)
          runtime.spendClues(mate.seat, pay)
          left -= pay
        }
        if (!api.mechanics.eoteCampaign.seals.activate(SEAL)) {
          api.info('「地热口（Geothermal Vent）」：封印 A 当前不能激活。')
          return
        }
        api.info('🔯 「地热口（Geothermal Vent）」：封印 A 被激活。')
        api.mechanics.frost.pay(1);
      } })
    },
  }],
}
====================================================================================================
CODE 08651 | 08651 被遗忘的神庙 / Forsaken Temple
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08651
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08651.js
--- EN TEXT ---
[action] If you control the [seal_c] seal: Test [willpower] (3). If you succeed, investigators at Forsaken Temple spend 1 [per_investigator] clues, as a group, to activate the [seal_c] seal. Then, look at the revealed side of each unrevealed location on the same spoke as Forsaken Temple.

--- NUMS ---
{  "clues": 1,  "shroud": 3,  "quantity": 1,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.ancientFacility  read@src/engine/eote-facilities.js
  flags.roomSeal  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08651 被遗忘的神庙（Forsaken Temple） · 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_c]封印：检定[willpower](3)。成功则位于本地的调查员
//   可以共同花费 1[per_investigator] 个线索来激活[seal_c]封印。然后，查看与被遗忘的神庙在同一辐条上的所有未揭示地点的已揭示面。
// 读点：共同花费逐位走 runtime.spendClues（先整体预检，不足不扣）；激活走 campaign.seals.activate
//   （P2 封印唯一写入口）。
const CODE = '08651'
const SEAL = 'C'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '控制封印 C：检定 willpower(3)，成功后共同花费线索激活该封印',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      api.test(inv.seat, 'willpower', 3, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
        const contributors = state.investigators.filter(mate => !mate.defeated && !mate.resigned
          && mate.location === source.id && (mate.clues || 0) > 0)
        const total = contributors.reduce((sum, mate) => sum + (mate.clues || 0), 0)
        if (total < required) {
          api.info('「被遗忘的神庙（Forsaken Temple）」：本地共同线索不足（需要 ' + required + '）。')
          return
        }
        let left = required
        for (const mate of contributors) {
          if (!left) break
          const pay = Math.min(left, mate.clues || 0)
          runtime.spendClues(mate.seat, pay)
          left -= pay
        }
        if (!api.mechanics.eoteCampaign.seals.activate(SEAL)) {
          api.info('「被遗忘的神庙（Forsaken Temple）」：封印 C 当前不能激活。')
          return
        }
        api.info('🔯 「被遗忘的神庙（Forsaken Temple）」：封印 C 被激活。')
        api.info('「被遗忘的神庙」：查看同一辐条上所有未揭示地点的已揭示面（由章节地图数据结算）。');
      } })
    },
  }],
}
====================================================================================================
CODE 08652 | 08652 寇斯图书馆 / Library of Kós
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08652
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08652.js
--- EN TEXT ---
[action] If you control the [seal_b] seal: Test [intellect] (3). If you succeed, investigators at Library of Kós spend 1 [per_investigator] clues, as a group, to activate the [seal_b] seal. Then, look at the revealed side of each unrevealed location on the same ring as Library of Kós.

--- NUMS ---
{  "clues": 1,  "shroud": 5,  "quantity": 1,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.ancientFacility  read@src/engine/eote-facilities.js
  flags.roomSeal  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08652 寇斯图书馆（Library of Kós） · 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_b]封印：检定[intellect](3)。成功则位于本地的调查员
//   可以共同花费 1[per_investigator] 个线索来激活[seal_b]封印。然后，查看与寇斯图书馆在同一环形上的所有未揭示地点的已揭示面。
// 读点：共同花费逐位走 runtime.spendClues（先整体预检，不足不扣）；激活走 campaign.seals.activate
//   （P2 封印唯一写入口）。
const CODE = '08652'
const SEAL = 'B'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '控制封印 B：检定 intellect(3)，成功后共同花费线索激活该封印',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      api.test(inv.seat, 'intellect', 3, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
        const contributors = state.investigators.filter(mate => !mate.defeated && !mate.resigned
          && mate.location === source.id && (mate.clues || 0) > 0)
        const total = contributors.reduce((sum, mate) => sum + (mate.clues || 0), 0)
        if (total < required) {
          api.info('「寇斯图书馆（Library of Kós）」：本地共同线索不足（需要 ' + required + '）。')
          return
        }
        let left = required
        for (const mate of contributors) {
          if (!left) break
          const pay = Math.min(left, mate.clues || 0)
          runtime.spendClues(mate.seat, pay)
          left -= pay
        }
        if (!api.mechanics.eoteCampaign.seals.activate(SEAL)) {
          api.info('「寇斯图书馆（Library of Kós）」：封印 B 当前不能激活。')
          return
        }
        api.info('🔯 「寇斯图书馆（Library of Kós）」：封印 B 被激活。')
        api.info('「寇斯图书馆」：查看同一环形上所有未揭示地点的已揭示面（由章节地图数据结算）。');
      } })
    },
  }],
}
====================================================================================================
CODE 08653 | 08653 原生质池 / Protoplasmic Pool
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08653
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08653.js
--- EN TEXT ---
[action] If you control the [seal_d] seal: Test [agility] (3). If you succeed, investigators at Protoplasmic Pool spend 1 [per_investigator] clues, as a group, to activate the [seal_d] seal. Then, deal 2 damage to each enemy in play.

--- NUMS ---
{  "clues": 1,  "shroud": 4,  "quantity": 1,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.ancientFacility  read@src/engine/eote-facilities.js
  flags.roomSeal  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08653 原生质池（Protoplasmic Pool） · 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_d]封印：检定[agility](3)。成功则位于本地的调查员
//   可以共同花费 1[per_investigator] 个线索来激活[seal_d]封印。然后，对场上所有敌人各造成 2 点伤害。
// 读点：共同花费逐位走 runtime.spendClues（先整体预检，不足不扣）；激活走 campaign.seals.activate
//   （P2 封印唯一写入口）。
const CODE = '08653'
const SEAL = 'D'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '控制封印 D：检定 agility(3)，成功后共同花费线索激活该封印',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      api.test(inv.seat, 'agility', 3, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
        const contributors = state.investigators.filter(mate => !mate.defeated && !mate.resigned
          && mate.location === source.id && (mate.clues || 0) > 0)
        const total = contributors.reduce((sum, mate) => sum + (mate.clues || 0), 0)
        if (total < required) {
          api.info('「原生质池（Protoplasmic Pool）」：本地共同线索不足（需要 ' + required + '）。')
          return
        }
        let left = required
        for (const mate of contributors) {
          if (!left) break
          const pay = Math.min(left, mate.clues || 0)
          runtime.spendClues(mate.seat, pay)
          left -= pay
        }
        if (!api.mechanics.eoteCampaign.seals.activate(SEAL)) {
          api.info('「原生质池（Protoplasmic Pool）」：封印 D 当前不能激活。')
          return
        }
        api.info('🔯 「原生质池（Protoplasmic Pool）」：封印 D 被激活。')
        for (const enemy of [...(state.enemies || [])]) { if (!enemy.defeated) api.scenario.damageEnemy(enemy.id, 2, inv.seat, CODE) }
      } })
    },
  }],
}
====================================================================================================
CODE 08654 | 08654 无光之海大厅 / Hall of the Sunless Sea
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08654
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08654.js
--- EN TEXT ---
[action] If you control the [seal_e] seal, investigators at Hall of the Sunless Sea spend 1 [per_investigator] clues and discard 2 [per_investigator] cards from their hands, as a group: Activate the [seal_e] seal.

--- NUMS ---
{  "clues": 1,  "shroud": 3,  "quantity": 1,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.ancientFacility  read@src/engine/eote-facilities.js
  flags.roomSeal  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08654 无光之海大厅（Hall of the Sunless Sea）· 地点（古代设施）· the_heart_of_madness
// 卡面：[action]如果你控制[seal_e]封印，位于无光之海大厅的调查员可以共同花费
//   1[per_investigator] 个线索并弃掉 2[per_investigator] 张手牌：激活[seal_e]封印。
// 读点：共同花费逐位走 runtime.spendClues；弃手牌走 api.discardChosen（每名本地调查员 2 张，
//   与卡面 per-investigator 口径一致）；激活走 campaign.seals.activate。
const CODE = '08654'
const SEAL = 'E'

function sealHeldBy(state, seat) {
  return state.campaign?.eote?.seals?.entries?.some(entry => entry.kind === SEAL
    && entry.active === false && entry.placedBySeat === seat && entry.locationId == null) || false
}

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, roomSeal: SEAL },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '控制封印 E：共同花费线索并弃手牌，激活封印 E',
    limit: { scope: 'perGame', owner: 'instance' },
    criteria: ({ state, inv }) => sealHeldBy(state, inv.seat),
    resolve: ({ state, inv, source, api }) => {
      const runtime = api.scenario || api
      const required = Math.max(1, Number(state.numInvestigators) || state.investigators.length || 1)
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === source.id)
      const total = mates.reduce((sum, other) => sum + (other.clues || 0), 0)
      if (total < required) {
        api.info('「无光之海大厅」：本地共同线索不足（需要 ' + required + '）。')
        return
      }
      let left = required
      for (const other of mates) {
        if (!left) break
        const pay = Math.min(left, other.clues || 0)
        if (pay > 0) runtime.spendClues(other.seat, pay)
        left -= pay
      }
      for (const other of mates) api.discardChosen(other.seat, 2, CODE)
      if (api.mechanics.eoteCampaign.seals.activate(SEAL)) {
        api.info('🔯 「无光之海大厅」：封印 E 被激活。')
      }
    },
  }],
}
====================================================================================================
CODE 08655 | 08655 水下扩张区 / Subnautical Sprawl
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 2
- doubleSided: true | originalCode: 08655
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08655.js
--- EN TEXT ---
Treat the modifier of the first [frost] token revealed during each skill test at Subnautical Sprawl as -3 instead of -1. (Limit once per round.)

--- NUMS ---
{  "clues": 2,  "shroud": 2,  "quantity": 2,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.ancientFacility  read@src/engine/eote-facilities.js
  flags.firstFrostModifier  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08655 水下扩张区（Subnautical Sprawl）· 地点（古代设施）· the_heart_of_madness
// 卡面：在水下扩张区的每次技能检定期间，将揭示的第一个[frost]标记的修正值改为视为 -3，
//   而不是 -1（每轮仅限一次）。
// 读点：forced + trigger 'tokenReveal'；限制 perRound/instance；修正走 api.mechanics.chaosTokens.treat。
const CODE = '08655'

const frostSeenThisTest = state => (state.skillTest?.tokenResults || []).some(item => item.face === 'frost')

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, firstFrostModifier: -3 },
  abilities: [{
    kind: 'forced', trigger: 'tokenReveal',
    label: '水下扩张区：每轮第一个 [frost] 修正视为 -3',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ state, source, inv, context }) => context?.token === 'frost'
      && state.skillTest?.seat === inv.seat
      && state.investigators?.[inv.seat]?.location === source.id
      && !frostSeenThisTest(state),
    resolve: ({ api }) => {
      api.mechanics.chaosTokens.treat({ as: 'frost', modifier: -3 })
      api.info('🌊 「水下扩张区」：本轮第一个 [frost] 修正视为 -3。')
    },
  }],
}
====================================================================================================
CODE 08656 | 08656 拱形走廊 / Vaulted Corridor
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 3
- doubleSided: true | originalCode: 08656
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08656.js
--- EN TEXT ---
[fast]: Choose another Vaulted Corridor and test [agility] (X). X is the number of locations away that Vaulted Corridor is from this one. If you succeed, move there. (Limit once per round.)

--- NUMS ---
{  "clues": 1,  "shroud": 3,  "quantity": 3,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  flags.ancientFacility  read@src/engine/eote-facilities.js
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08656 拱形走廊（Vaulted Corridor）· 地点（古代设施）· the_heart_of_madness
// 卡面：[free]：选择另一个拱形走廊并检定[agility](X)。X 为本地点到该走廊所需移动次数。
//   如果你检定成功，移动到该地点（每轮仅限一次）。
// 读点：abilities 的地点 free 能力（非玩家来源含已揭示地点）；距离走连接图 BFS。
import { entryDistance } from '../../../_shared.js'

const CODE = '08656'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '选择另一个拱形走廊，敏捷(X) 移动过去（每轮一次）',
    limit: { scope: 'perRound', owner: 'instance' },
    resolve: ({ state, inv, source, api }) => {
      const others = state.locations.filter(loc => loc.id !== source.id
        && (loc.originalCode || loc.code) === CODE)
      if (!others.length) {
        api.info('「拱形走廊」：场上没有另一条拱形走廊。')
        return
      }
      const chosen = others.length === 1 ? others[0] : others.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择要移动到的拱形走廊。',
        options: others.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || others[0]
      const distance = entryDistance(state, source.id, chosen.id)
      if (!Number.isFinite(distance) || distance <= 0) {
        api.info('「拱形走廊」：目标不可达。')
        return
      }
      api.test(inv.seat, 'agility', distance, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.moveInvestigator(inv.seat, chosen.id)
        api.info('🚪 「拱形走廊」：移动到「' + (chosen.name || chosen.id) + '」。')
      } })
    },
  }],
}
====================================================================================================
CODE 08657 | 08657 原始恐怖 / Primeval Terror
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08657.js
--- EN TEXT ---
Revelation - Test [willpower] (2). This test gets +1 difficulty for each location away from The Gate of Y'quaa you are. If you fail, take 2 horror.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08657 原始恐怖（Primal Terror）· 诡计 · the_heart_of_madness
// 卡面：显现 - 检定[willpower](2)。你所在地点到伊夸之门每需移动一次，本次检定得到 +1 难度。
//   如果你检定失败，受到 2 点恐惧。
// 读点：距离走连接图 BFS；伊夸之门按印刷卡号 08649 定位（本清单的固定场地）。
import { entryDistance, ALL_CARDS } from '../../../_shared.js'

const CODE = '08657'
const gateId = state => state.locations.find(loc => (loc.originalCode || loc.code) === '08649')?.id || null

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const gate = gateId(state)
    const distance = gate ? entryDistance(state, inv.location, gate) : 0
    const difficulty = 2 + (Number.isFinite(distance) && distance > 0 ? distance : 0)
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}
====================================================================================================
CODE 08658 | 08658 地球根源 / Roots of the Earth
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08658.js
--- EN TEXT ---
Revelation - Test [agility] (2). This test gets +1 difficulty for each location away from The Gate of Y'quaa you are. If you fail, take 2 damage.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "the_heart_of_madness" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08658 地球根源（Roots of the Earth）· 诡计 · the_heart_of_madness
// 卡面：显现 - 检定[agility](2)。你所在地点到伊夸之门每需移动一次，本次检定得到 +1 难度。
//   如果你检定失败，受到 2 点伤害。
// 读点：距离走连接图 BFS；伊夸之门按印刷卡号 08649 定位。
import { entryDistance } from '../../../_shared.js'

const CODE = '08658'
const gateId = state => state.locations.find(loc => (loc.originalCode || loc.code) === '08649')?.id || null

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const gate = gateId(state)
    const distance = gate ? entryDistance(state, inv.location, gate) : 0
    const difficulty = 2 + (Number.isFinite(distance) && distance > 0 ? distance : 0)
    api.test(inv.seat, 'agility', difficulty, result => {
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}
====================================================================================================
CODE 08659 | 08659 跳动的心脏 / The Beating Heart
- partition: eoteCampaign | type: agenda | status(账本): verified
- pack: eoec | klass: mythos | traits:  | xp: null | quantity: 1
- doubleSided: true | originalCode: 08659
- 归属: 章节 theHeartOfMadnessPart1
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08659.js
--- EN TEXT ---
Forced - If two or more activated seals are controlled by investigators at the same location: The latent energy stored within the seals fuses together, and the ensuing chain reaction sets off an electrostatic detonation that destroys all life on Earth. (→R3)

--- BACK EN ---
Read Scenario Interlude: The Final Straw in the Campaign Guide.

--- NUMS ---
{  "doom": 5,  "stage": 1,  "quantity": 1,  "encounterCode": "the_great_seal" }
--- FLAGS DECLARED ---
  flags.detonation  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js
  agendaRule.detonation  read@content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart1.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08659 跳动的心脏（The Beating Heart）· 议程 1
// 卡面：强制 - 如果两名或更多激活封印被同一地点的调查员控制：静电爆炸毁灭一切（→R3）。
// 背面：阅读战役指南的幕间「最后一根稻草」。读点：forced 由章节 behavior.checkObjectives /
// performAction 统一检查（封印记账在 src/campaign/eote-seals.js），本条目只声明数据与幕间记录。
export default {
  code: '08659',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    detonation: true,
    onLeave(state, agenda, api) {
      api.setScenarioFlag?.('interlude', 'theFinalStraw')
      api.info?.('🫀 跳动的心脏：阅读幕间「最后一根稻草」。')
    },
  },
  flags: { detonation: true },
}