// 06113 梦的本质
// 卡面：绑定(梦境日记)。
// 卡面：在梦的本质将要进入你的弃牌堆，或被混洗入你的牌库时，不将其放入，改为将其放在一边，
//       位于场外 (和你的绑定卡牌一起)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：2 个万能图标与 Bonded 关系来自卡面数据（icons / bondedTo），投入检定走 commit 描述子。
// 投入检定后的去向由 skill.destination 指向绑定场外集合；其它弃牌或洗入牌库
// 由 zoneReplacement 在玩家区域写点替换为绑定场外集合。

export default {
  code: '06113',
  zoneReplacement: { discard: 'bonded', shuffle: 'bonded' },
  abilities: [
    {
      kind: 'commit',
      label: '梦的本质',
      skill: { destination: () => 'setAside' },
    },
  ],
  modifiers: [],
}
