// 05313 圣化之镜
// 卡面：每套牌库仅限一张。
// 卡面：强制 - 在圣化之镜入场后：查找你的绑定卡牌，找出3张舒缓旋律。将其中一张加入你手牌，将其余2张洗入你的牌库。
//       在圣化之镜离场时，找到所有这些舒缓旋律（即使在场外），将它们放在一边，位于场外。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05313 圣化之镜：绑定主卡。绑定关系来自卡面数据（bondedCards），行为走 P2.8 原语
// ctx.api.bonded.retrieve / return（测试口径 tests/tcu-primitives-bonded.test.mjs）。
// 入场即检索（1 张入手、其余洗回牌库）；离场收回场外集合。

export default {
  code: '05313',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场：检索 3 张舒缓旋律（1 张入手，其余洗回牌库）',
      resolve: ({ inv, api }) => {
        api.bonded.retrieve(inv.seat, '05313')
      },
    },
    {
      kind: 'leavesPlay',
      label: '离场：把所有舒缓旋律收回场外集合',
      resolve: ({ inv, api }) => {
        api.bonded.return(inv.seat, '05313')
      },
    },
  ],
  modifiers: [

  ],
}
