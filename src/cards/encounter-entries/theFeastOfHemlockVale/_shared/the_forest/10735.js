// 10735 绽放（Bloom）· 诡计 · 共享遭遇组 the_forest（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_forest。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Choose the nearest [[Flora]] enemy and heal all damage from it (if that enemy is
//   [[Elite]], heal 2 [per_investigator] damage from it instead). If no damage was healed by this
//   effect, discard cards from the top of the encounter deck until a [[Flora]] card is discarded and
//   draw it.
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 的诡计由 card-data.js#encounterDefinitions 打上
//     entryRevelation，读点 src/engine/treachery-tokens.js#resolveTreacheryBody 的条目通道）。
//   · 「最近的[[植物]]敌人」= src/cards/encounter-entries/_shared.js#entryDistance 的连接图 BFS；
//     同距由领队选择（api.choice）。
//   · 治愈 = api.healEnemy（scenario-runtime.js，写 damageTaken；返回值即实际治愈点数）。
//   · 「从遭遇牌库顶弃牌直到弃掉[[植物]]卡，然后抽取它」= api.discardEncounterTop（唯一的弃顶入口，
//     reshuffle:false 表示牌库耗尽不洗回）+ api.encounterDiscardCards / api.drawEncounterDiscard
//     （把该牌放回牌库顶并走统一抽牌管线）；特性用 _shared.js 的 ALL_CARDS / hasTrait 读印刷数据。
import { ALL_CARDS, entryDistance, hasTrait } from '../../../_shared.js'

const CODE = '10735'
const NAME = '绽放'
const TRAIT = 'Flora'
const ELITE_HEAL_PER_INVESTIGATOR = 2

const isElite = enemy => enemy?.elite === true
  || (ALL_CARDS[enemy?.originalCode || enemy?.code]?.traits || []).some(trait => /^elite$/i.test(trait))

// 「最近的[[植物]]敌人」：不可达（Infinity）不参与；同距由领队选择。
function nearestFloraEnemies(state, fromId) {
  const scored = (state.enemies || [])
    .filter(enemy => enemy && !enemy.defeated && !enemy.removedFromGame && enemy.location && hasTrait(enemy, TRAIT))
    .map(enemy => ({ enemy, distance: entryDistance(state, fromId, enemy.location) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.enemy)
}

function chooseEnemy(state, inv, api, candidates) {
  if (candidates.length === 1) return candidates[0]
  const id = api.choice({
    kind: 'target', source: CODE, seat: inv.seat,
    prompt: `「${NAME}」：选择最近的[[植物]]敌人（距离相同）。`,
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
  })
  return candidates.find(enemy => enemy.id === id) || candidates[0]
}

// 「如果此效果没有治愈伤害」：从遭遇牌库顶弃牌直到弃掉一张[[植物]]卡，然后抽取它。
function drawUntilFlora(state, inv, api) {
  for (let guard = 0; guard < 200; guard += 1) {
    const deck = api.encounterDeckCards?.() || []
    if (!deck.length) break
    const discarded = api.discardEncounterTop(1, { reshuffle: false, log: false }) || []
    const code = discarded[0] ?? deck[deck.length - 1]
    if (!hasTrait(ALL_CARDS[code], TRAIT)) continue
    const pile = api.encounterDiscardCards?.() || []
    const index = pile.lastIndexOf(code)
    if (index < 0) break
    api.drawEncounterDiscard(inv.seat, index)
    api.info?.(`🌱 「${NAME}」没有治愈伤害：弃牌直到「${ALL_CARDS[code]?.nameZh || code}」并抽取它。`)
    return true
  }
  api.info?.(`🌱 「${NAME}」没有治愈伤害，且遭遇牌库里没有[[植物]]卡牌。`)
  return false
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    encounterGroup: 'the_forest',
    quantity: 2,
    traits: ['Power'],
    healTargetTrait: TRAIT,
    healMode: 'allDamage',
    eliteHealPerInvestigator: ELITE_HEAL_PER_INVESTIGATOR,
    fallbackDrawUntilTrait: TRAIT,
  },
  encounterResolve(state, inv, card, api) {
    void card
    if (!inv) return false
    const candidates = nearestFloraEnemies(state, inv.location)
    if (candidates.length) {
      const target = chooseEnemy(state, inv, api, candidates)
      const before = Math.max(0, Number(target.damageTaken) || 0)
      const amount = isElite(target)
        ? Math.min(before, ELITE_HEAL_PER_INVESTIGATOR * (Number(state.numInvestigators) || 1))
        : before
      const healed = amount > 0 ? api.healEnemy(target, amount) : 0
      if (healed > 0) {
        api.info?.(`🌺 「${NAME}」治愈「${target.name}」${healed} 点伤害。`)
        return false
      }
      api.info?.(`🌺 「${NAME}」选择的「${target.name}」没有伤害可治愈。`)
    }
    drawUntilFlora(state, inv, api)
    return false
  },
  note: '显现自足实现：最近的[[植物]]敌人按连接图 BFS（同距由领队选择），精英改为每调查员 2 点治愈；'
    + '「没有治愈伤害」包括「选不出植物敌人」与「选中的敌人没有伤害」，两种都走弃牌直到[[植物]]卡并抽取。',
}
