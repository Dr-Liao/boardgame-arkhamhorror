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
====================================================================================================
CODE 08684 | 08684 巨大坡道 / Titanic Ramp
- partition: eoteCampaign | type: location | status(账本): simplified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08684
- 账本 reason: pending-primitive: p7-08682（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08684.js
--- EN TEXT ---
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (2). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.

--- BACK EN ---
Titanic Ramp is connected to the locations to its left and right.

--- NUMS ---
{  "clues": 1,  "shroud": 3,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
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
// 08684 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (2)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 读点：locationRule.leaveTestDifficulty / spendClueAutoSucceed → behavior.locationLeaveTest。
export default {
  code: '08684',
  scope: 'location',
  implemented: true,
  locationRule: {
    leaveTestDifficulty: 2,
    spendClueAutoSucceed: true,
  },
  flags: { ramp: true },
}
====================================================================================================
CODE 08685 | 08685 巨大坡道 / Titanic Ramp
- partition: eoteCampaign | type: location | status(账本): simplified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08685
- 账本 reason: pending-primitive: p7-08682（近似已披露，不阻塞 gate）
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08685.js
--- EN TEXT ---
Titanic Ramp is connected to the locations to its left and right.
As an additional cost for you to leave Titanic Ramp, test [agility] (1). If you fail, cancel the effects of the move. Any investigator at your location or a connecting location may spend 1 clue to have you automatically succeed at this test.

--- BACK EN ---
Titanic Ramp is connected to the locations to its left and right.

--- NUMS ---
{  "clues": 1,  "shroud": 4,  "quantity": 1,  "encounterCode": "stirring_in_the_deep" }
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
// 08685 泰坦坡道（Titanic Ramp）· 深潜组地点
// 卡面：泰坦坡道与左右相邻地点连接。离开泰坦坡道的额外费用：检定 [agility] (1)，失败则取消移动；
// 你所在地点或连接地点的任意调查员可花费 1 线索令你自动成功。
// 读点：locationRule.leaveTestDifficulty / spendClueAutoSucceed → behavior.locationLeaveTest。
export default {
  code: '08685',
  scope: 'location',
  implemented: true,
  locationRule: {
    leaveTestDifficulty: 1,
    spendClueAutoSucceed: true,
  },
  flags: { ramp: true },
}
====================================================================================================
CODE 08686 | 08686 隐秘隧道 / Hidden Tunnel
- partition: eoteCampaign | type: location | status(账本): verified
- pack: eoec | klass: mythos | traits: Ruins | xp: null | quantity: 1
- doubleSided: true | originalCode: 08686
- 归属: 章节 theHeartOfMadnessPart2
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08686.js
--- EN TEXT ---
Hidden Tunnel is connected to the location to its left.
Objective - If each undefeated investigator is at the Hidden Tunnel, advance the act.

--- BACK EN ---
Hidden Tunnel is connected to the location to its left.

--- NUMS ---
{  "clues": 0,  "shroud": 5,  "quantity": 1,  "encounterCode": "stirring_in_the_deep",  "subname": "A Way Out",  "subnameZh": "出逃之路" }
--- FLAGS DECLARED ---
  flags.hiddenTunnel  read@content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js
  flags.objectiveRun  <<UNREAD kind=undefined
  locationRule.objectiveRun  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-theHeartOfMadnessPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08686 隐藏隧道（Hidden Tunnel）· 深潜组地点
// 卡面：隐藏隧道与左侧地点连接。目标 - 如果每名未被击败的调查员都在隐藏隧道，推进幕。
export default {
  code: '08686',
  scope: 'location',
  implemented: true,
  locationRule: {
    objectiveRun: true,
  },
  flags: { hiddenTunnel: true, objectiveRun: true },
}
====================================================================================================
CODE 08687 | 08687 原初恶魔 / Primordial Evil
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Eidolon | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/agents_of_the_unknown/08687.js
--- EN TEXT ---
Hunter. Retaliate.
Forced - When you deal any amount of damage to Primordial Evil: Shuffle the top card of the Tekeli-li deck into your deck without looking at it (if you cannot, Primordial Evil attacks you).

--- NUMS ---
{  "health": 5,  "damage": 2,  "horror": 1,  "quantity": 2,  "encounterCode": "agents_of_the_unknown" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08687 原初恶魔（Primordial Evil）· 敌人 · agents_of_the_unknown
// 归属：战役共用 · edgeOfTheEarth/_shared。卡面：猎手。反击。
// 强制 - 在你对原初恶魔造成任意数量的伤害时：将忒咳哩-哩牌库顶的 1 张卡牌洗入你的牌库，
//   不要查看内容（如果你不能这么做，原初恶魔攻击你）。
// 读点：abilities 的 forced + trigger 'enemyDamaged'（combat.js 普通攻击与伤害管线都会开窗）；
//   洗入走 P2-E api.mechanics.tekeli.shuffleIn（牌张不足返回 false 即「不能这么做」）。
export default {
  code: '08687', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDamaged',
    label: '原初恶魔受到伤害后：洗入 1 张忒咳哩-哩；不能则它攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context?.seat),
    resolve: ({ state, source, context, api }) => {
      const seat = context.seat
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(seat, 1) : false
      if (Array.isArray(shuffled) && shuffled.length) {
        api.info('「原初恶魔」：1 张忒咳哩-哩洗入牌库（不查看内容）。')
        return
      }
      api.info('「原初恶魔」：没有忒咳哩-哩可洗入，它立刻攻击了调查员。')
      api.scenario.attack(source, state.investigators[seat])
    },
  }],
}
====================================================================================================
CODE 08688 | 08688 潜藏的疯狂 / The Madness Within
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/agents_of_the_unknown/08688.js
--- EN TEXT ---
Revelation - Test [willpower] (4). For each point you fail by, shuffle the top card of the Tekeli-li deck into your deck without looking at it (for each card you cannot shuffle, take 1 horror).

--- NUMS ---
{  "quantity": 2,  "encounterCode": "agents_of_the_unknown" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08688 潜藏的疯狂（Latent Madness）· 诡计 · agents_of_the_unknown
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 检定[willpower](4)。你检定失败且每低于难度 1 点，将忒咳哩-哩牌库顶的 1 张卡牌
//   洗入你的牌库，不要查看内容（每有 1 张卡牌不能洗入你的牌库，受到 1 点恐惧）。
// 读点：entryRevelation + encounterResolve（treachery-tokens.js 的条目通道）。
export default {
  code: '08688', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      const failedBy = Math.max(0, 4 - Number(result.value || 0))
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = failedBy > 0 && size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, Math.min(failedBy, size)) : false
      const done = Array.isArray(shuffled) ? shuffled.length : 0
      const missing = failedBy - done
      api.info('「潜藏的疯狂」：洗入 ' + done + ' 张忒咳哩-哩' + (missing > 0 ? '，' + missing + ' 张无法洗入。' : '。'))
      if (missing > 0) api.horror(inv.seat, missing)
    })
    return false
  },
}
====================================================================================================
CODE 08689 | 08689 实体疯狂 / Manifestation of Madness
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Eidolon | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08689.js
--- EN TEXT ---
Hunter.
Forced - When Manifestation of Madness attacks you: Shuffle the top 2 cards of the Tekeli-li deck into your deck without looking at them (for each card you cannot shuffle, Manifestation of Madness deals +1 damage and +1 horror for this attack).

--- NUMS ---
{  "health": 3,  "damage": 1,  "horror": 1,  "quantity": 3,  "encounterCode": "creatures_in_the_ice" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-iceAndDeathPart1.test.mjs","tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08689 实体疯狂（Manifest Madness）· 敌人 · creatures_in_the_ice
// 卡面：猎手。强制 - 在实体疯狂攻击你时：将忒咳哩-哩牌库顶的 2 张卡牌洗入你的牌库（每有 1 张
//   卡牌不能洗入你的牌库，实体疯狂该次攻击造成 +1 伤害和 +1 恐惧）。
// 读点：forced + trigger 'enemyAttacked'（enemies.js#enemyAttack 在攻击结算后开窗）。
export default {
  code: '08689', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyAttacked',
    label: '实体疯狂攻击后：洗入 2 张忒咳哩-哩；每张不能洗入则本次攻击 +1 伤害/+1 恐惧',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id
      && Number.isSafeInteger(context?.seat) && context?.attackCancelled !== true,
    resolve: ({ state, context, api }) => {
      const seat = context.seat
      const size = Number(api.mechanics.tekeli.size())
      const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(seat, Math.min(2, size)) : false
      const done = Array.isArray(shuffled) ? shuffled.length : 0
      const missing = 2 - done
      if (missing <= 0) return
      api.info('「实体疯狂」：' + missing + ' 张忒咳哩-哩无法洗入，该次攻击额外 +' + missing + ' 伤害和 +' + missing + ' 恐惧。')
      api.damage(seat, missing)
      api.horror(seat, missing)
    },
  }],
}
====================================================================================================
CODE 08690 | 08690 冰川幻影 / Glacial Phantasm
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Eidolon | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08690.js
--- EN TEXT ---
Forced - At the end of the enemy phase, if Glacial Phantasm is ready: Move it once toward the location with the most investigators. In player order, each investigator at Glacial Phantasm's location or a connecting location shuffles the top card of the Tekeli-li deck into their deck without looking at it (each investigator who cannot takes 1 horror).

--- NUMS ---
{  "health": 4,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "creatures_in_the_ice" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08690 冰川幻影（Glacial Phantom）· 敌人 · creatures_in_the_ice
// 卡面：强制 - 当敌军阶段结束时，如果冰川幻影处于重整状态：将其向调查员最多的地点移动一次。
//   按玩家顺序，每位在冰川幻影所在地点或连接地点的调查员，将忒咳哩-哩牌库顶的 1 张卡牌洗入
//   自己的牌库，不要查看内容（每位不能这么做的调查员受到 1 点恐惧）。
// 读点：forced + trigger 'enemyPhaseEnds'（turn.js 敌军阶段结束）；移动走 api.scenario.moveEnemyToward。
export default {
  code: '08690', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌军阶段结束：冰川幻影向调查员最多的地点移动，相邻调查员各洗入 1 张忒咳哩-哩',
    criteria: ({ source }) => source && source.exhausted !== true && !source.defeated,
    resolve: ({ state, source, api }) => {
      const alive = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
      const counts = new Map()
      for (const inv of alive) counts.set(inv.location, (counts.get(inv.location) || 0) + 1)
      let target = null
      for (const [locationId, count] of counts) {
        if (!state.locations.some(loc => loc.id === locationId)) continue
        if (target == null || count > (counts.get(target) || 0)) target = locationId
      }
      if (target && target !== source.location) api.scenario.moveEnemyToward(source, target, { ignoreAloof: true })
      const here = state.locations.find(loc => loc.id === source.location)
      const spots = new Set([source.location, ...(here?.connections || [])])
      const size = Number(api.mechanics.tekeli.size())
      for (const inv of alive) {
        if (!spots.has(inv.location)) continue
        const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, 1) : false
        if (Array.isArray(shuffled) && shuffled.length) continue
        api.info('「冰川幻影」：' + (inv.name || '调查员') + ' 无法洗入忒咳哩-哩，受到 1 点恐惧。')
        api.horror(inv.seat, 1)
      }
    },
  }],
}
====================================================================================================
CODE 08691 | 08691 同源迷雾 / Kindred Mist
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/creatures_in_the_ice/08691.js
--- EN TEXT ---
Revelation - Attach to the nearest location without a copy of Kindred Mist attached.
Forced - When 1 or more cards from the Tekeli-li deck would be shuffled into your deck while you are at attached location: Draw them instead, placing them on the bottom of your deck instead of the bottom of the Tekeli-li deck. Discard Kindred Mist at the end of this round.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "creatures_in_the_ice" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.replacesTekeliShuffleAtLocation  <<UNREAD kind=undefined
  flags.discardAtRoundEnd  read@src/engine/ability.js,src/engine/phases.js,src/engine/stats.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08691 同源迷雾（Kindred Mist）· 诡计 · creatures_in_the_ice
// 卡面：显现 - 附属到最近且没有附属同源迷雾的地点。
// 强制 - 你在附属地点时，在忒咳哩-哩牌库的卡牌将要混洗入你的牌库时：改为抽取那些卡牌，不要
//   将它们放在忒咳哩-哩牌库底，改为放在你的牌库底。当一轮结束时弃掉同源迷雾。
// 读点：显现附走 api.attachToLocation（location-attachments.js 唯一写入口）；
//   洗入替代与轮末强制需要「地点附属强制窗口」这个引擎读点，见
//   artifacts/migration/eote/primitive-requests/p7-08691.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08691'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, replacesTekeliShuffleAtLocation: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「同源迷雾」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('🌫️ 「同源迷雾」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的忒咳哩-哩洗入替代与轮末弃掉需要引擎的地点附属强制读点；本条目只落数据与附属，读点请求见 primitive-requests/p7-08691.json。',
}
====================================================================================================
CODE 08692 | 08692 南极寒风 / Antarctic Wind
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08692.js
--- EN TEXT ---
Revelation - Attach to the nearest location without a copy of Antarctic Wind attached.
Investigators at attached location cannot play cards or draw cards from their deck.
Forced - At the end of the round: Discard Antarctic Wind.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "deadly_weather" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.weather  read@content/campaigns/edgeOfTheEarth/story-text.js,content/campaigns/theInnsmouthConspiracy/story-text.js
  flags.discardAtRoundEnd  read@src/engine/ability.js,src/engine/phases.js,src/engine/stats.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08692 南极寒风（Antarctic Wind） · 诡计 · deadly_weather
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 附属到最近且没有附属本卡的地点。
//   位于附属地点的调查员不能打出卡牌，或从自己的牌库抽取卡牌。强制 - 当一轮结束时：弃掉南极寒风。
// 读点：显现附走 api.attachToLocation；附属地点的持续/强制限制需要「地点附属规则」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08692.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08692'

function nearestLocation(state, fromId) {
  const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
  const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, fromId, loc.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.loc)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, weather: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    let chosen = null
    if (true) {
      const options = nearestLocation(state, inv.location)
      if (!options.length) return false
      chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「南极寒风（Antarctic Wind）」的地点。',
        options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || options[0]
    } else {
      chosen = state.locations.find(loc => loc.id === inv.location)
      if (!chosen) return false
    }
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('「南极寒风（Antarctic Wind）」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的持续限制与轮末弃掉需要引擎的地点附属规则读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08692.json。',
}
====================================================================================================
CODE 08693 | 08693 雪盲危机 / Whiteout
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08693.js
--- EN TEXT ---
Revelation - Attach to your location.
Each investigator at attached location gets -1 [willpower], -1 [intellect], -1 [combat], and -1 [agility].
Forced - At the end of the round: Discard Whiteout.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "deadly_weather" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.weather  read@content/campaigns/edgeOfTheEarth/story-text.js,content/campaigns/theInnsmouthConspiracy/story-text.js
  flags.discardAtRoundEnd  read@src/engine/ability.js,src/engine/phases.js,src/engine/stats.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08693 雪盲危机（Snow Blindness） · 诡计 · deadly_weather
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 附属到你所在地点。
//   位于附属地点的每位调查员得到 -1[willpower]、-1[intellect]、-1[combat]、-1[agility]。强制 - 当一轮结束时：弃掉雪盲危机。
// 读点：显现附走 api.attachToLocation；附属地点的持续/强制限制需要「地点附属规则」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08693.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08693'

function nearestLocation(state, fromId) {
  const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
  const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, fromId, loc.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.loc)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, weather: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    let chosen = null
    if (false) {
      const options = nearestLocation(state, inv.location)
      if (!options.length) return false
      chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「雪盲危机（Snow Blindness）」的地点。',
        options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || options[0]
    } else {
      chosen = state.locations.find(loc => loc.id === inv.location)
      if (!chosen) return false
    }
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('「雪盲危机（Snow Blindness）」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的持续限制与轮末弃掉需要引擎的地点附属规则读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08693.json。',
}
====================================================================================================
CODE 08694 | 08694 极地旋涡 / Polar Vortex
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/deadly_weather/08694.js
--- EN TEXT ---
Revelation - Attach to your location.
Forced - When you end your turn at attached location: Each card you control with health (including your investigator) takes 1 direct damage.
Forced - At the end of the round: Discard Polar Vortex.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "deadly_weather" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.weather  read@content/campaigns/edgeOfTheEarth/story-text.js,content/campaigns/theInnsmouthConspiracy/story-text.js
  flags.discardAtRoundEnd  read@src/engine/ability.js,src/engine/phases.js,src/engine/stats.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08694 极地旋涡（Polar Vortex） · 诡计 · deadly_weather
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：显现 - 附属到你所在地点。
//   强制 - 你在附属地点结束你的回合时：你控制的每张有生命值的卡牌（包括你的调查员）受到 1 点直接伤害。强制 - 当一轮结束时：弃掉极地旋涡。
// 读点：显现附走 api.attachToLocation；附属地点的持续/强制限制需要「地点附属规则」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08694.json（P7 登记，不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08694'

function nearestLocation(state, fromId) {
  const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
  const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, fromId, loc.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.loc)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, weather: true, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    let chosen = null
    if (false) {
      const options = nearestLocation(state, inv.location)
      if (!options.length) return false
      chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「极地旋涡（Polar Vortex）」的地点。',
        options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
      })) || options[0]
    } else {
      chosen = state.locations.find(loc => loc.id === inv.location)
      if (!chosen) return false
    }
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('「极地旋涡（Polar Vortex）」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的持续限制与轮末弃掉需要引擎的地点附属规则读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08694.json。',
}
====================================================================================================
CODE 08695 | 08695 古老者清道夫 / Elder Thing Scavenger
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Elder Thing | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/elder_things/08695.js
--- EN TEXT ---
Hunter.
Forced - After Elder Thing Scavenger attacks you: Discard the top 3 cards of your deck. Draw each weakness discarded this way.

--- NUMS ---
{  "health": 3,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "elder_things" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08695 古老者清道夫（Elder Thing Scavenger）· 敌人 · elder_things
// 卡面：猎手。强制 - 在古老者清道夫攻击你后：弃掉你牌库顶 3 张卡牌。抽取所有以此方式弃掉的弱点。
// 读点：forced + trigger 'enemyAttacked'；弃牌走 api.discardTopOfDeck，弱点经 api.moveCard 放回
//   牌库顶后用 api.drawCards 抽取（走引擎真正的弱点揭示结算）。
import { isWeaknessCode } from '../../../_shared.js'

function discardAndDrawWeaknesses(seat, count, api) {
  const discarded = api.discardTopOfDeck(seat, count) || []
  const weaknesses = discarded.filter(code => isWeaknessCode(code))
  for (const code of weaknesses) api.moveCard({ code, from: 'discard', to: 'deckTop', ownerSeat: seat })
  if (weaknesses.length) api.drawCards(seat, weaknesses.length)
  return discarded
}

export default {
  code: '08695', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyAttacked',
    label: '古老者清道夫攻击后：弃掉牌库顶 3 张并抽取其中的弱点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id
      && Number.isSafeInteger(context?.seat) && context?.attackCancelled !== true,
    resolve: ({ context, api }) => {
      const discarded = discardAndDrawWeaknesses(context.seat, 3, api)
      api.info('「古老者清道夫」：' + (context.seat + 1) + ' 号调查员弃掉牌库顶 ' + discarded.length + ' 张。')
    },
  }],
}
====================================================================================================
CODE 08696 | 08696 古老者守卫 / Guardian Elder Thing
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Elder Thing | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/elder_things/08696.js
--- EN TEXT ---
Hunter.
Forced - When you deal damage to Guardian Elder Thing: For each point of damage dealt, discard the top card of your deck. Draw each weakness discarded this way.

--- NUMS ---
{  "health": 4,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "elder_things" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08696 古老者守卫（Elder Thing Guardian）· 敌人 · elder_things
// 卡面：猎手。强制 - 在你对古老者守卫造成伤害时：每造成 1 点伤害，弃掉你牌库顶的 1 张卡牌。
//   抽取所有以此方式弃掉的弱点。
// 读点：forced + trigger 'enemyDamaged'；弃牌/弱点抽取与 08695 同一口径。
import { isWeaknessCode } from '../../../_shared.js'

export default {
  code: '08696', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyDamaged',
    label: '古老者守卫受到伤害：每 1 点伤害弃掉牌库顶 1 张并抽取其中的弱点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number.isSafeInteger(context?.seat),
    resolve: ({ context, api }) => {
      const count = Math.max(0, Number(context.amount ?? context.damage) || 0)
      if (!count) return
      const discarded = api.discardTopOfDeck(context.seat, count) || []
      const weaknesses = discarded.filter(code => isWeaknessCode(code))
      for (const code of weaknesses) api.moveCard({ code, from: 'discard', to: 'deckTop', ownerSeat: context.seat })
      if (weaknesses.length) api.drawCards(context.seat, weaknesses.length)
      api.info('「古老者守卫」：弃掉牌库顶 ' + count + ' 张（其中 ' + weaknesses.length + ' 张弱点已抽取）。')
    },
  }],
}
====================================================================================================
CODE 08697 | 08697 古老者崛起 / Rise of the Elder Things
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/elder_things/08697.js
--- EN TEXT ---
Revelation - Find the topmost [[Elder Thing]] enemy in the encounter discard pile and spawn it engaged with you. Each [[Elder Thing]] enemy currently engaged with you gets +1 fight and +1 evade until the end of the round. If Rise of the Elder Things put no enemies into play, it gains surge.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "elder_things" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
MARKER:5: //   api.engageAtInvestigator；临时攻击/躲避修正需要引擎的「敌人临时属性修正」读点，见
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08697 古老者崛起（Rise of the Elder Things）· 诡计 · elder_things
// 卡面：显现 - 找出遭遇弃牌堆最顶部的一张[[古老者]]敌人，并将其生成，与你交战。当前与你交战的
//   每个[[古老者]]敌人得到 +1 攻击和 +1 躲避，直到一轮结束。如果古老者崛起没有放置敌人入场，其获得涌动。
// 读点：encounterResolve（entryRevelation 通道）；检索生成走 api.takeEncounterDiscard / api.spawn /
//   api.engageAtInvestigator；临时攻击/躲避修正需要引擎的「敌人临时属性修正」读点，见
//   artifacts/migration/eote/primitive-requests/p7-08697.json。
import { ALL_CARDS } from '../../../_shared.js'

const isElderThing = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'elder thing')

export default {
  code: '08697', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const pool = [...(state.encounterDiscard || [])]
    let code = null
    for (let index = pool.length - 1; index >= 0; index--) {
      if (isElderThing(pool[index])) { code = pool[index]; break }
    }
    if (!code) code = Object.keys(ALL_CARDS).find(candidate => ALL_CARDS[candidate].type === 'enemy'
      && (ALL_CARDS[candidate].encounterCode === 'elder_things') && isElderThing(candidate)) || null
    const taken = code ? api.takeEncounterDiscard(code) : null
    if (!taken) {
      api.info('「古老者崛起」：遭遇弃牌堆没有古老者敌人，获得涌动。')
      return { gainSurge: true }
    }
    const enemy = api.spawn(code, inv.location)
    if (!enemy) {
      api.info('「古老者崛起」：古老者敌人未能生成，获得涌动。')
      return { gainSurge: true }
    }
    api.engageAtInvestigator(enemy, inv.seat)
    api.info('👹 「古老者崛起」：' + (enemy.name || code) + ' 在「' + (state.locations.find(loc => loc.id === inv.location)?.name || inv.location) + '」生成并交战。')
    return true
  },
  note: '「当前与你交战的每个古老者敌人 +1 攻击/+1 躲避直到一轮结束」需要引擎的临时敌人属性修正读点（primitive-requests/p7-08697.json）；生成与交战已接线。',
}
====================================================================================================
CODE 08698 | 08698 冰缝 / Ice Shaft
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/hazards_of_antarctica/08698.js
--- EN TEXT ---
Revelation - Test [agility] (3). For each [frost] token revealed during this test, take 1 damage. If you fail, take 2 damage.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "hazards_of_antarctica" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08698 冰缝（Crevasse）· 诡计 · hazards_of_antarctica
// 卡面：显现 - 检定[agility](3)。本次检定期间每揭示一个[frost]标记，受到 1 点伤害。
//   如果你检定失败，受到 2 点伤害。
// 读点：encounterResolve；result.drawn 是本次检定揭示的标记数组（与 07296 同一契约）。
export default {
  code: '08698', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 3, result => {
      const frosts = (result.drawn || []).filter(token => token === 'frost').length
      if (frosts > 0) api.damage(inv.seat, frosts)
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}
====================================================================================================
CODE 08699 | 08699 穿越冰雪 / Through the Ice
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/hazards_of_antarctica/08699.js
--- EN TEXT ---
Revelation - Attach to the nearest location without a copy of Through the Ice attached.
As an additional cost for you to enter or leave attached location (except by a scenario card effect), test [agility] (2). If you fail, cancel the effects of the move, take 1 damage and 1 horror, and discard Through the Ice.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "hazards_of_antarctica" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.moveEntryTest  <<UNREAD kind=undefined
  flags.agility  read@src/ai/ai-context.js,src/ai/ai-dialogue.js,src/cards/card-catalog.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08699 穿越冰雪（Crossing the Ice）· 诡计 · hazards_of_antarctica
// 卡面：显现 - 附属到最近且没有附属穿越冰雪的地点。作为进入或离开附属地点（除因冒险卡牌效果外）
//   的额外费用，检定[agility](2)。如果你检定失败，取消本次移动的效果，受到 1 点伤害和 1 点恐惧，
//   并弃掉穿越冰雪。
// 读点：显现附走 api.attachToLocation；移动进出检定需要「地点附属移动检定」引擎读点，
//   见 artifacts/migration/eote/primitive-requests/p7-08699.json（不改引擎）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08699'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, moveEntryTest: { skill: 'agility', difficulty: 2, cancelMove: true, damage: 1, horror: 1, discardOnFail: true } },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => !(loc.attachments || []).some(a => (a.originalCode || a.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近且没有附属「穿越冰雪」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('❄️ 「穿越冰雪」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '「进入/离开附属地点的额外敏捷(2)检定」需要引擎的地点附属移动检定读点；条目只落数据与附属，读点请求见 primitive-requests/p7-08699.json。',
}
====================================================================================================
CODE 08700 | 08700 迷失的研究员 / Lost Researcher
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Humanoid,Possessed | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/left_behind/08700.js
--- EN TEXT ---
Spawn - Any location (empty, if able).
Lost Researcher enters play with 1 doom on it.
Forced - When Lost Researcher is defeated: Move each doom on it to its location.
[action]: Parley. Test [willpower] or [intellect] (3). If you succeed, take control of 1 doom on Lost Researcher and flip it to its clue side. Then, if there is no doom on Lost Researcher, discard it.

--- NUMS ---
{  "health": 1,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "left_behind" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08700 迷失的研究员（Lost Researcher）· 敌人 · left_behind
// 卡面：生成 - 任意地点（如可能，则生成在无人地点）。入场时带有 1 个毁灭标记。
//   强制 - 被击败时：将其上的所有毁灭标记移动到其所在地点。
//   [action]：谈判。检定[willpower]或[intellect](3)。成功：控制其上的 1 个毁灭标记并将其翻至
//   线索面。然后，如果其上没有毁灭标记，将其弃掉。
// 读点：谈判行动走 abilities（actionKind:'parley'）；毁灭/线索走 api.scenario.doomOn / api.gainClues；
//   入场毁灭数据放 enemySpawnRule.doomOnSpawn（enemies.js#spawnEnemy 通用读点）。
const CODE = '08700'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '迷失的研究员被击败：将其毁灭标记移到所在地点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, source, context, api }) => {
      const doom = Math.max(0, Number(context.enemy?.doom) || 0)
      if (!doom) return
      const location = state.locations.find(loc => loc.id === context.enemy.location)
      if (location) api.scenario.doomOn(location, doom)
      api.info('「迷失的研究员」：' + doom + ' 个毁灭标记留在其所在地点。')
    },
  }, {
    kind: 'action', actionKind: 'parley', label: '谈判 意志/智力(3)：控制 1 个毁灭标记翻为线索；清空后弃掉本敌人',
    resolve: ({ state, inv, source, api }) => {
      if (!(Number(source.doom) > 0)) return
      const skill = api.choice({ kind: 'skill', source: CODE, seat: inv.seat, prompt: '选择谈判检定技能。',
        options: [{ id: 'willpower', label: '意志(3)' }, { id: 'intellect', label: '智力(3)' }] })
      if (!['willpower', 'intellect'].includes(skill)) return
      api.test(inv.seat, skill, 3, { source: { type: 'enemy', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.removeDoomFromCard(source, 1)
        api.gainClues(inv.seat, 1)
        api.info('🔍 「迷失的研究员」：1 个毁灭标记翻为线索。')
        if (!(Number(source.doom) > 0)) api.discardEnemy?.(source)
      } })
    },
  }],
}
====================================================================================================
CODE 08701 | 08701 狂乱的探险家 / Frenzied Explorer
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Humanoid,Possessed | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/left_behind/08701.js
--- EN TEXT ---
Frenzied Explorer enters play with 1 doom on it.
Forced - When Frenzied Explorer is defeated: Move each doom on it to its location.
[reaction] After you successfully evade Frenzied Explorer by 2 or more: Take control of 1 doom on Frenzied Explorer and flip it to its clue side. Then, if there is no doom on Frenzied Explorer, discard it.

--- NUMS ---
{  "health": 2,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "left_behind" }
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
// 08701 狂乱的探险家（Frenzied Explorer）· 敌人 · left_behind
// 卡面：入场时带有 1 个毁灭标记。强制 - 被击败时：将其上的所有毁灭标记移动到其所在地点。
//   [reaction]在你成功躲避狂乱的探险家、且超过难度至少 2 点后：控制其上的 1 个毁灭标记并翻至线索面；
//   然后，如果其上没有毁灭标记，将其弃掉。
// 读点：入场毁灭放 enemySpawnRule.doomOnSpawn；被躲避后走 evadeSuccess 窗口（combat.js 开窗，context.successBy）。
const CODE = '08701'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'forced', trigger: 'enemyDefeated',
    label: '狂乱的探险家被击败：毁灭标记留在所在地点',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, context, api }) => {
      const doom = Math.max(0, Number(context.enemy?.doom) || 0)
      if (!doom) return
      const location = state.locations.find(loc => loc.id === context.enemy.location)
      if (location) api.scenario.doomOn(location, doom)
      api.info('「狂乱的探险家」：' + doom + ' 个毁灭标记留在其所在地点。')
    },
  }, {
    kind: 'reaction', trigger: 'evadeSuccess',
    label: '成功躲避且超过难度至少 2 点：控制 1 个毁灭标记翻为线索，清空后弃掉本敌人',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id && Number(context?.successBy) >= 2
      && Number(source.doom) > 0,
    resolve: ({ source, context, api }) => {
      api.removeDoomFromCard(source, 1)
      api.gainClues(context.seat, 1)
      api.info('🔍 「狂乱的探险家」：1 个毁灭标记翻为线索。')
      if (!(Number(source.doom) > 0)) api.discardEnemy?.(source)
    },
  }],
}
====================================================================================================
CODE 08702 | 08702 身陷疯狂 / Abandoned to Madness
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/left_behind/08702.js
--- EN TEXT ---
Revelation - Attach to the nearest [[Possessed]] enemy and place 1 doom on that enemy. If there are no [[Possessed]] enemies in play, search the encounter deck and discard pile for a [[Possessed]] enemy, draw it, and attach Abandoned to Madness to it (shuffle the encounter deck).
Increase the difficulty to fight, evade, or parley with attached enemy by 1.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "left_behind" }
--- FLAGS DECLARED ---
  flags.attachToPossessedEnemy  <<UNREAD kind=undefined
  flags.difficultyBonus  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08702 身陷疯狂（Lost in Madness）· 诡计 · left_behind
// 卡面：显现 - 附属到最近的[[附身]]敌人，并在该敌人上放置 1 个毁灭标记。如果场上没有[[附身]]敌人，
//   查找遭遇牌库及弃牌堆，找出并抽取一个[[附身]]敌人，并将身陷疯狂附属到该敌人（混洗遭遇牌库）。
//   与该敌人进行的攻击、躲避或谈判的难度增加 1。
// 读点：附属走 api.attachEncounterToEnemy；毁灭走 api.doomOn；难度 +1 需要引擎的「附属敌人难度修正」
//   读点（primitive-requests/p7-08702.json）。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '08702'
const isPossessed = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'possessed')

function possessedEnemies(state) {
  return (state.enemies || []).filter(enemy => isPossessed(enemy.originalCode || enemy.code) && !enemy.defeated)
}
function takePossessedFromPiles(state, api) {
  for (const pile of ['encounterDeck', 'encounterDiscard']) {
    const list = pile === 'encounterDeck' ? state.encounterDeck : state.encounterDiscard
    if (!Array.isArray(list)) continue
    for (let offset = 1; offset <= list.length; offset++) {
      const code = list[list.length - offset]
      if (!isPossessed(code)) continue
      const taken = pile === 'encounterDeck' ? api.takeEncounterDeckCard(code) : api.takeEncounterDiscard(code)
      if (taken) { api.shuffleEncounterDeck(); return code }
    }
  }
  return null
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { attachToPossessedEnemy: true, difficultyBonus: 1 },
  encounterResolve(state, inv, card, api) {
    const inPlay = possessedEnemies(state)
    let enemy = null
    if (inPlay.length) {
      const nearestDistance = Math.min(...inPlay.map(item => entryDistance(state, inv.location, item.location)))
      const nearest = inPlay.filter(item => entryDistance(state, inv.location, item.location) === nearestDistance)
      enemy = nearest.length === 1 ? nearest[0] : nearest.find(item => item.id === api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择最近的[[附身]]敌人，将「身陷疯狂」附属到它。',
        options: nearest.map(item => ({ id: item.id, label: item.name || item.id })),
      })) || nearest[0]
    } else {
      const code = takePossessedFromPiles(state, api)
      if (code) enemy = api.spawn(code, inv.location)
      if (!enemy) {
        api.info('「身陷疯狂」：遭遇牌库与弃牌堆里没有[[附身]]敌人。')
        return false
      }
    }
    api.attachEncounterToEnemy(CODE, enemy.id)
    api.doomOn(enemy, 1)
    api.info('😵 「身陷疯狂」附属到「' + (enemy.name || enemy.id) + '」并放置 1 个毁灭标记。')
    return true
  },
  note: '「与该敌人进行的攻击、躲避或谈判难度 +1」需要引擎的附属敌人难度修正读点（primitive-requests/p7-08702.json）。',
}
====================================================================================================
CODE 08703 | 08703 渎神幻象 / Blasphemous Visions
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/nameless_horrors/08703.js
--- EN TEXT ---
Revelation - Shuffle the top card of the Tekeli-li deck into your deck without looking at it. Then, put Blasphemous Visions into play in your threat area.
Resolve the effects of each Tekeli-li weakness you draw an additional time.
[action]: Test [willpower] (3). If you succeed, discard Blasphemous Visions.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "nameless_horrors" }
--- FLAGS DECLARED ---
  flags.threat  read@src/ai/ai-context.js,src/cards/campaign-plugin.js,src/cards/card-effects.js
  flags.tekeliliDoubleResolution  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08703 渎神幻象（Blasphemous Visions）· 诡计 · nameless_horrors
// 卡面：显现 - 将忒咳哩-哩牌库顶的 1 张卡牌洗入你的牌库，不要查看内容。然后将渎神幻象放置入场，
//   放到你的威胁区域。你抽取的每张忒咳哩-哩弱点的效果额外结算一次。
//   [action]：检定[willpower](3)。如果你检定成功，弃掉渎神幻象。
// 读点：威胁区放置 api.threat；「弱点效果额外结算一次」需要引擎的弱点重复结算读点
//   （primitive-requests/p7-08703.json）；[action] 走威胁区条目 abilities。
const CODE = '08703'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { threat: true, tekeliliDoubleResolution: true },
  encounterResolve(state, inv, card, api) {
    const size = Number(api.mechanics.tekeli.size())
    const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, 1) : false
    if (!Array.isArray(shuffled) || !shuffled.length) api.info('「渎神幻象」：没有忒咳哩-哩可洗入。')
    api.threat(inv.seat, CODE)
    api.info('🌀 「渎神幻象」进入 ' + (inv.name || '调查员') + ' 的威胁区域。')
    return true
  },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '意志(3)：成功弃掉渎神幻象',
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', 3, { source: { type: 'treachery', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.removeThreat(source)
        api.info('🌀 「渎神幻象」消散了。')
      } })
    },
  }],
  note: '「抽取的每张忒咳哩-哩弱点额外结算一次」需要引擎的弱点重复结算读点（primitive-requests/p7-08703.json）。',
}
====================================================================================================
CODE 08704 | 08704 窥看不可说之事 / Glimpse the Unspeakable
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/nameless_horrors/08704.js
--- EN TEXT ---
Peril.
Revelation - Draw the top card of the Tekeli-li deck (and resolve its effects). Shuffle it into any investigator's deck instead of placing it on the bottom of the Tekeli-li deck. If no Tekeli-li weakness is drawn by this effect, Glimpse the Unspeakable gains surge.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "nameless_horrors" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
  flags.drawTekeliliAndResolveThenShuffle  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08704 窥看不可说之事（Peering Into the Unspeakable）· 诡计 · nameless_horrors
// 卡面：险境。显现 - 抽取忒咳哩-哩牌库顶的 1 张卡牌（并结算其效果）。不要将其放到忒咳哩-哩牌库底，
//   改为混洗入任意一位调查员的牌库。如果没有以此效果抽取忒咳哩-哩弱点，窥看不可说之事获得涌动。
// 读点：tekeliDraw 取牌；去向 tekeliReturn(destination:'anyDeck')。单独结算一张忒咳哩-哩弱点需要
//   引擎的「按卡号结算弱点」读点（primitive-requests/p7-08704.json）；当前实现先完成抽牌与去向。
const CODE = '08704'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true, drawTekeliliAndResolveThenShuffle: true },
  encounterResolve(state, inv, card, api) {
    const code = api.mechanics.tekeli.draw()
    if (!code) {
      api.info('「窥看不可说之事」：忒咳哩-哩牌库为空，获得涌动。')
      return { gainSurge: true }
    }
    const candidates = state.investigators.filter(other => !other.defeated && !other.resigned)
    const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choice({ kind: 'target', source: CODE, seat: inv.seat,
      prompt: '选择把这张忒咳哩-哩弱点洗入哪位调查员的牌库。',
      options: candidates.map(other => ({ id: String(other.seat), label: other.name || '调查员 ' + (other.seat + 1) })) }))
    const target = candidates.find(other => other.seat === seat) || candidates[0]
    api.mechanics.tekeli.return(code, { destination: 'anyDeck', seat: target.seat })
    api.info('👁️ 「窥看不可说之事」：忒咳哩-哩弱点洗入 ' + (target.name || '调查员') + ' 的牌库。')
    return true
  },
  note: '「抽出后立即结算该弱点」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08704.json）；抽牌与去向已接线。',
}
====================================================================================================
CODE 08705 | 08705 噩梦烟气 / Nightmarish Vapors
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/nameless_horrors/08705.js
--- EN TEXT ---
Peril.
Revelation - You must either (choose one):
- Lose 2 actions.
- Shuffle the top 2 cards of the Tekeli-li deck into your deck without looking at them.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "nameless_horrors" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08705 噩梦烟气（Nightmare Smoke）· 诡计 · nameless_horrors
// 卡面：险境。显现 - 你必须选择一项：失去 2 个行动；或将忒咳哩-哩牌库顶的 2 张卡牌洗入你的牌库，
//   不要查看内容。
export default {
  code: '08705', scope: 'treachery', implemented: true,
  flags: { peril: true },
  encounterResolve(state, inv, card, api) {
    const pick = api.choice({ kind: 'effect', source: '08705', seat: inv.seat,
      prompt: '「噩梦烟气」：选择一项。',
      options: [{ id: 'actions', label: '失去 2 个行动' }, { id: 'tekeli', label: '将忒咳哩-哩牌库顶 2 张洗入你的牌库' }] })
    if (pick !== 'tekeli') {
      api.loseActions(inv.seat, 2)
      return false
    }
    const size = Number(api.mechanics.tekeli.size())
    const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, Math.min(2, size)) : false
    api.info('「噩梦烟气」：洗入 ' + (Array.isArray(shuffled) ? shuffled.length : 0) + ' 张忒咳哩-哩。')
    return false
  },
}
====================================================================================================
CODE 08706 | 08706 瘴气折磨 / Miasmatic Torment
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/miasma/08706.js
--- EN TEXT ---
Revelation - If you control a partner asset, exhaust them and attach Miasmatic Torment to them. Otherwise, Miasmatic Torment gains surge.
Attached asset cannot ready.
Forced - At the end of your turn: Attached asset takes 1 damage or 1 horror.
[action]: Test [willpower] or [intellect] (3). If you succeed, discard Miasmatic Torment.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "miasma" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
  flags.attachToPartnerAsset  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08706 瘴气折磨（Miasma 的折磨）· 诡计 · miasma
// 卡面：险境。显现 - 如果你控制伙伴支援，将其横置，并将瘴气折磨附属到该支援。否则获得涌动。
//   被附属的支援不能重整。强制 - 当你的回合结束时：被附属的支援受到 1 点伤害或 1 点恐惧。
//   [action]：检定[willpower]或[intellect](3)。成功则弃掉瘴气折磨。
// 读点：附属走 api.attachCardTo（support 附属）；「不能重整/回合结束伤害」需要引擎的支援附属强制
//   读点（primitive-requests/p7-08706.json）。
const CODE = '08706'

function partnerAssets(state, inv) {
  return (inv.assets || []).filter(asset => (asset.partner === true)
    || (state.cards?.[asset.code]?.flags?.partner === true))
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true, attachToPartnerAsset: true },
  encounterResolve(state, inv, card, api) {
    const partners = partnerAssets(state, inv)
    if (!partners.length) {
      api.info('「瘴气折磨」：你没有控制伙伴支援，获得涌动。')
      return { gainSurge: true }
    }
    const target = partners.length === 1 ? partners[0] : partners.find(asset => asset.id === api.choice({
      kind: 'asset', source: CODE, seat: inv.seat, prompt: '选择要附属「瘴气折磨」的伙伴支援。',
      options: partners.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
    })) || partners[0]
    if (typeof api.exhaust === 'function') api.exhaust(target)
    api.attachToAsset(inv.seat, target.id, CODE)
    api.info('🦠 「瘴气折磨」附属到伙伴支援「' + (target.name || target.code) + '」。')
    return true
  },
  note: '「被附属支援不能重整 / 回合结束受到 1 伤害或恐惧 / 行动摆脱」需要引擎的支援附属强制与行动读点（primitive-requests/p7-08706.json）。',
}
====================================================================================================
CODE 08707 | 08707 朦胧瘴气 / Nebulous Miasma
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Curse,Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/miasma/08707.js
--- EN TEXT ---
Revelation - Attach to your location.
Forced - When you end your turn at attached location: Each card you control with sanity (including your investigator) takes 1 direct horror.
Forced - At the end of the round: Discard Nebulous Miasma.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "miasma" }
--- FLAGS DECLARED ---
  flags.peril  read@src/cards/campaign-plugin.js,src/engine/api-misc.js,src/engine/encounter.js
  flags.locationAttachment  read@src/engine/parley.js
  flags.turnEndDirectHorror  <<UNREAD kind=undefined
  flags.discardAtRoundEnd  read@src/engine/ability.js,src/engine/phases.js,src/engine/stats.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08707 朦胧瘴气（Miasmic Fog）· 诡计 · miasma
// 卡面：险境。显现 - 附属到你所在地点。强制 - 你在附属地点结束你的回合时：你控制的每张有神智值
//   的卡牌（包括你的调查员）受到 1 点直接恐惧。强制 - 当一轮结束时：弃掉朦胧瘴气。
// 读点：显现附走 api.attachToLocation；范围恐惧与轮末弃掉需要「地点附属强制窗口」引擎读点，
//   见 primitive-requests/p7-08707.json。
const CODE = '08707'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true, locationAttachment: true, turnEndDirectHorror: 1, discardAtRoundEnd: true },
  encounterResolve(state, inv, card, api) {
    const location = state.locations.find(loc => loc.id === inv.location)
    if (!location) return false
    api.attachToLocation(location.id, { code: CODE, originalCode: CODE, id: CODE + ':' + location.id })
    api.info('🌫️ 「朦胧瘴气」附属到「' + (location.name || location.id) + '」。')
    return { placed: true }
  },
  note: '附属地点的回合结束直接恐惧与轮末弃掉需要引擎的地点附属强制读点（primitive-requests/p7-08707.json）。',
}
====================================================================================================
CODE 08708 | 08708 巨型白化企鹅 / Giant Albino Penguin
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Creature | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/penguins/08708.js
--- EN TEXT ---
Aloof.
As an additional cost for you to enter or leave this enemy's location, you must spend 1 action.

--- NUMS ---
{  "health": 3,  "damage": 1,  "horror": 1,  "quantity": 2,  "encounterCode": "penguins" }
--- FLAGS DECLARED ---
  flags.moveSurchargeAtEnemyLocation  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08708 巨型白化企鹅（Giant Albino Penguin）· 敌人 · penguins
// 卡面：冷漠。作为进入或离开本敌人所在地点的额外费用，你必须花费 1 个行动。
// 读点：冷漠来自卡面数据（aloof）；「进出所在地点额外 1 行动」需要引擎的地点移动附加费读点
//   （primitive-requests/p7-08708.json）。
export default {
  code: '08708', scope: 'enemy', implemented: true,
  flags: { moveSurchargeAtEnemyLocation: 1 },
  note: '「进入/离开本敌人所在地点额外花费 1 行动」需要引擎的地点移动附加费读点（primitive-requests/p7-08708.json）。',
}
====================================================================================================
CODE 08709 | 08709 呜啊！呜啊！呜啊！ / Wuk! Wuk! Wuk!
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Hazard | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/penguins/08709.js
--- EN TEXT ---
Revelation - Find the Giant Albino Penguin enemy farthest from you. You must either move it to your location or place 1 doom on it. If there are no Giant Albino Penguins in play, search the encounter deck and discard pile for a Giant Albino Penguin, draw it, and shuffle the encounter deck.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "penguins" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08709 呜啊！呜啊！呜啊！（Awk! Awk! Awk!）· 诡计 · penguins
// 卡面：显现 - 找到离你最远的巨型白化企鹅敌人。你必须将其移动到你所在地点，或在其上放置 1 个毁灭标记。
//   如果场上没有巨型白化企鹅敌人，查找遭遇牌库及弃牌堆，找出并抽取一个巨型白化企鹅，并混洗遭遇牌库。
// 读点：距离 entryDistance；移动 api.scenario.moveEnemy；毁灭 api.doomOn；
//   检索生成走 takeEncounterDeckCard/takeEncounterDiscard/spawn/shuffleEncounterDeck。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '08709'
const PENGUIN = '08708'
const isPenguin = code => {
  const card = ALL_CARDS[code]
  return card?.type === 'enemy' && card.encounterCode === 'penguins'
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    let penguins = state.enemies.filter(enemy => isPenguin(enemy.originalCode || enemy.code) && !enemy.defeated)
    if (!penguins.length) {
      let spawned = null
      if ((state.encounterDeck || []).includes(PENGUIN)) {
        const taken = api.takeEncounterDeckCard(PENGUIN)
        if (taken) spawned = api.spawn(PENGUIN, inv.location)
      } else if ((state.encounterDiscard || []).includes(PENGUIN)) {
        const taken = api.takeEncounterDiscard(PENGUIN)
        if (taken) spawned = api.spawn(PENGUIN, inv.location)
      }
      api.shuffleEncounterDeck()
      if (!spawned) {
        api.info('「呜啊！呜啊！呜啊！」：场上与遭遇牌堆都没有巨型白化企鹅。')
        return false
      }
      api.info('🐧 「呜啊！呜啊！呜啊！」：巨型白化企鹅被找出来并生成。')
      return false
    }
    const scored = penguins.map(enemy => ({ enemy, distance: entryDistance(state, inv.location, enemy.location) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const farthest = Math.max(...scored.map(item => item.distance))
    const candidates = scored.filter(item => item.distance === farthest).map(item => item.enemy)
    const enemy = candidates.length === 1 ? candidates[0] : candidates.find(item => item.id === api.choice({
      kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择离你最远的巨型白化企鹅。',
      options: candidates.map(item => ({ id: item.id, label: item.name || item.id })),
    })) || candidates[0]
    const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '「呜啊！呜啊！呜啊！」：移动企鹅到你所在地点，或在其上放 1 个毁灭标记。',
      options: [{ id: 'move', label: '把它移动到你的地点' }, { id: 'doom', label: '在其上放置 1 个毁灭标记' }] })
    if (pick === 'doom') {
      api.doomOn(enemy, 1)
      api.info('🌑 「呜啊！呜啊！呜啊！」：企鹅上放置 1 个毁灭标记。')
    } else {
      api.scenario.moveEnemy(enemy, inv.location, { ignoreAloof: true })
      api.info('🐧 「呜啊！呜啊！呜啊！」：企鹅移动到你的地点。')
    }
    return false
  },
}
====================================================================================================
CODE 08710 | 08710 失落的修格斯 / Forgotten Shoggoth
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Shoggoth | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/shoggoths/08710.js
--- EN TEXT ---
Hunter.
Forced - After Forgotten Shoggoth engages you: Draw the top card of the Tekeli-li deck (if you cannot, Forgotten Shoggoth attacks you).

--- NUMS ---
{  "health": 6,  "damage": 1,  "horror": 2,  "quantity": 2,  "encounterCode": "shoggoths" }
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
// 08710 失落的修格斯（Lost Shoggoth）· 敌人 · shoggoths
// 卡面：猎手。强制 - 失落的修格斯与你交战后：抽取忒咳哩-哩牌库顶的 1 张卡牌（如果你不能这么做，
//   失落的修格斯攻击你）。
// 读点：forced + trigger 'enemyEngaged'（enemies.js#engageEnemy 开窗）；tekeliDraw 取牌。
//   「抽到后按弱点结算」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08710.json）。
export default {
  code: '08710', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged',
    label: '与失落的修格斯交战后：抽取忒咳哩-哩牌库顶 1 张；不能则它攻击你',
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ state, context, api }) => {
      const code = api.mechanics.tekeli.draw()
      if (code) {
        api.info('👁️ 「失落的修格斯」：抽出忒咳哩-哩「' + (api.cardName?.(code) || code) + '」（按弱点结算）。')
        return
      }
      const seat = Number.isSafeInteger(context?.seat) ? context.seat : state.currentSeat
      api.info('「失落的修格斯」：没有忒咳哩-哩可抽，它攻击了你。')
      api.scenario.attack(source, state.investigators[seat])
    },
  }],
  note: '「抽到后立即按弱点结算」需要引擎的按卡号结算弱点读点（primitive-requests/p7-08710.json）。',
}
====================================================================================================
CODE 08711 | 08711 狂暴的修格斯 / Rampaging Shoggoth
- partition: eoteCampaign | type: enemy | status(账本): verified
- pack: eoec | klass: mythos | traits: Monster,Shoggoth,Elite | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/shoggoths/08711.js
--- EN TEXT ---
Hunter. Massive.
Rampaging Shoggoth gets +2 [per_investigator] health.
Forced - At the end of the enemy phase: Deal 2 damage to each investigator and non-[[Shoggoth]] enemy at Rampaging Shoggoth's location. Each of those investigators draws the top card of the Tekeli-li deck.

--- NUMS ---
{  "health": 4,  "damage": 2,  "horror": 1,  "victory": 1,  "quantity": 1,  "encounterCode": "shoggoths" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08711 狂暴的修格斯（Rampaging Shoggoth）· 敌人 · shoggoths
// 卡面：猎手。庞大。狂暴的修格斯得到 +2[per_investigator] 生命值。强制 - 当敌军阶段结束时：
//   对其所在地点的每位调查员和每个非[[修格斯]]敌人造成 2 点伤害。这些调查员各自抽取忒咳哩-哩
//   牌库顶的 1 张卡牌。
// 读点：生命修正走 modifiers 的 enemyHealth（entityModifierTotal 读点）；敌军阶段结束走
//   forced + trigger 'enemyPhaseEnds'；伤害 api.damage / api.scenario.damageEnemy。
export default {
  code: '08711', scope: 'enemy', implemented: true,
  modifiers: [{ target: 'enemyHealth', amount: ({ state }) => 2 * Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1) }],
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌军阶段结束：本地点每位调查员与非修格斯敌人各受 2 伤害，调查员各抽 1 张忒咳哩-哩',
    criteria: ({ source }) => source && !source.defeated,
    resolve: ({ state, source, api }) => {
      if (!state.locations.some(loc => loc.id === source.location)) return
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === source.location)
      for (const other of mates) {
        api.damage(other.seat, 2)
        api.info('💥 「狂暴的修格斯」：' + (other.name || '调查员') + ' 受到 2 点伤害。')
      }
      for (const enemy of [...state.enemies]) {
        if (enemy === source || enemy.defeated || enemy.location !== source.location) continue
        if ((enemy.traits || []).some(trait => String(trait).toLowerCase() === 'shoggoth')) continue
        api.scenario.damageEnemy(enemy.id, 2, null, '08711')
      }
      for (const other of mates) {
        const code = api.mechanics.tekeli.draw()
        if (!code) continue
        api.info('👁️ 「狂暴的修格斯」：' + (other.name || '调查员') + ' 抽出忒咳哩-哩「' + (api.cardName?.(code) || code) + '」。')
      }
    },
  }],
}
====================================================================================================
CODE 08712 | 08712 极地幻景 / Polar Mirage
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/silence_and_mystery/08712.js
--- EN TEXT ---
Revelation - Attach to the nearest location with at least 1 clue, and without a copy of Polar Mirage attached.
Forced - After you discover or take control of 1 or more clues at attached location: Discard each non-weakness card in your hand. Discard Polar Mirage.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "silence_and_mystery" }
--- FLAGS DECLARED ---
  flags.locationAttachment  read@src/engine/parley.js
  flags.clueDiscoveryDiscardNonWeakness  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08712 极地幻景（Polar Mirage）· 诡计 · silence_and_mystery
// 卡面：显现 - 附属到最近的有线索且没有附属极地幻景的地点。强制 - 你发现附属地点的线索，或控制
//   附属地点的线索后：弃掉你手中所有非弱点卡牌。弃掉极地幻景。
// 读点：显现附走 api.attachToLocation；「发现/控制附属地点线索后弃手牌」需要引擎的地点附属强制窗口
//   （primitive-requests/p7-08712.json）。
import { entryDistance } from '../../../_shared.js'

const CODE = '08712'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { locationAttachment: true, clueDiscoveryDiscardNonWeakness: true },
  encounterResolve(state, inv, card, api) {
    const candidates = state.locations.filter(loc => (loc.clues || 0) > 0
      && !(loc.attachments || []).some(attachment => (attachment.originalCode || attachment.code) === CODE))
    const scored = candidates.map(loc => ({ loc, distance: entryDistance(state, inv.location, loc.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const nearest = Math.min(...scored.map(item => item.distance))
    const options = scored.filter(item => item.distance === nearest).map(item => item.loc)
    const chosen = options.length === 1 || typeof api.choice !== 'function' ? options[0] : options.find(loc => loc.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat, prompt: '选择最近的有线索且没有附属「极地幻景」的地点。',
      options: options.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })) || options[0]
    api.attachToLocation(chosen.id, { code: CODE, originalCode: CODE, id: CODE + ':' + chosen.id })
    api.info('🌌 「极地幻景」附属到「' + (chosen.name || chosen.id) + '」。')
    return { placed: true }
  },
  note: '「发现/控制附属地点线索后弃掉手中所有非弱点卡牌并弃掉本卡」需要引擎的地点附属强制读点（primitive-requests/p7-08712.json）。',
}
====================================================================================================
CODE 08713 | 08713 黑暗极光 / Dark Aurora
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: mythos | traits: Terror | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/silence_and_mystery/08713.js
--- EN TEXT ---
Revelation - Test [willpower] (3). For each [frost] token revealed during this test, take 1 horror. If you fail, take 2 horror.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "silence_and_mystery" }
--- FLAGS DECLARED ---
  (no flag declarations)
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08713 黑暗极光（Dark Aurora）· 诡计 · silence_and_mystery
// 卡面：显现 - 检定[willpower](3)。本次检定期间每揭示一个[frost]标记，受到 1 点恐惧。
//   如果你检定失败，受到 2 点恐惧。
// 读点：encounterResolve；result.drawn 是本次检定揭示的标记数组。
export default {
  code: '08713', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      const frosts = (result.drawn || []).filter(token => token === 'frost').length
      if (frosts > 0) api.horror(inv.seat, frosts)
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}
====================================================================================================
CODE 08714 | 08714 威廉·戴尔教授 / Professor William Dyer
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Miskatonic | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08714.js
--- EN TEXT ---
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Professor William Dyer: Heal 2 horror from an investigator or another [[Ally]] asset at your location.

--- NUMS ---
{  "health": 1,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Professor of Geology",  "subnameZh": "地质学教授" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.heal2Horror  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-interactions.browser.mjs","tests/eote-interactions.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08714 威廉·戴尔教授（Professor William Dyer） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：治愈你所在地点的一位调查员或另一个[[盟友]]支援 2 点恐惧。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08714'
const isAlly = card => (ALL_CARDS[card?.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'heal2Horror' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '花费 1 秘密并横置：治愈同地点调查员或另一个盟友支援 2 点恐惧',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      const allies = mates.flatMap(owner => (owner.assets || []).filter(asset => asset !== source && isAlly(asset))
        .map(asset => ({ owner, asset })))
      const options = [
        ...mates.map(other => ({ id: 'inv:' + other.seat, label: (other.name || '调查员') + '（恐惧）' })),
        ...allies.map(item => ({ id: 'asset:' + item.asset.id, label: (ALL_CARDS[item.asset.code]?.nameZh || item.asset.code) + '（恐惧）' })),
      ]
      if (!options.length) return
      const pick = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择治愈 2 点恐惧的目标（同地点调查员或盟友支援）。', options })
      if (String(pick).startsWith('inv:')) return api.healHorror(Number(String(pick).slice(4)), 2)
      const found = allies.find(item => item.asset.id === String(pick).slice(6))
      if (found) api.healAsset(found.asset, { horror: 2, ownerSeat: found.owner.seat })
    },
  }],
}
====================================================================================================
CODE 08715 | 08715 丹佛斯 / Danforth
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Miskatonic | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08715.js
--- EN TEXT ---
Partner. Uses (5 secrets).
[reaction] After an investigator at your location resolves a Tekeli-li weakness, exhaust Danforth and spend 1 secret: That investigator draws 2 cards.

--- NUMS ---
{  "health": 2,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Brilliant Student",  "subnameZh": "杰出学生" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.draw2AfterTekeliliResolved  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08715 丹佛斯（Danforth） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5秘密)。[reaction]你所在地点的调查员结算忒咳哩-哩弱点后，横置丹佛斯并花费 1 秘密：该调查员抽取 2 张卡牌。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

export default {
  code: '08715', scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { reaction: 'draw2AfterTekeliliResolved' } },
  uses: 5, usesType: 'secrets',
  note: '「结算忒咳哩-哩弱点后」需要引擎的弱点结算后窗口（P7 读点请求 primitive-requests/p7-08715.json）；条目先声明伙伴数据与能力条件。',
}
====================================================================================================
CODE 08716 | 08716 伊里亚·阿什瓦克 / Eliyah Ashevak
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js
--- EN TEXT ---
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Eliyah Ashevak: Evade. Attempt to evade with a base [agility] skill of 5. If you succeed, you may move to a connecting location.

--- NUMS ---
{  "health": 3,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Dog Handler",  "subnameZh": "驯犬师" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.evadeBase5ThenMayMove  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08716 伊里亚·阿什瓦克（Eliyah Ashevak） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：躲避。以基础值为 5 的[agility]尝试躲避。成功后可移动到连接地点。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08716'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'evadeBase5ThenMayMove' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'evade', label: '花费 1 秘密并横置：以基础值 5 的敏捷躲避，成功后移动到连接地点',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location)
      if (!enemies.length) {
        api.info('「伊里亚·阿什瓦克」：所在地点没有可躲避的敌人。')
        return
      }
      const target = enemies.length === 1 ? enemies[0] : enemies.find(enemy => enemy.id === api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择要躲避的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
      })) || enemies[0]
      const difficulty = Number(target.evade ?? 0)
      api.test(inv.seat, 'agility', difficulty, {
        baseValue: 5,
        source: { type: 'asset', code: CODE, name: ALL_CARDS[CODE]?.nameZh || CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.autoEvade(target)
              const destinations = (here?.connections || []).filter(id => state.locations.some(loc => loc.id === id))
          if (!destinations.length) return
          const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '躲避成功：是否移动到一个连接地点？',
            options: [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id }))] })
          if (destinations.includes(pick)) api.moveInvestigator(inv.seat, pick)
        },
      })
    },
  }],
}
====================================================================================================
CODE 08717 | 08717 玛拉·辛哈医生 / Dr. Mala Sinha
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08717.js
--- EN TEXT ---
Partner. Uses (3 supplies).
[action] Spend 1 supply and exhaust Dr. Mala Sinha: Heal 2 damage from an investigator or another [[Ally]] asset at your location.

--- NUMS ---
{  "health": 4,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Daring Physician",  "subnameZh": "无畏医师" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.heal2Damage  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08717 玛拉·辛哈医生（Dr. Mala Sinha） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3补给)。[action]花费 1 补给并横置：治愈你所在地点的一位调查员或另一个[[盟友]]支援 2 点伤害。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08717'
const isAlly = card => (ALL_CARDS[card?.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'heal2Damage' } },
  uses: 3, usesType: 'supplies',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '花费 1 补给并横置：治愈同地点调查员或盟友支援 2 点伤害',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      const allies = mates.flatMap(owner => (owner.assets || []).filter(asset => asset !== source && isAlly(asset))
        .map(asset => ({ owner, asset })))
      const options = [
        ...mates.map(other => ({ id: 'inv:' + other.seat, label: (other.name || '调查员') + '（伤害）' })),
        ...allies.map(item => ({ id: 'asset:' + item.asset.id, label: (ALL_CARDS[item.asset.code]?.nameZh || item.asset.code) + '（伤害）' })),
      ]
      if (!options.length) return
      const pick = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择治愈 2 点伤害的目标（同地点调查员或盟友支援）。', options })
      if (String(pick).startsWith('inv:')) return api.healDamage(Number(String(pick).slice(4)), 2)
      const found = allies.find(item => item.asset.id === String(pick).slice(6))
      if (found) api.healAsset(found.asset, { damage: 2, ownerSeat: found.owner.seat })
    },
  }],
}
====================================================================================================
CODE 08718 | 08718 艾弗里·克莱普尔 / Avery Claypool
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08718.js
--- EN TEXT ---
Partner. Uses (5 supplies).
[reaction] When an investigator at your location reveals a [frost] token during a skill test, exhaust Avery Claypool and spend 1 supply: Cancel that token and reveal a new one.

--- NUMS ---
{  "health": 3,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Antarctic Guide",  "subnameZh": "南极向导" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.cancelFrostRevealNewToken  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08718 艾弗里·克莱普尔（Avery Claypool） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5补给)。[reaction]你所在地点的一位调查员在技能检定期间揭示了[frost]标记时，横置并花费 1 补给：取消该标记并揭示一个新的标记。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

const CODE = '08718'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { reaction: 'cancelFrostRevealNewToken' } },
  uses: 5, usesType: 'supplies',
  abilities: [{
    kind: 'reaction', trigger: 'tokenReveal',
    label: '花费 1 补给并横置：取消本次 [frost] 标记，改为揭示一个新标记',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv, context }) => context?.when === 'tokenReveal' && context?.token === 'frost'
      && state.investigators?.[state.skillTest?.seat]?.location === inv.location,
    resolve: ({ context, api }) => {
      const revealed = api.revealChaosTokens(1)[0]
      if (revealed == null) {
        api.info('「艾弗里·克莱普尔」：混乱袋里没有可替代的标记。')
        return
      }
      context.replacementToken = revealed
      api.info('「艾弗里·克莱普尔」：取消 [frost]，改为揭示「' + api.tokenLabel(revealed) + '」。')
    },
  }],
}
====================================================================================================
CODE 08719 | 08719 詹姆斯·“曲奇”·弗雷德里克斯 / James "Cookie" Fredericks
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Veteran,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08719.js
--- EN TEXT ---
Partner. Uses (3 ammo).
[action] Spend 1 ammo and exhaust James "Cookie" Fredericks: Fight. Fight with a base [combat] skill of 5. If you succeed and the attacked enemy is non-[[Elite]], it cannot attack for the remainder of the round.

--- NUMS ---
{  "health": 5,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Dubious Choice",  "subnameZh": "不可靠人选" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.fightBase5NonEliteCannotAttackThisRound  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
MARKER:30: // 「直到本轮结束不能攻击」需要引擎的敌人临时攻击禁用读点（primitive-requests/p7-08719.json）。
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08719 詹姆斯·「曲奇」·弗雷德里克斯（James "Cookie" Fredericks） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3子弹)。[action]花费 1 子弹并横置：攻击。以基础值为 5 的[combat]攻击。成功且敌人非[[精英]]时，直到本轮结束其不能攻击。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08719'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'fightBase5NonEliteCannotAttackThisRound' } },
  uses: 3, usesType: 'ammo',
  abilities: [{
    kind: 'action', actionKind: 'fight', label: '花费 1 子弹并横置：以基础值 5 的战斗攻击；成功且非精英则本轮不能攻击',
    cost: { action: 1, exhaust: true, uses: 1 },
    target: { kind: 'enemy' },
    resolve: ({ state, inv, ctx, api }) => {
      const targetId = ctx?.target?.id ?? ctx?.targetId
      const enemy = state.enemies.find(item => item.id === targetId && !item.defeated)
      if (!enemy) return
      api.test(inv.seat, 'combat', Number(enemy.fight ?? 0), {
        baseValue: 5,
        source: { type: 'asset', code: CODE, name: ALL_CARDS[CODE]?.nameZh || CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.damageEnemy(enemy.id, 1, inv.seat, CODE)
          if (enemy.elite) return
          // 「直到本轮结束不能攻击」需要引擎的敌人临时攻击禁用读点（primitive-requests/p7-08719.json）。
          api.info('「曲奇」：' + (enemy.name || enemy.id) + ' 本轮无法攻击（数据已声明，读点待接）。')
        },
      })
    },
  }],
}
====================================================================================================
CODE 08720 | 08720 艾米·肯斯勒博士 / Dr. Amy Kensler
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Miskatonic | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08720.js
--- EN TEXT ---
Partner. Uses (3 secrets).
[action] Spend 1 secret and exhaust Dr. Amy Kensler: Investigate. Investigate with a base [intellect] skill of 5. If you succeed, look at the top card of any investigator's deck or the encounter deck. You may discard that card.

--- NUMS ---
{  "health": 2,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Professor of Biology",  "subnameZh": "生物学教授" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.investigateBase5LookTopCard  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08720 艾米·肯斯勒博士（Dr. Amy Kensler） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：调查。以基础值为 5 的[intellect]调查。成功后可查看任意调查员牌库顶或遭遇牌库顶 1 张，并可弃掉它。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08720'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'investigateBase5LookTopCard' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'investigate', label: '花费 1 秘密并横置：以基础值 5 的智力调查；成功后看 1 张顶牌并可弃掉',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const location = state.locations.find(loc => loc.id === inv.location)
      if (!location || (location.clues || 0) <= 0) {
        api.info('「艾米·肯斯勒博士」：所在地点没有线索可发现。')
        return
      }
      api.test(inv.seat, 'intellect', Number(location.shroud ?? 0), {
        baseValue: 5,
        source: { type: 'asset', code: CODE, name: ALL_CARDS[CODE]?.nameZh || CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.discoverClue(inv.seat, 1, location.id)
          const choice = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '查看哪位调查员的牌库顶，或遭遇牌库顶？',
            options: [
              ...state.investigators.filter(other => (other.deck || []).length).map(other => ({ id: 'deck:' + other.seat, label: (other.name || '调查员') + ' 的牌库顶' })),
              ...((state.encounterDeck || []).length ? [{ id: 'encounter', label: '遭遇牌库顶' }] : []),
            ] })
          if (choice === 'encounter') {
            const top = api.scenario.lookEncounterTop(inv.seat, 1)
            const code = top?.[0]
            if (!code) return
            if (api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '是否弃掉「' + (ALL_CARDS[code]?.nameZh || code) + '」？',
              options: [{ id: 'keep', label: '保留' }, { id: 'discard', label: '弃掉' }] }) === 'discard') {
              api.scenario.discardEncounterCard(code)
            }
            return
          }
          if (String(choice).startsWith('deck:')) {
            const seat = Number(String(choice).slice(5))
            const top = state.investigators[seat]?.deck?.at(-1)
            if (!top) return
            api.lookAt(inv.seat, { zone: 'deck', count: 1, targetSeat: seat })
            if (api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '是否弃掉「' + (ALL_CARDS[top]?.nameZh || top) + '」？',
              options: [{ id: 'keep', label: '保留' }, { id: 'discard', label: '弃掉' }] }) === 'discard') {
              api.moveCard({ code: top, from: 'deck', to: 'discard', ownerSeat: seat })
            }
          }
        },
      })
    },
  }],
}
====================================================================================================
CODE 08721 | 08721 罗尔德·埃尔斯沃思 / Roald Ellsworth
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Miskatonic,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08721.js
--- EN TEXT ---
Partner. Uses (5 supplies).
[fast] During an investigator's turn, exhaust Roald Ellsworth and spend 1 supply: Choose a treachery attached to any location. Treat that treachery's text box as if it were blank until the end of this turn.

--- NUMS ---
{  "health": 4,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Intrepid Explorer",  "subnameZh": "英勇的探险家" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.blankNonWeaknessTreacheryText  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08721 罗尔德·埃尔斯沃思（Roald Ellsworth） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5补给)。[free]任意调查员回合期间，横置并花费 1 补给：选择一张附属到任意地点的诡计，其印刷文本框视为空白直到本回合结束。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

export default {
  code: '08721', scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { free: 'blankNonWeaknessTreacheryText' } },
  uses: 5, usesType: 'supplies',
  note: '「把地点附属诡计的印刷文本框视为空白直到本回合结束」需要引擎的临时文本空白读点（P7 读点请求 primitive-requests/p7-08721.json）；条目先声明伙伴数据与能力条件。',
  abilities: [],
}
====================================================================================================
CODE 08722 | 08722 高田弘子 / Takada Hiroko
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Wayfarer | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08722.js
--- EN TEXT ---
Partner. Uses (9 resources).
[action] Exhaust Takada Hiroko: Move up to 3 resources from Takada Hiroko to your resource pool.

--- NUMS ---
{  "health": 3,  "quantity": 1,  "encounterCode": "expedition_team",  "subname": "Aeroplane Mechanic",  "subnameZh": "飞机技师" }
--- FLAGS DECLARED ---
  flags.partner  read@src/campaign/eote-memorials.js,src/engine/bonded-location.js,src/engine/eote-interactions.js
  flags.partnerRules  <<UNREAD kind=undefined
  flags.gain1ResourceMoveUpTo3  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-campaign-flow.test.mjs","tests/eote-interaction-fixture.mjs","tests/eote-scenario-iceAndDeathPart2.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08722 高田弘子（Takada Hiroko） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(9资源)。[action]横置：将高田弘子上的最多 3 资源移动到你的资源池。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

const CODE = '08722'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'gain1ResourceMoveUpTo3' } },
  uses: 9, usesType: 'resources',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '横置：将高田弘子上的最多 3 资源移动到你的资源池',
    cost: { action: 1, exhaust: true },
    resolve: ({ inv, source, api }) => {
      const available = Math.min(3, Math.max(0, Number(source?.uses) || 0))
      if (available <= 0) return
      const amount = available === 1 ? 1 : Number(api.choice({ kind: 'number', source: CODE, seat: inv.seat,
        prompt: '把多少资源移动到你的资源池？（最多 3）',
        options: Array.from({ length: available }, (_, index) => ({ id: String(index + 1), label: '移动 ' + (index + 1) + ' 资源' })) }))
      const n = Number.isSafeInteger(amount) && amount > 0 && amount <= available ? amount : available
      api.spendUses(source, n)
      api.gainResources(inv.seat, n)
    },
  }],
}
====================================================================================================
CODE 08723 | 08723 忒咳哩-哩 / Tekeli-li
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: neutral | traits: Madness | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08723.js
--- EN TEXT ---
Revelation - Take 1 horror. Place Tekeli-li on the bottom of the Tekeli-li deck.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "tekelili" }
--- FLAGS DECLARED ---
  flags.tekelili  read@content/campaigns/edgeOfTheEarth/keywords.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js
  flags.returnToTekeliliDeckBottom  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs","tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08723 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 受到 1 点恐惧。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08723', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08723）',
    resolve: ({ state, inv, api }) => {
      api.horror(inv.seat, 1)
      api.mechanics.tekeli.return('08723', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08723」回到忒咳哩-哩牌库底。')
    },
  }],
}
====================================================================================================
CODE 08724 | 08724 忒咳哩-哩 / Tekeli-li
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: neutral | traits: Madness | xp: null | quantity: 3
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08724.js
--- EN TEXT ---
Revelation - Take 1 damage. Place Tekeli-li on the bottom of the Tekeli-li deck.

--- NUMS ---
{  "quantity": 3,  "encounterCode": "tekelili" }
--- FLAGS DECLARED ---
  flags.tekelili  read@content/campaigns/edgeOfTheEarth/keywords.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js
  flags.returnToTekeliliDeckBottom  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs","tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08724 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 受到 1 点伤害。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08724', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08724）',
    resolve: ({ state, inv, api }) => {
      api.damage(inv.seat, 1)
      api.mechanics.tekeli.return('08724', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08724」回到忒咳哩-哩牌库底。')
    },
  }],
}
====================================================================================================
CODE 08725 | 08725 忒咳哩-哩 / Tekeli-li
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: neutral | traits: Madness | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08725.js
--- EN TEXT ---
Revelation - Discard 1 card at random from your hand. Place Tekeli-li on the bottom of the Tekeli-li deck.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "tekelili" }
--- FLAGS DECLARED ---
  flags.tekelili  read@content/campaigns/edgeOfTheEarth/keywords.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js
  flags.returnToTekeliliDeckBottom  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08725 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 随机弃掉 1 张手牌。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08725', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08725）',
    resolve: ({ state, inv, api }) => {
      api.discardRandomFromHand(inv.seat, 1)
      api.mechanics.tekeli.return('08725', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08725」回到忒咳哩-哩牌库底。')
    },
  }],
}
====================================================================================================
CODE 08726 | 08726 忒咳哩-哩 / Tekeli-li
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: neutral | traits: Madness | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08726.js
--- EN TEXT ---
Revelation - Lose 2 resources. Place Tekeli-li on the bottom of the Tekeli-li deck.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "tekelili" }
--- FLAGS DECLARED ---
  flags.tekelili  read@content/campaigns/edgeOfTheEarth/keywords.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js
  flags.returnToTekeliliDeckBottom  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08726 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 失去 2 资源。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08726', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08726）',
    resolve: ({ state, inv, api }) => {
      api.loseResources(inv.seat, 2)
      api.mechanics.tekeli.return('08726', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08726」回到忒咳哩-哩牌库底。')
    },
  }],
}
====================================================================================================
CODE 08727 | 08727 忒咳哩-哩 / Tekeli-li
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: neutral | traits: Madness | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08727.js
--- EN TEXT ---
Revelation - If it is your turn, lose 1 action. Otherwise, lose 1 action during your next turn. Place Tekeli-li on the bottom of the Tekeli-li deck.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "tekelili" }
--- FLAGS DECLARED ---
  flags.tekelili  read@content/campaigns/edgeOfTheEarth/keywords.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js
  flags.returnToTekeliliDeckBottom  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08727 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 如果现在是你的回合，失去 1 个行动；否则你的下一个回合期间失去 1 个行动。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08727', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08727）',
    resolve: ({ state, inv, api }) => {
      if (state.currentSeat === inv.seat) api.loseActions(inv.seat, 1)
      else api.info('「忒咳哩-哩」：你的下一个回合期间失去 1 个行动（读点待接）。')
      api.mechanics.tekeli.return('08727', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08727」回到忒咳哩-哩牌库底。')
    },
  }],
}
====================================================================================================
CODE 08728 | 08728 忒咳哩-哩 / Tekeli-li
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: neutral | traits: Madness | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08728.js
--- EN TEXT ---
Revelation - Place 1 of your clues on your location. Place Tekeli-li on the bottom of the Tekeli-li deck.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "tekelili" }
--- FLAGS DECLARED ---
  flags.tekelili  read@content/campaigns/edgeOfTheEarth/keywords.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js
  flags.returnToTekeliliDeckBottom  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08728 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 将你的 1 个线索放到你所在地点。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08728', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08728）',
    resolve: ({ state, inv, api }) => {
      api.returnClueToLocation(inv.seat, 1)
      api.mechanics.tekeli.return('08728', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08728」回到忒咳哩-哩牌库底。')
    },
  }],
}
====================================================================================================
CODE 08729 | 08729 忒咳哩-哩 / Tekeli-li
- partition: eoteCampaign | type: treachery | status(账本): verified
- pack: eoec | klass: neutral | traits: Madness | xp: null | quantity: 2
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/tekelili/08729.js
--- EN TEXT ---
Revelation - Discard an asset you control. Place Tekeli-li on the bottom of the Tekeli-li deck.

--- NUMS ---
{  "quantity": 2,  "encounterCode": "tekelili" }
--- FLAGS DECLARED ---
  flags.tekelili  read@content/campaigns/edgeOfTheEarth/keywords.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js,content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js
  flags.returnToTekeliliDeckBottom  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-interaction-fixture.mjs","tests/eote-interactions.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08729 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 弃掉你控制的一张支援。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08729', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08729）',
    resolve: ({ state, inv, api }) => {
      const assets = (inv.assets || [])
      if (assets.length) {
        const pick = assets.length === 1 ? assets[0] : assets.find(card => card.id === api.choice({ kind: 'asset', source: '08729', seat: inv.seat, prompt: '弃掉你控制的一张支援。', options: assets.map(card => ({ id: card.id, label: card.name || card.code })) })) || assets[0]
        api.discardAsset(inv.seat, pick)
      }
      api.mechanics.tekeli.return('08729', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08729」回到忒咳哩-哩牌库底。')
    },
  }],
}
====================================================================================================
CODE 08730 | 08730 克莱普尔的皮草 / Claypool's Furs
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Item,Clothing | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08730.js
--- EN TEXT ---
Fast.
[reaction] When you reveal a [frost] token during a skill test you are performing, deal 1 damage to Claypool's Furs: Cancel that chaos token and return it to the bag. Reveal a new chaos token.

--- NUMS ---
{  "cost": 2,  "health": 3,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
  flags.health  read@src/ai/ai-context.js,src/ai/ai-participation.js,src/campaign/campaign-effects.js
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08730 克莱普尔的皮草（Claypool 的皮草）· 剧情资产 · memorials_of_the_lost
// 卡面：快速。[reaction]你执行的技能检定期间，在你揭示一个[frost]标记时，对克莱普尔的皮草造成
//   1 点伤害：取消该混乱标记并将其放回混乱袋，揭示一个新的混乱标记。
// 读点：tokenReveal 反应窗口 + api.placeAssetHarm（伤害必须坐落在该支援上）；替代标记走
//   context.replacementToken（与 08112 同一条引擎通道）。
const CODE = '08730'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  fast: true,
  flags: { memorial: true, health: 3 },
  abilities: [{
    kind: 'reaction', trigger: 'tokenReveal',
    label: '皮草：受伤 1 点，取消本次 [frost] 并改揭新标记',
    criteria: ({ state, inv, source, context }) => context?.when === 'tokenReveal' && context?.token === 'frost'
      && state.skillTest?.seat === inv.seat
      && (inv.assets || []).some(asset => asset === source || asset.id === source.id),
    resolve: ({ source, context, api }) => {
      api.placeAssetHarm(source, { damage: 1 })
      const revealed = api.revealChaosTokens(1)[0]
      if (revealed == null) {
        api.info('「克莱普尔的皮草」：混乱袋里没有可替代的标记。')
        return
      }
      context.replacementToken = revealed
      api.info('🧥 「克莱普尔的皮草」：取消 [frost]，改为揭示「' + api.tokenLabel(revealed) + '」。')
    },
  }],
}
====================================================================================================
CODE 08731 | 08731 爱伦·坡作品集 / Collected Works of Poe
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Item,Tome | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08731.js
--- EN TEXT ---
Uses (3 charges).
[action] Spend 1 charge: Choose an investigator at your location to search the top 6 cards of their deck for each copy of Tekeli-li and place each of them on the bottom of the Tekeli-li deck. Shuffle that investigator's deck. That investigator draws 1 card.

--- NUMS ---
{  "cost": 1,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08731 爱伦·坡作品集（Poe Collection）· 剧情资产 · memorials_of_the_lost
// 卡面：使用(3充能)。[action]花费 1 充能：选择你所在地点的一位调查员，其查找自己牌库顶的 6 张卡牌，
//   找出其中所有忒咳哩-哩，并将这些卡牌都放在忒咳哩-哩牌库底。混洗该调查员的牌库。该调查员抽取 1 张卡牌。
// 读点：「查找牌库顶并只把忒咳哩-哩放回剧本牌库底」需要一个「查找顶牌→剧本牌库底」读点
//   （primitive-requests/p7-08731.json）；条目先落数据与次数。
export default {
  code: '08731', scope: 'storyAsset', implemented: true,
  uses: 3, usesType: 'charges',
  flags: { memorial: true },
  note: '「查找牌库顶 6 张，把忒咳哩-哩放回忒咳哩-哩牌库底，洗牌后抽 1」需要引擎的查找顶牌→剧本牌库底读点（primitive-requests/p7-08731.json）。',
}
====================================================================================================
CODE 08732 | 08732 曲奇的特制.32手枪 / Cookie's Custom .32
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Item,Weapon,Firearm | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08732.js
--- EN TEXT ---
Fast. Uses (2 ammo).
[action] Spend 1 ammo: Fight. Either fight with a base [combat] skill of 5, or get +2 [combat] for this attack. This attack deals +1 damage.

--- NUMS ---
{  "cost": 2,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08732 曲奇的特制 .32 手枪（Cookie 的特制手枪）· 剧情资产 · memorials_of_the_lost
// 卡面：快速。使用(2子弹)。[action]花费 1 子弹：攻击。以基础值为 5 的[combat]攻击，或者本次攻击
//   得到 +2[combat]。本次攻击造成 +1 伤害。
// 读点：api.test 的 baseValue/难度；目标走 target.kind enemy；伤害走 api.damageEnemy。
const CODE = '08732'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  fast: true, uses: 2, usesType: 'ammo',
  flags: { memorial: true },
  abilities: [{
    kind: 'action', actionKind: 'fight', label: '花费 1 子弹：基础值 5 的战斗攻击，或 +2 战斗；+1 伤害',
    cost: { action: 1, uses: 1 },
    target: { kind: 'enemy' },
    resolve: ({ state, inv, ctx, api }) => {
      const targetId = ctx?.target?.id ?? ctx?.targetId
      const enemy = state.enemies.find(item => item.id === targetId && !item.defeated)
      if (!enemy) return
      const mode = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择攻击方式。',
        options: [{ id: 'base5', label: '以基础值 5 的战斗攻击' }, { id: 'bonus', label: '本次攻击 +2 战斗' }] })
      const choose = mode === 'base5' ? { baseValue: 5 } : { skillBonus: 2 }
      api.test(inv.seat, 'combat', Number(enemy.fight ?? 0), { ...choose,
        source: { type: 'asset', code: CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.damageEnemy(enemy.id, 2, inv.seat, CODE)
        } })
    },
  }],
}
====================================================================================================
CODE 08733 | 08733 戴尔的素描 / Dyer's Sketches
- partition: eoteCampaign | type: event | status(账本): verified
- pack: eoec | klass: neutral | traits: Insight | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08733.js
--- EN TEXT ---
Fast. Play during any [fast] window.
Draw 3 cards.

--- NUMS ---
{  "cost": 2,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
  flags.eventCard  <<UNREAD kind=undefined
  flags.effect  read@src/ai/ai-context.js,src/campaign/campaign-effects.js,src/campaign/campaign-flow.js
  flags.draw3AnyFreeWindow  <<UNREAD kind=rule-value
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08733 戴尔的素描（Dyer 的素描）· 事件 · memorials_of_the_lost
// 卡面：快速。可在任何[free]时间段期间打出。抽取 3 张卡牌。
// 归属说明：事件卡加入调查员牌组后需要玩家侧生命周期条目（src/cards/entries/08733.js 的
//   played 描述子）；本战役共享目录只登记卡面身份与行为数据，避免把 lifecycle kind 写进非玩家 scope。
export default {
  code: '08733', scope: 'storyAsset', implemented: true,
  flags: { memorial: true, eventCard: true, effect: 'draw3AnyFreeWindow' },
  note: '事件卡的 played 生命周期条目由玩家卡批次落在 src/cards/entries/08733.js（P7 写权限外的偏差，见报告）。',
}
====================================================================================================
CODE 08734 | 08734 埃尔斯沃思的靴子 / Ellsworth's Boots
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Item,Clothing,Footwear | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08734.js
--- EN TEXT ---
Limit 1 [[Footwear]] per investigator.
[reaction] After the last clue is discovered from your location, exhaust Ellsworth's Boots: Move to a connecting location, or discard Ellsworth's Boots to move to any revealed location.

--- NUMS ---
{  "cost": 2,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
  flags.footwear  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08734 埃尔斯沃思的靴子（Ellsworth 的靴子）· 剧情资产 · memorials_of_the_lost
// 卡面：每位调查员仅限 1 张[[鞋子]]。[reaction]你所在地点的最后一个线索被发现后，横置：移动到
//   一个连接地点；或弃掉埃尔斯沃思的靴子来移动到任意一个已揭示地点。
// 读点：clueDiscovered 窗口 + api.moveInvestigator；弃掉自己走 api.discardAsset。
const CODE = '08734'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { memorial: true, footwear: true },
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered',
    label: '本地最后一个线索被发现后：横置移动，或弃掉靴子移动到任意已揭示地点',
    criteria: ({ state, inv, source, context }) => context?.lastClue === true && inv?.location === context?.location,
    resolve: ({ state, inv, source, api }) => {
      const here = state.locations.find(loc => loc.id === inv.location)
      const destinations = (here?.connections || []).filter(id => state.locations.some(loc => loc.id === id))
      const options = [
        ...destinations.map(id => ({ id: 'move:' + id, label: '移动到「' + (state.locations.find(loc => loc.id === id)?.name || id) + '」' })),
        ...state.locations.filter(loc => loc.id !== inv.location && loc.revealed).map(loc => ({ id: 'discard:' + loc.id, label: '弃掉靴子，移动到「' + (loc.name || loc.id) + '」' })),
        { id: 'skip', label: '不移动' },
      ]
      const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '埃尔斯沃思的靴子：选择去向。', options })
      if (String(pick).startsWith('move:')) api.moveInvestigator(inv.seat, String(pick).slice(5))
      else if (String(pick).startsWith('discard:')) {
        api.discardAsset(inv.seat, source)
        api.moveInvestigator(inv.seat, String(pick).slice(8))
      }
      api.exhaust(source)
    },
  }],
}
====================================================================================================
CODE 08735 | 08735 肯斯勒的日志 / Kensler's Log
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Item,Tome | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08735.js
--- EN TEXT ---
Fast. Uses (2 secrets).
[action] Spend 1 secret: Investigate. Either investigate with a base [intellect] skill of 5, or get +2 [intellect] for this investigation. If you succeed, you discover 1 additional clue at your location.

--- NUMS ---
{  "cost": 2,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08735 肯斯勒的日志（Kensler 的日志）· 剧情资产 · memorials_of_the_lost
// 卡面：快速。使用(2秘密)。[action]花费 1 秘密：调查。以基础值为 5 的[intellect]调查，或本次调查
//   得到 +2[intellect]。如果你检定成功，发现你所在地点额外 1 个线索。
// 读点：api.test 的 baseValue/skillBonus；线索走 api.discoverClue（调查 1 + 额外 1）。
const CODE = '08735'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  fast: true, uses: 2, usesType: 'secrets',
  flags: { memorial: true },
  abilities: [{
    kind: 'action', actionKind: 'investigate', label: '花费 1 秘密：基础值 5 的调查，或 +2 智力；成功额外发现 1 线索',
    cost: { action: 1, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const location = state.locations.find(loc => loc.id === inv.location)
      if (!location || (location.clues || 0) <= 0) {
        api.info('「肯斯勒的日志」：所在地点没有线索。')
        return
      }
      const mode = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择调查方式。',
        options: [{ id: 'base5', label: '以基础值 5 的智力调查' }, { id: 'bonus', label: '本次调查 +2 智力' }] })
      const choose = mode === 'base5' ? { baseValue: 5 } : { skillBonus: 2 }
      api.test(inv.seat, 'intellect', Number(location.shroud ?? 0), { ...choose,
        source: { type: 'asset', code: CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.discoverClue(inv.seat, 1, location.id)
          api.discoverClue(inv.seat, 1, location.id)
        } })
    },
  }],
}
====================================================================================================
CODE 08736 | 08736 辛哈的医药箱 / Sinha's Medical Kit
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Item,Science | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08736.js
--- EN TEXT ---
Uses (3 supplies).
[fast] Exhaust Sinha's Medical Kit and spend 1 supply: Heal 1 damage or 1 horror from an investigator or [[Ally]] asset at your location.

--- NUMS ---
{  "cost": 1,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08736 辛哈的医药箱（Sinha 的医药箱）· 剧情资产 · memorials_of_the_lost
// 卡面：使用(3补给)。[free]横置并花费 1 补给：治愈你所在地点的一位调查员或一个[[盟友]]支援
//   1 点伤害或 1 点恐惧。
// 读点：api.healDamage / api.healHorror / api.healAsset（伤害或恐惧二选一）。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08736'
const isAlly = card => (ALL_CARDS[card?.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  uses: 3, usesType: 'supplies',
  flags: { memorial: true },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置并花费 1 补给：治愈同地点调查员/盟友 1 伤害或 1 恐惧',
    cost: { exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      const allies = mates.flatMap(owner => (owner.assets || []).filter(asset => asset !== source && isAlly(asset))
        .map(asset => ({ owner, asset })))
      const targets = [
        ...mates.map(other => ({ id: 'inv:' + other.seat, ownerSeat: other.seat, label: other.name || '调查员' })),
        ...allies.map(item => ({ id: 'asset:' + item.asset.id, ownerSeat: item.owner.seat, card: item.asset, label: ALL_CARDS[item.asset.code]?.nameZh || item.asset.code })),
      ]
      if (!targets.length) return
      const target = targets.length === 1 ? targets[0] : targets.find(item => item.id === api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择治愈目标。', options: targets.map(item => ({ id: item.id, label: item.label })),
      })) || targets[0]
      const kind = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '治愈 1 点伤害，还是 1 点恐惧？',
        options: [{ id: 'damage', label: '1 点伤害' }, { id: 'horror', label: '1 点恐惧' }] })
      if (target.card) api.healAsset(target.card, kind === 'damage' ? { damage: 1, ownerSeat: target.ownerSeat } : { horror: 1, ownerSeat: target.ownerSeat })
      else if (kind === 'damage') api.healDamage(target.ownerSeat, 1)
      else api.healHorror(target.ownerSeat, 1)
    },
  }],
}
====================================================================================================
CODE 08737 | 08737 高田的物品 / Takada's Cache
- partition: eoteCampaign | type: event | status(账本): verified
- pack: eoec | klass: neutral | traits: Supply | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08737.js
--- EN TEXT ---
Fast. Play during any [fast] window.
Gain 3 resources and draw 1 card. Remove Takada's Cache from the game.

--- NUMS ---
{  "cost": 0,  "quantity": 1,  "encounterCode": "memorials_of_the_lost" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
  flags.eventCard  <<UNREAD kind=undefined
  flags.effect  read@src/ai/ai-context.js,src/campaign/campaign-effects.js,src/campaign/campaign-flow.js
  flags.gain3ResourcesDraw1RemoveFromGame  <<UNREAD kind=rule-value
--- TEST COVERAGE: none ---
  (no strong titles) file-only=[]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08737 高田的物品（Takada 的物品）· 事件 · memorials_of_the_lost
// 卡面：快速。可在任何[free]时间段期间打出。获得 3 资源并抽取 1 张卡牌。将高田的物品从游戏中移除。
// 归属说明：事件卡加入调查员牌组后需要玩家侧生命周期条目（src/cards/entries/08737.js 的 played
//   描述子）；本战役共享目录只登记卡面身份与行为数据。
export default {
  code: '08737', scope: 'storyAsset', implemented: true,
  flags: { memorial: true, eventCard: true, effect: 'gain3ResourcesDraw1RemoveFromGame' },
  note: '事件卡的 played 生命周期条目由玩家卡批次落在 src/cards/entries/08737.js（P7 写权限外的偏差，见报告）。',
}
====================================================================================================
CODE 08738 | 08738 安雨 / Anyu
- partition: eoteCampaign | type: asset | status(账本): verified
- pack: eoec | klass: neutral | traits: Ally,Creature | xp: null | quantity: 1
- 归属: shared:_shared
- 条目文件: src/cards/encounter-entries/edgeOfTheEarth/_shared/memorials_of_the_lost/08738.js
--- EN TEXT ---
[fast] Exhaust Anyu: Choose one, or discard Anyu to choose up to three, in any order -
 - Move to a connecting location.
 - You get +2 skill value for your next skill test this round.
 - Evade. Attempt to evade with a base [agility] skill of 4.

--- NUMS ---
{  "cost": 3,  "health": 2,  "quantity": 1,  "encounterCode": "memorials_of_the_lost",  "subname": "Faithful Companion",  "subnameZh": "忠诚伴侣" }
--- FLAGS DECLARED ---
  flags.memorial  <<UNREAD kind=undefined
  flags.ally  read@src/cards/campaign-plugin.js,src/engine/ability-exec.js,src/engine/actions-extra.js
  flags.health  read@src/ai/ai-context.js,src/ai/ai-participation.js,src/campaign/campaign-effects.js
--- TEST COVERAGE: file-only ---
  (no strong titles) file-only=["tests/eote-scenario-shared.test.mjs"]
--- KNOWN DEVIATIONS ---
  (none)
--- KEYWORD-COVERAGE ---
  (not flagged)
--- PERCEIVABILITY ---
  (not flagged)
--- ENTRY SRC ---
// 08738 安雨（An Yu）· 剧情资产（盟友）· memorials_of_the_lost
// 卡面：[free]横置安雨：选择一项；或弃掉安雨来选择最多三项（以任意顺序）——
//   · 移动到一个连接地点；· 你本轮下一次技能检定 +2；· 躲避。以基础值 4 的[agility]躲避。
// 读点：方案选择走 api.choice；移动 api.moveInvestigator；技能加成 api.phaseTestBonus；
//   躲避 api.test(baseValue:4) + api.autoEvade；弃掉自己 api.discardAsset。
const CODE = '08738'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { memorial: true, ally: true, health: 2 },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置安雨：移动 / 本轮下次检定 +2 / 基础值 4 的敏捷躲避',
    cost: { exhaust: true },
    resolve: ({ state, inv, source, api }) => {
      const options = [
        { id: 'move', label: '移动到一个连接地点' },
        { id: 'bonus', label: '本轮下一次技能检定 +2' },
        { id: 'evade', label: '以基础值 4 的敏捷躲避' },
      ]
      const mode = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择安雨提供的一项。', options })
      if (mode === 'move') {
        const here = state.locations.find(loc => loc.id === inv.location)
        const destinations = (here?.connections || []).filter(id => state.locations.some(loc => loc.id === id))
        if (!destinations.length) return
        const pick = destinations.length === 1 ? destinations[0] : api.choice({ kind: 'location', source: CODE, seat: inv.seat,
          prompt: '选择移动到的连接地点。', options: destinations.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id })) })
        if (destinations.includes(pick)) api.moveInvestigator(inv.seat, pick)
      } else if (mode === 'bonus') {
        api.phaseTestBonus(inv.seat, 2)
      } else {
        const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location)
        if (!enemies.length) return
        const enemy = enemies.length === 1 ? enemies[0] : enemies.find(item => item.id === api.choice({
          kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择要躲避的敌人。',
          options: enemies.map(item => ({ id: item.id, label: item.name || item.id })),
        })) || enemies[0]
        api.test(inv.seat, 'agility', Number(enemy.evade ?? 0), { baseValue: 4,
          source: { type: 'asset', code: CODE, ability: true },
          resolve: result => { if (result.success) api.autoEvade(enemy) } })
      }
    },
  }],
}