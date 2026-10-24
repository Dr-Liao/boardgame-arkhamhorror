// 04196 萝拉·桑提亚哥
// 卡面：你得到+1[intellect]和+1[agility]。
// 卡面：[free]横置萝拉·桑提亚哥并花费X资源：发现你所在地点的1个线索。X为你所在地点的隐藏值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04196 萝拉·桑提亚哥：+1 智识 / +1 敏捷；横置并花费「所在地点隐藏值」等量资源发现 1 个线索。

// 卡面 X =「你所在地点的隐藏值」：按当前有效帷幕（印刷值 + 帷幕修正 + 迷雾/临时修正）计算。
function effectiveShroud(state, inv) {
  const here = (state?.locations || []).find(location => location.id === inv?.location)
  if (!here) return 0
  const turnMod = here.turnShroudMod?.round === state.round && here.turnShroudMod?.turnSeat === state.currentSeat
    ? here.turnShroudMod.amount || 0 : 0
  return Math.max(0, (here.shroud || 0) + (here.shroudMod || 0) + (state.fogMod || 0) + turnMod)
}

export default {
  code: '04196',
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
    { target: 'skill:agility', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action', label: '花费隐藏值等量资源：发现 1 个线索',
      // 卡面费用是「花费 X 资源」，必须作为费用表达式交给引擎：付不起时能力不出现、不横置；
      // 校验与扣费共用同一份求值结果（cost.js 的 normalizeCostValues）。
      cost: { action: false, exhaust: true, resources: ({ state, inv }) => effectiveShroud(state, inv) },
      resolve: ({ inv, api }) => { api.discoverClue(inv.seat, 1) },
    },
  ],
}
