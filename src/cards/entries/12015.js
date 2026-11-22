// 12015 忍耐极限（Breaking Point）· 中立 · 弱点/苦难。（伊莎贝拉·巴恩斯签名弱点）
//
// 卡面：
//   显现 - 受到 1 点直接伤害。然后，如果你剩余神智值不超过 6，受到 1 点直接伤害。
//     然后，如果你剩余神智值不超过 3，受到 1 点直接伤害。
//
// 引擎读点：
//   · weakness 描述子带 resolve 时接管整段揭示结算（weakness.js 优先读 descriptor.resolve，
//     不再进入旧类型分支）；直接伤害走 api.directDamage（不可分配给支援）；
//     剩余神智 = api.maxSanity(seat) - inv.horror。

const code = '12015'

export default {
  code,
  abilities: [{
    kind: 'weakness',
    label: '显现：受到 1 点直接伤害（按剩余神智最多追加 2 次）',
    weakness: { type: 'breakingPoint' },
    resolve: ({ inv, api }) => {
      api.directDamage(inv.seat, 1)
      if (inv.defeated || inv.resigned) return
      const remainingSanity = () => api.maxSanity(inv.seat) - (inv.horror || 0)
      if (remainingSanity() <= 6) {
        api.directDamage(inv.seat, 1)
        if (inv.defeated || inv.resigned) return
      }
      if (remainingSanity() <= 3) api.directDamage(inv.seat, 1)
    },
  }],
  modifiers: [],
}
