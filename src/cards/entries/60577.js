// 60577 喘息 · 事件（1 费，2 经验，万用/万用图标，精魂）
// 卡面：你所在地点没有敌人才能打出。
//       选择你弃牌堆中最多 3 张等级 0 的事件和/或技能卡牌，将其混洗入你的牌库。抽取 1 张卡牌。
const CODE = '60577'

export default {
  code: CODE,
  playCondition: [{
    when: ({ state, inv }) => !(state.enemies || []).some(enemy => enemy.location === inv.location),
    message: '所在地点有敌人，不能打出喘息。',
  }],
  abilities: [{
    kind: 'played',
    label: '把弃牌堆最多 3 张等级 0 的事件/技能洗入牌库，抽取 1 张',
    resolve: ({ inv, api }) => {
      const chosen = []
      for (let i = 0; i < 3; i += 1) {
        const candidates = [...new Set(inv.discard || [])].filter(code => {
          const level = Number(api.cardDef?.(code)?.xp ?? 0)
          const type = api.cardType(code)
          return (type === 'event' || type === 'skill') && level === 0 && !chosen.includes(code)
        })
        if (!candidates.length) break
        const options = candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))
        const picked = options.length === 1 ? options[0].id : api.choice({
          kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
          prompt: `喘息：选择第 ${i + 1} 张等级 0 的事件或技能牌洗回牌库。`,
          options: [{ id: 'skip', label: '不再选择' }, ...options],
        })
        if (!picked || picked === 'skip') break
        chosen.push(picked)
      }
      for (const code of chosen) api.moveCard({ code, from: 'discard', to: 'deck' })
      if (chosen.length) api.shuffleDeck(inv.seat)
      api.drawCards(inv.seat, 1)
      api.info(`喘息：${inv.name} 把 ${chosen.length} 张牌洗回牌库并抽取 1 张。`)
    },
  }],
  modifiers: [],
}
