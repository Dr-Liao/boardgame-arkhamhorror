// 60482 暗影交融（升级版，Marie Lambeau，5 XP）
// 卡面：使用（5 充能）。
//       [action]：躲避（[willpower]）。本次躲避你得到 +2[willpower]。
//       如果你成功，你可以花费 1 充能移动到一个与你所在地点连接次数不超过 2 的地点。
//       如果本次检定期间揭示了[tablet]标记，从暗影交融上移除 1 充能（如果你不能，失去 1 个行动并弃掉本卡）。
import { ownSeat } from '../../engine/matcher.js'

function distance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    const location = state.locations.find(item => item.id === id)
    for (const next of location?.connections || []) {
      if (next === to) return steps + 1
      if (!seen.has(next)) { seen.add(next); queue.push([next, steps + 1]) }
    }
  }
  return Infinity
}

export default {
  code: '60482',
  uses: 5,
  usesType: 'charges',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    countsAs: 'evade',
    label: '躲避（意志 +2）；成功可花 1 充能移动到 2 连接内地点',
    cost: { action: true },
    criteria: [ownSeat(), ({ state, inv }) => (state.enemies || []).some(enemy => enemy.location === inv.location)],
    resolve: ({ state, inv, source, api }) => {
      const enemy = (state.enemies || []).find(item => item.location === inv.location)
      api.evade(inv.seat, {
        enemyId: enemy.id, skill: 'willpower', bonus: 2, sourceCode: '60482',
        onSuccess: result => {
          if ((result?.drawn || []).includes('tablet')) {
            if ((source.uses || 0) > 0) api.setAssetUses(source, source.uses - 1)
            else {
              api.loseActions(inv.seat, 1)
              api.discardAsset(inv.seat, source)
            }
            return
          }
          if ((source.uses || 0) < 1) return
          const options = state.locations
            .filter(item => item.id !== inv.location && distance(state, inv.location, item.id) <= 2)
            .map(item => ({ id: item.id, label: item.name }))
          if (!options.length) return
          const answer = api.choice({
            kind: 'location', source: '60482', seat: inv.seat, canSkip: true,
            prompt: '躲避成功：是否花费 1 充能移动到 2 个连接内的地点？',
            options: [{ id: 'skip', label: '不移动' }, ...options],
          })
          if (answer === 'skip' || answer == null) return
          if (!options.some(option => option.id === answer)) return
          api.setAssetUses(source, source.uses - 1)
          api.moveInvestigator(inv.seat, answer)
        },
      })
    },
  }],
}
