// 08728 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 将你的 1 个线索放到你所在地点。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 弱点管线处理显现与归还去向；条目只负责其印刷显现效果。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08728', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08728）',
    resolve: ({ state, inv, api }) => {
      if (state.locations.some(location => location.id === inv.location) && api.loseClues(inv.seat, 1)) {
        api.returnClueToLocation(inv.seat, 1)
      }
    },
  }],
}

