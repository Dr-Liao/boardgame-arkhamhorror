// 06318 万千化身（Myriad Forms，2 张）
// 卡面：显现 - 如果你手牌中有至少 1 张奈亚拉托提普，将其全部揭示。揭示的每张奈亚拉托提普攻击你，
//       并将其混洗入遭遇牌库。如果奈亚拉托提普在场上，其移动并攻击，如同此刻是敌军阶段。
//       如果本效果未导致任何奈亚拉托提普攻击，万千化身获得涌动。
//
// 行为位置（本文件）：encounterResolve 实现全部显现效果。
//   · 「揭示手中复制品」= api.cardReveal；「攻击」按印刷伤害/恐惧结算（手牌中的复制品没有敌人实例，
//     用 api.damage/api.horror 表达，攻击修正窗口缺失 → simplified）；
//   · 「洗回遭遇牌库」走 `api.hiddenCards.take`（手牌 + 隐私标记一起摘出）再洗入遭遇牌库；
//   · 涌动条件通过 scenarioFlags.myriadFormsAttacked 交给章节 behavior.encounterGainsSurge 读取；
//   · 「真形在场上则移动并攻击」按敌军阶段口径：向最近的调查员移动一步，然后攻击与其同地点的调查员。
import { ALL_CARDS } from '../../_shared.js'

const TRUE_SHAPE_ROLE = 'nyarlathotepTrueShape'

const isNyarlathotepCopy = code => ALL_CARDS[code]?.name === 'Nyarlathotep'
const copiesInHand = inv => (inv?.hand || []).filter(isNyarlathotepCopy)

const printedDamage = code => Number(ALL_CARDS[code]?.damage || 0)
const printedHorror = code => Number(ALL_CARDS[code]?.horror || 0)

const trueShapeOf = state => (state?.enemies || [])
  .find(enemy => !enemy.defeated && enemy.scenarioEnemyRole === TRUE_SHAPE_ROLE) || null

const activeInvestigators = state => (state?.investigators || [])
  .filter(inv => !inv.defeated && !inv.resigned)

// 「把手中的隐藏复制品洗回遭遇牌库」：走 api.hiddenCards.take（手牌 + hiddenCards 标记一起摘出），
// 再洗入遭遇牌库（引擎 P8 新增的 hidden 手牌原语）。
function shuffleBackIntoEncounterDeck(api, seat, code) {
  if (typeof api.hiddenCards?.take !== 'function') return false
  if (!api.hiddenCards.take(seat, code)) return false
  api.shuffleIntoEncounterDeck?.([code])
  return true
}

// 手牌中的复制品攻击抽牌者：按印刷伤害/恐惧直接结算（无敌人实例，见文件头 simplified）。
function attackFromHand(api, inv, code) {
  const damage = printedDamage(code)
  const horror = printedHorror(code)
  if (damage > 0) api.damage?.(inv.seat, damage)
  if (horror > 0) api.horror?.(inv.seat, horror)
}

// 「如同敌军阶段」：向最近的调查员移动一步，再攻击与其同地点的调查员。
function resolveEnemyPhaseOf(state, api, enemy) {
  const candidates = activeInvestigators(state)
  if (!candidates.length) return
  let nearest = candidates[0]
  let best = Number.POSITIVE_INFINITY
  for (const inv of candidates) {
    const steps = api.locationDistance?.(enemy.location, [inv.location])
    if (Number.isFinite(steps) && steps >= 0 && steps < best) {
      best = steps
      nearest = inv
    }
  }
  if (nearest.location && nearest.location !== enemy.location) {
    const next = api.stepToward?.(enemy.location, nearest.location)
    if (next && next !== enemy.location) api.moveEnemy?.(enemy, next)
  }
  for (const inv of activeInvestigators(state)) {
    if (inv.location !== enemy.location) continue
    api.attack?.(enemy, inv)
  }
}

export default {
  code: '06318',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const copies = copiesInHand(inv)
    let attacked = false
    // 1) 揭示手中全部复制品
    for (const code of copies) {
      api.cardReveal?.(code, '揭示手牌中的奈亚拉托提普')
    }
    // 2) 每张复制品攻击抽牌者，然后洗回遭遇牌库
    for (const code of copies) {
      attackFromHand(api, inv, code)
      attacked = true
      shuffleBackIntoEncounterDeck(api, inv.seat, code)
      api.info?.(`👹 手中隐藏的奈亚拉托提普攻击了 ${inv.name}，随后被洗回遭遇牌库。`)
    }
    // 3) 真形在场上：如同敌军阶段移动并攻击
    const shape = trueShapeOf(state)
    if (shape) resolveEnemyPhaseOf(state, api, shape)
    // 4) 没有任何复制品攻击 → 获得涌动（behavior.encounterGainsSurge 读这个标记并清除）
    api.setScenarioFlag?.('myriadFormsAttacked', attacked)
    return false
  },
}
