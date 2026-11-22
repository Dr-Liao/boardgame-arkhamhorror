// 60461 暗影交融（Shadowmeld，Marie Lambeau）
// 卡面：使用（4 充能）。
//       [action]：躲避（[willpower]）。如果你成功，你可以花费 1 充能移动到一个连接地点。
//       如果本次检定期间揭示了[tablet]标记，从暗影交融上移除 1 充能（如果你不能，失去 1 个行动并弃掉本卡）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60461',
  uses: 4,
  usesType: 'charges',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    countsAs: 'evade',
    label: '躲避（意志）；成功可花 1 充能移动到连接地点',
    cost: { action: true },
    criteria: [ownSeat(), ({ state, inv }) => (state.enemies || []).some(enemy => enemy.location === inv.location)],
    resolve: ({ state, inv, source, api }) => {
      const targets = (state.enemies || []).filter(enemy => enemy.location === inv.location)
      const enemy = targets[0]
      api.evade(inv.seat, {
        enemyId: enemy.id, skill: 'willpower', sourceCode: '60461',
        onSuccess: result => {
          const tokens = result?.drawn || []
          if (tokens.includes('tablet')) {
            if ((source.uses || 0) > 0) api.setAssetUses(source, source.uses - 1)
            else {
              api.loseActions(inv.seat, 1)
              api.discardAsset(inv.seat, source)
            }
            return
          }
          if ((source.uses || 0) < 1) return
          const location = state.locations.find(item => item.id === inv.location)
          const options = (location?.connections || [])
            .filter(id => state.locations.some(item => item.id === id))
            .map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id }))
          if (!options.length) return
          const answer = api.choice({
            kind: 'location', source: '60461', seat: inv.seat, canSkip: true,
            prompt: '躲避成功：是否花费 1 充能移动到一个连接地点？',
            options: [{ id: 'skip', label: '不移动' }, ...options],
          })
          if (answer !== 'skip' && options.some(option => option.id === answer)) {
            api.setAssetUses(source, source.uses - 1)
            api.moveInvestigator(inv.seat, answer)
          }
        },
      })
    },
  }],
}
