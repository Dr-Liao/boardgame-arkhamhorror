// 08047 提前侦察
// 卡面：移动。移动最多 3 次。该移动期间敌人不会与你交战。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
export default {
  code: '08047',
  abilities: [
    {
      kind: 'played',
      countsAs: 'move',
      label: '移动最多 3 次，期间敌人不与你交战',
      resolve: ({ state, inv, api }) => {
        for (let moved = 0; moved < 3; moved++) {
          const here = (state.locations || []).find(location => location.id === inv.location)
          const destinations = (here?.connections || [])
            .map(id => (state.locations || []).find(location => location.id === id))
            .filter(Boolean)
          if (!destinations.length) {
            if (moved === 0) api.info('提前侦察：没有可移动的连接地点。')
            return
          }
          const answer = api.choice({
            kind: 'location', source: '08047', seat: inv.seat, canSkip: true,
            prompt: `提前侦察：移动第 ${moved + 1}/3 次。`,
            options: [
              { id: 'stop', label: '停止移动' },
              ...destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
            ],
          })
          if (answer === 'stop' || answer == null) return
          const target = destinations.find(location => location.id === answer)
          if (!target) return
          api.moveInvestigator(inv.seat, target.id, { preventEnemyEngagement: true })
        }
      },
    },
  ],
  modifiers: [],
}
