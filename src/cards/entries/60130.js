import { enemyIsBody, enemyIsPart } from '../../engine/enemy-parts.js'

const code = '60130'
const targets = (state, inv) => state.enemies.filter(enemy => enemy.location === inv.location
  && enemy.engagedSeat !== inv.seat && !enemy.massive && !enemy.enemyLocation && !enemy.defeated
  && !enemy.removedFromGame && !enemyIsBody(enemy) && !enemyIsPart(enemy))

export default {
  code,
  playCondition: [({ state, inv, helpers }) => !helpers.capabilityBlocked(inv.seat, 'engage') && targets(state, inv).length > 0],
  abilities: [{
    kind: 'played', fast: true, countsAs: 'engage',
    label: '选择若干敌人交战，各造成 1 伤害并抽 1 张牌',
    resolve: ({ state, inv, api }) => {
      const considered = new Set()
      for (;;) {
        const options = targets(state, inv).filter(enemy => !considered.has(enemy.id))
        if (!options.length || inv.defeated || inv.resigned) return
        const chosen = api.choice({
          kind: 'target', source: code, seat: inv.seat, canSkip: true, prompt: '选择下一名要交战的敌人。',
          options: [{ id: 'skip', label: '完成' }, ...options.map(enemy => ({ id: enemy.id, label: enemy.name }))],
        })
        const enemy = options.find(item => item.id === chosen)
        if (!enemy) return
        considered.add(enemy.id)
        api.engage(enemy, inv.seat)
        if (enemy.engagedSeat !== inv.seat) continue
        if (state.enemies.includes(enemy)) api.damageEnemy(enemy, 1, inv.seat, code)
        api.drawCards(inv.seat, 1)
      }
    },
  }],
}
