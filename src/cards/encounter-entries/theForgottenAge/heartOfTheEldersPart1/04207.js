// 04207 丛林之心
// 归属：关卡专用 · heartOfTheEldersPart1（久远腹地（上）· 昆扬之口）
// 遭遇组：pillars_of_judgment
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04207', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      api.shuffleDiscard()
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      if (!active.length) return
      const answer = active.length === 1 ? String(active[0].seat)
        : api.choose({
          kind: 'investigator', source: '04207', seat: state.campaign?.leadSeat ?? active[0].seat,
          prompt: '选择一位调查员担任瞭望员。',
          options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
        })
      const lookout = active.find(inv => String(inv.seat) === String(answer)) || active[0]
      if (api.hasSupply?.(lookout.seat, 'binoculars') ?? api.checkSupplies?.(lookout.seat, 'binoculars')) {
        api.info?.(`${lookout.name} 带着双筒望远镜，避开了逼近的生物。`)
        return
      }
      const enemyCode = api.discardUntilEnemy?.(lookout.seat, () => true)
      if (!enemyCode) {
        api.info?.('遭遇牌库中没有弃出敌人。')
        return
      }
      api.spawn(enemyCode, lookout.location)
      api.info?.(`${lookout.name} 没有双筒望远镜：遭遇到「${api.cardName?.(enemyCode) || enemyCode}」。`)
    },
  },
}
