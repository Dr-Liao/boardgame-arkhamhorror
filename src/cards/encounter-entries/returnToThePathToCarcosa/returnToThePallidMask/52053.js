// 52053 畸形骸骨（重返苍白面具）
// 归属：关卡专用 · returnToThePallidMask（重返卡尔克萨之路 · 苍白面具）
// 遭遇组：return_to_the_pallid_mask
// 卡面：猎手。强制 - 结算猎手关键词时，如果 2 个地点内没有调查员，改为移动到离调查员最近的
//       地下墓穴地点；攻击时只造成伤害或恐惧之一。
//
// 行为读点：enemyRule.hunterWhenNoInvestigatorWithin: 2（本章 behavior.hunterMoveOverride）；
//           enemyScript.onHunterMove 由 carcosa encounter-rules.hunterMove 调用。
export default {
  code: '52053',
  name: '畸形骸骨',
  scope: 'enemy',
  enemyRule: { hunterWhenNoInvestigatorWithin: 2, attackDamageOrHorrorOnly: true },
  enemyScript: {
    onHunterMove(state, enemy, api) {
      const distance = (from, to) => {
        if (from === to) return 0
        const seen = new Set([from]), queue = [[from, 0]]
        while (queue.length) {
          const [id, steps] = queue.shift()
          const location = state.locations.find(candidate => candidate.id === id)
          for (const next of location?.connections || []) {
            if (next === to) return steps + 1
            if (!seen.has(next)) { seen.add(next); queue.push([next, steps + 1]) }
          }
        }
        return Infinity
      }
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      const near = active.some(inv => distance(enemy.location, inv.location) <= 2)
      if (near) return false
      const catacombs = state.locations.filter(location => location.catacombs === true
        || ['03247', '03248', '03249', '03250', '03251', '03252', '03253', '03254', '03255',
          '52049', '52050', '52051', '52052'].includes(location.originalCode))
      const scored = catacombs
        .map(location => ({ id: location.id, distance: Math.min(...active.map(inv => distance(location.id, inv.location))) }))
        .filter(item => Number.isFinite(item.distance))
        .sort((left, right) => left.distance - right.distance)
      if (!scored.length || scored[0].distance === distance(enemy.location, active[0]?.location)) return false
      api.moveEnemy(enemy, scored[0].id)
      return true
    },
  },
}
