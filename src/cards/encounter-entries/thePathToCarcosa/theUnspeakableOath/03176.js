// 03176 花园
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[action]如果花园没有线索：检定[agility](2)。如果你检定成功，记住你“分散了守卫的注意力”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf, rememberFact } from '../../_shared.js'

export default {
  code: '03176', scope: 'location',
  locationRule: {
    entryError(state, location) {
      if (location.revealed || state.actIndex >= 1) return null
      return '通往花园的门锁住了。你不能进入花园。'
    },
    actions({ state, inv, location, moves }) {
      if (!(state.scenarioFlags.remembered || []).includes('distractedTheGuards')) {
        moves.push({ action: 'scenarioAction', rule: 'gardenGuards', label: '检定敏捷（2），分散守卫注意力',
          reason: (location?.clues || 0) === 0 ? null : `需要先取走花园的线索（还剩 ${location.clues || 0} 个）` })
      }
      if (originalOf(state.acts[state.actIndex] || {}) === '03167') {
        moves.push({ action: 'scenarioAction', rule: 'escapeGarden', label: '从花园撤退',
          reason: state.enemies.some(enemy => enemy.location === inv.location && !enemy.exhausted)
            ? '同地点还有未横置的敌人，需要先躲避或击败' : null })
      }
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'gardenGuards') {
        api.test(inv.seat, 'agility', 2, result => { if (result.success) rememberFact(state, 'distractedTheGuards') })
        return true
      }
      if (move.rule === 'escapeGarden') { api.resign(inv.seat); return true }
      return false
    },
  },
}
