// 04196 萝拉·桑提亚哥
// 卡面：你得到+1[intellect]和+1[agility]。
// 卡面：[free]横置萝拉·桑提亚哥并花费X资源：发现你所在地点的1个线索。X为你所在地点的隐藏值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04196 萝拉·桑提亚哥：+1 智识 / +1 敏捷；横置并花费「所在地点隐藏值」等量资源发现 1 个线索。

export default {
  code: '04196',
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
    { target: 'skill:agility', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action', label: '花费隐藏值等量资源：发现 1 个线索', cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const cost = here?.shroud || 0
        if (inv.resources < cost) { api.info(`资源不足（需要 ${cost}）。`); return }
        api.loseResources(inv.seat, cost)
        api.discoverClue(inv.seat, 1)
      },
    },
  ],
}
