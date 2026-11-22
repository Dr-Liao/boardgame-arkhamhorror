// 60481 通灵视觉（Second Sight，Marie Lambeau，5 XP）
// 卡面：使用（4 充能）。
//       [action]：调查（[willpower]）。本次调查你得到 +2[willpower]。
//       如果你成功，你可以花费 1 充能来发现你所在地点的 1 个额外线索，或一个连接地点的 1 个线索。
//       如果本次检定期间揭示了[cultist]标记，从通灵视觉上移除 1 充能（如果你不能，受到 1 点恐惧并弃掉本卡）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60481',
  uses: 4,
  usesType: 'charges',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    countsAs: 'investigate',
    label: '调查（意志 +2）；成功可花 1 充能找到额外线索',
    cost: { action: true },
    criteria: [ownSeat()],
    resolve: ({ state, inv, source, api }) => {
      const result = api.investigate(inv.seat, { skill: 'willpower', bonus: 2 })
      const tokens = result?.drawn || []
      if (!result?.success) {
        if (tokens.includes('cultist')) {
          if ((source.uses || 0) > 0) api.setAssetUses(source, source.uses - 1)
          else {
            api.horror(inv.seat, 1)
            api.discardAsset(inv.seat, source)
          }
        }
        return
      }
      if ((source.uses || 0) < 1) return
      const location = state.locations.find(item => item.id === inv.location)
      const connected = (location?.connections || [])
        .filter(id => state.locations.some(item => item.id === id))
      const options = [{ id: 'here', label: '所在地点额外 1 个线索' },
        ...connected.map(id => ({ id, label: `连接地点：${state.locations.find(item => item.id === id)?.name || id}` }))]
      const answer = api.choice({
        kind: 'location', source: '60481', seat: inv.seat, canSkip: true,
        prompt: '调查成功：是否花费 1 充能发现额外线索？',
        options: [{ id: 'skip', label: '不花费' }, ...options],
      })
      if (answer === 'skip' || answer == null) return
      api.setAssetUses(source, source.uses - 1)
      if (answer === 'here') api.discoverClue(inv.seat, 1)
      else if (connected.includes(answer)) api.discoverClue(inv.seat, 1, answer)
    },
  }],
}
