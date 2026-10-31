// 06268 · 《无归之地》诡计「鲜血的滋味」（Taste of Lifeblood ×2）。
// 卡面：Revelation - Test [willpower] (3). For each point you fail by, you must (choose one):
//   Place 1 of your clues on your location, place 1 of your clues on the nearest enemy, or take 1 damage.
//
// 显现检定用 api.test（失败差值逐点结算）；每个失败点三选一（无法执行的选项不提供）。

const EMPTY = Object.freeze({ state: null, inv: null })

function nearestEnemy(state, inv) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated)
  const here = enemies.find(enemy => enemy.location === inv.location)
  if (here) return here
  const location = (state.locations || []).find(entry => entry.id === inv.location)
  const neighbors = new Set(location?.connections || [])
  return enemies.find(enemy => neighbors.has(enemy.location)) || null
}

export default {
  code: '06268',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      const failedBy = Math.max(0, 3 - Number(result.value ?? 0))
      for (let index = 0; index < failedBy; index += 1) {
        const options = []
        if (Number(inv.clues || 0) > 0) {
          options.push({ id: 'location', label: '将你的 1 个线索放到你所在地点' })
          if (nearestEnemy(state, inv)) {
            options.push({ id: 'enemy', label: '将你的 1 个线索放到最近的敌人上' })
          }
        }
        options.push({ id: 'damage', label: '受到 1 点伤害' })
        const answer = options.length === 1
          ? options[0].id
          : String(api.choose?.({
            kind: 'option', source: '06268', seat: inv.seat,
            prompt: '「鲜血的滋味」：选择一项。', options,
          }) ?? options[0].id)
        if (answer === 'location') {
          api.placeClues?.(inv.seat, 1)
          api.info?.(`🩸 ${inv.name} 把 1 个线索放到「${state.locations?.find(entry => entry.id === inv.location)?.name || ''}」。`)
        } else if (answer === 'enemy') {
          const enemy = nearestEnemy(state, inv)
          if (enemy) {
            api.moveClueToEnemy?.(enemy, { from: 'investigator', seat: inv.seat })
            api.info?.(`🩸 ${inv.name} 把 1 个线索放到「${enemy.name}」上。`)
          } else {
            api.damage?.(inv.seat, 1)
          }
        } else {
          api.damage?.(inv.seat, 1)
          api.info?.(`🩸 ${inv.name} 受到 1 点伤害。`)
        }
      }
    })
    return false
  },
}
