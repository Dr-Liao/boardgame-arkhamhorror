// 08727 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 如果现在是你的回合，失去 1 个行动；否则你的下一个回合期间失去 1 个行动。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 读点：weakness 描述子的 resolve 接管整段结算（weakness.js#resolveWeaknessBody 见 resolve 即 return，
//   不会真的进入威胁区）；随后 deck-ops.js#drawCards 的默认去向因 isThreatWeakness 为真而跳过弃牌，
//   因此卡牌只在 resolve 里经 api.mechanics.tekeli.return 回到忒咳哩-哩牌库底，16 张物理副本守恒。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08727', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08727）',
    resolve: ({ state, inv, api }) => {
      if (state.currentSeat === inv.seat) api.loseActions(inv.seat, 1)
      else api.info('「忒咳哩-哩」：你的下一个回合期间失去 1 个行动（读点待接）。')
      api.mechanics.tekeli.return('08727', { destination: 'bottom' })
      api.info('🃏 忒咳哩-哩「08727」回到忒咳哩-哩牌库底。')
    },
  }],
}

