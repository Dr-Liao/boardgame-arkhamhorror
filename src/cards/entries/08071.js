// 08071 补给匮乏（Short Supply）· 幸存者（Survivor）资产 · 永久（建库时购买，限 1 张）。
//
// 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
//       强制 - 在你游戏的第一个回合开始时：弃掉你牌库顶 10 张卡牌。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：卡面数据 permanent:true，开局由 setup.js 的永久卡循环自动入场；强制效果挂 turnBegins
// 窗口，limit perGame 保证整局一次，api.discardTopOfDeck 弃牌。
export default {
  code: '08071',
  abilities: [
    {
      kind: 'forced',
      trigger: 'turnBegins',
      label: '你游戏的第一个回合开始时：弃掉牌库顶 10 张卡牌',
      limit: { scope: 'perGame', owner: 'player' },
      criteria: [({ state, inv, context }) => context?.seat === inv.seat && state.round === 1],
      resolve: ({ inv, api }) => {
        const discarded = api.discardTopOfDeck(inv.seat, 10)
        api.info(`📦 「补给匮乏」：${inv.name} 弃掉了牌库顶 10 张卡牌${discarded ? '' : '（牌库不足 10 张，弃到空为止）'}。`)
      },
    },
  ],
  modifiers: [],
}
