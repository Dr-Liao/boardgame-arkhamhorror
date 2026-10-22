// 04218 石板祭坛
// 归属：关卡专用 · heartOfTheEldersPart1（久远腹地（上）· 昆扬之口）
// 遭遇组：pillars_of_judgment
// 卡面：强制 - 在你进入石板祭坛后：从混乱袋中随机揭示一个混乱标记。如果你揭示了[elder_sign]、[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，失去1个行动。如果你不能这么做，改为受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 石板祭坛（04218）：进入后随机揭示一个混乱标记；符号则失去 1 行动，无法失去则改为 1 点恐惧。

export default {
  code: '04218', scope: 'location',
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        const token = api.revealToken?.(inv.seat)
        if (!token) return
        const label = api.tokenLabel?.(String(token)) ?? String(token)
        api.info?.(`石板祭坛：揭示混乱标记「${label}」。`)
        if (!['eldersign', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(String(token))) return
        if ((inv.actionsLeft || 0) > 0) api.loseActions(inv.seat, 1)
        else api.horror(inv.seat, 1)
      },
    },
  },
}
