// 60552 米格尔的背包 · 独特支援（身体槽；1 费，+1/+1 精神图标由卡面数据提供）
// 卡面：米格尔·德·拉·克鲁牌库专用。
//       [reaction] 在你打出一张事件时，横置本卡：把该事件视作在连接地点打出（如同你在该地点）；或抽取 1 张牌。
//
// 引擎读点：
//   · beforePlayCost 窗口（actions.js）：api.playEventAsIfAtLocation(context, locationId) 把本次事件
//     的结算地点临时改为连接地点（事件 resolve 期间调查员位置临时切换，事件结束后恢复）。
//   · 拒绝改地点时按卡面另一分支抽 1 张。
const CODE = '60552'

export default {
  code: CODE,
  abilities: [{
    kind: 'reaction',
    trigger: 'beforePlayCost',
    label: '横置背包：把本次事件改为在连接地点结算，或抽取 1 张牌',
    cost: { exhaust: true },
    criteria: [({ state, inv, context }) => context?.seat === inv.seat && context?.cardType === 'event'
      && (state.locations.find(location => location.id === inv.location)?.connections || []).some(id =>
        state.locations.some(location => location.id === id && location.revealed))],
    resolve: ({ state, inv, context, api }) => {
      const here = state.locations.find(location => location.id === inv.location)
      const connected = (here?.connections || []).filter(id => state.locations.some(location => location.id === id && location.revealed))
      const answer = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '米格尔的背包：本次事件在连接地点结算，还是抽取 1 张牌？',
        options: [
          { id: 'draw', label: '抽取 1 张牌' },
          ...connected.map(id => ({ id: `loc:${id}`, label: `在「${api.locName(id)}」结算该事件` })),
        ],
      })
      if (!answer || answer === 'draw') { api.drawCards(inv.seat, 1); return }
      const locationId = String(answer).slice(4)
      if (!api.playEventAsIfAtLocation(context, locationId)) { api.drawCards(inv.seat, 1); return }
      api.info(`🎒 米格尔的背包：本次事件如同在「${api.locName(locationId)}」结算。`)
    },
  }],
  modifiers: [],
}
