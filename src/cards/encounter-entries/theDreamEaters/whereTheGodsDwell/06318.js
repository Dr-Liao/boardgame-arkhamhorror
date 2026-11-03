// 06318 万千化身（Myriad Forms，2 张）
// 卡面：显现 - 如果你手牌中有至少 1 张奈亚拉托提普，将其全部揭示。揭示的每张奈亚拉托提普攻击你，
//       并将其混洗入遭遇牌库。如果奈亚拉托提普在场上，其移动并攻击，如同此刻是敌军阶段。
//       如果本效果未导致任何奈亚拉托提普攻击，万千化身获得涌动。
//
// 行为位置（本文件）：encounterResolve 实现全部显现效果。
//   · 「揭示手中复制品」= api.cardReveal；「攻击」走隐藏敌人通用攻击流程；
//   · 「洗回遭遇牌库」走 `api.hiddenCards.take`（手牌 + 隐私标记一起摘出）再洗入遭遇牌库；
//   · 涌动条件通过 scenarioFlags.myriadFormsAttacked 交给章节 behavior.encounterGainsSurge 读取；
//   · 「真形在场上则移动并攻击」由 api.resolveEnemyPhaseOf 复用猎手移动与敌军阶段攻击。
import { ALL_CARDS } from '../../_shared.js'

const TRUE_SHAPE_ROLE = 'nyarlathotepTrueShape'

const isNyarlathotepCopy = code => ALL_CARDS[code]?.name === 'Nyarlathotep'
const copiesInHand = inv => (inv?.hand || []).filter(isNyarlathotepCopy)

const trueShapeOf = state => (state?.enemies || [])
  .find(enemy => !enemy.defeated && enemy.scenarioEnemyRole === TRUE_SHAPE_ROLE) || null

// 「把手中的隐藏复制品洗回遭遇牌库」：走 api.hiddenCards.take（手牌 + hiddenCards 标记一起摘出），
// 再洗入遭遇牌库（引擎 P8 新增的 hidden 手牌原语）。
function shuffleBackIntoEncounterDeck(api, seat, code) {
  if (typeof api.hiddenCards?.take !== 'function') return false
  if (!api.hiddenCards.take(seat, code)) return false
  api.shuffleIntoEncounterDeck?.([code])
  return true
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
      api.attackFromHiddenEnemy(inv.seat, code, { source: '06318' })
      attacked = true
      shuffleBackIntoEncounterDeck(api, inv.seat, code)
      api.info?.(`👹 手中隐藏的奈亚拉托提普攻击了 ${inv.name}，随后被洗回遭遇牌库。`)
    }
    // 3) 真形在场上：如同敌军阶段移动并攻击
    const shape = trueShapeOf(state)
    if (shape) {
      const phase = api.resolveEnemyPhaseOf(shape)
      attacked = attacked || phase.attacked === true
    }
    // 4) 本效果没有导致任何奈亚拉托提普攻击时获得涌动（behavior.encounterGainsSurge 读标记）
    api.setScenarioFlag?.('myriadFormsAttacked', attacked)
    return false
  },
}
