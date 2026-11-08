# D 分片审阅摘要 8（08732–08738）

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