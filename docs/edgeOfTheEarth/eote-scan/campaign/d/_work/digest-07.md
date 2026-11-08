# D 分片审阅摘要 7（08720–08731）

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