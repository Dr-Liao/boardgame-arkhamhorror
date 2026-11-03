// 05228 机关盒：取得控制权及加入战役牌组仍由《崇高利益》的剧本流程处理。
const watcherOf = state => (state.enemies || []).find(enemy =>
  String(enemy.originalCode || enemy.code) === '05086')

const brazierLit = location => Boolean(location && (
  (location.markers || []).includes('brazier')
  || location.flags?.brazier === true
  || (location.flags?.brazier == null && location.litBrazier === true)
))

function actionOptions(state, inv) {
  const options = []
  const location = (state.locations || []).find(item => item.id === inv.location)
  if (brazierLit(location)) options.push({ id: 'unlight', label: '熄灭你所在地点的火盆' })
  const watcher = watcherOf(state)
  if (watcher && !watcher.exhausted) options.push({ id: 'exhaust', label: '横置幽灵看守人' })
  if (watcher?.exhausted) options.push({ id: 'damage', label: '对已横置的幽灵看守人造成 5 点伤害' })
  return options
}

export default {
  code: '05228',
  scope: 'storyAsset',
  implemented: true,
  transferOnControllerDefeat: true,
  abilities: [{
    kind: 'action',
    actionKind: 'action',
    label: '机关盒：熄灭火盆或影响幽灵看守人',
    cost: { action: 1 },
    limit: { scope: 'perGame', owner: 'group' },
    noOpportunityAttackFrom: ['05086'],
    criteria: [({ state, inv }) => actionOptions(state, inv).length > 0],
    resolve: ({ state, inv, api }) => {
      const options = actionOptions(state, inv)
      if (!options.length) return
      const answer = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: '05228', seat: inv.seat,
        prompt: '「机关盒」：选择一项结算。', options,
      })
      const chosen = options.find(option => option.id === answer) || options[0]
      if (chosen.id === 'unlight') {
        api.setLocationFlag(inv.location, 'brazier', false)
      } else {
        const watcher = watcherOf(state)
        if (!watcher) return
        if (chosen.id === 'exhaust') api.exhaust(watcher)
        if (chosen.id === 'damage') api.damageEnemy(watcher, 5, inv.seat)
      }
    },
  }],
  note: '剧情归属由《崇高利益》负责；控制后的行动和被击败转交可跨章节使用。',
}
