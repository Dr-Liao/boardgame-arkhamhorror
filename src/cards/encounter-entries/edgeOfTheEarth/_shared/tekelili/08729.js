// 08729 忒咳哩-哩（Tekeli-li!）· 弱点 · tekelili
// 归属：战役共用 · edgeOfTheEarth/_shared（7 个卡面 × 印刷份数 = 16 张物理牌库，见 P2 eote-tekeli）。
// 卡面：显现 - 弃掉你控制的一张支援。将忒咳哩-哩放到忒咳哩-哩牌库底。
// 弱点管线处理显现与归还去向；条目只负责其印刷显现效果。
export default {
  // 忒咳哩-哩牌库按弱点管线结算：条目用玩家侧 scope 'card' 声明 weakness 生命周期
  // （非玩家 scope 注册期禁止 weakness kind）；它们不会进入常规非玩家实体枚举。
  code: '08729', scope: 'card', implemented: true,
  flags: { tekelili: true, returnToTekeliliDeckBottom: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'threat' },
    label: '忒咳哩-哩（08729）',
    resolve: ({ inv, api }) => {
      const assets = (inv.assets || []).filter(asset => api.investigatorTools.canDiscardAsset(inv.seat, asset))
      if (assets.length) {
        const pick = assets.length === 1 ? assets[0] : assets.find(card => card.id === api.choice({ kind: 'asset', source: '08729', seat: inv.seat, prompt: '弃掉你控制的一张支援。', options: assets.map(card => ({ id: card.id, label: card.name || card.code })) })) || assets[0]
        api.discardAsset(inv.seat, pick)
      }
    },
  }],
}

