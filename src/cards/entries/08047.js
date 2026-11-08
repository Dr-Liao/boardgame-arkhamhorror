// 08047 提前侦察
// 卡面：移动。移动最多 3 次。该移动期间敌人不会与你交战。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：引擎没有「移动期间不触发交战」的临时标记（请求 m2-1-08047.json）。这里每次
// api.moveInvestigator 之后立刻 api.disengageAll(inv.seat)，使本次移动结束时没有敌人与你交战；
// 移动瞬间的「入场交战」窗口仍会打开（可能触发敌人交战反应），是主要差异。最多 3 次由循环上限表达。
export default {
  code: '08047',
  abilities: [
    {
      kind: 'played',
      countsAs: 'move',
      label: '移动最多 3 次（近似：每次移动后立即解除交战）',
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
          api.moveInvestigator(inv.seat, target.id)
          // 该移动期间敌人不会与你交战（近似：移动后立即解除所有交战）。
          api.disengageAll(inv.seat)
          api.info(`提前侦察：移动到「${api.locName(target.id)}」，本次移动期间不与敌人交战。`)
        }
      },
    },
  ],
  modifiers: [],
}
