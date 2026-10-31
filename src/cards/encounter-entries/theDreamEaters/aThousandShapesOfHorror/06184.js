// 06184 地点「神秘阶梯」（Mysterious Stairs · [[墓地]]）· 万千骇形（184）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：神秘阶梯与其上方和下方的地点连接。
// 本地点上有线索时，位于本地点的调查员不能移动，也不能撤退。
//
// 依据 Haskell Location/Cards/.../MysteriousStairs_184.hs：
//   · 线索锁 → locationRule.blockWhileClues（本章 behavior 的 moveError / actionBlocked / beforeMove
//     按同一份数据判定；不写地点实例字段）；
//   · 上下连接 = 纵向链（behavior 用 api.verticalChain.link）。
export default {
  code: '06184',
  scope: 'location',
  implemented: true,
  locationRule: {
    blockWhileClues: {
      move: true,
      resign: true,
      message: '「神秘阶梯」上还有线索：位于本地点的调查员不能移动或撤退。',
    },
  },
}
