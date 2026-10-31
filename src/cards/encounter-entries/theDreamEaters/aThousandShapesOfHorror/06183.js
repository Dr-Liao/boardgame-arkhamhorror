// 06183 地点「神秘阶梯」（Mysterious Stairs · [[墓地]]）· 万千骇形（183）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：神秘阶梯与其上方和下方的地点连接。
// 强制 - 你进入本地点后：失去 1 个行动。
//
// 依据 Haskell Location/Cards/.../MysteriousStairs_183.hs：
//   · 上下连接 = 纵向链（behavior 用 api.verticalChain.link 写入 verticalIndex/connections，
//     布局按 verticalIndex 纵列；不新建循环专属布局）；
//   · 进入强制 → locationRule.onEnter.effect（引擎 movement.js 直接读，api.loseActions 结算）。
export default {
  code: '06183',
  scope: 'location',
  implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv) return
        api.loseActions?.(inv.seat, 1)
        api.info?.(`🪜 神秘阶梯：${inv.name} 进入后失去 1 个行动。`)
      },
    },
  },
}
