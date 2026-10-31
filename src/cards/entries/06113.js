// 06113 梦的本质
// 卡面：绑定(梦境日记)。
// 卡面：在梦的本质将要进入你的弃牌堆，或被混洗入你的牌库时，不将其放入，改为将其放在一边，
//       位于场外 (和你的绑定卡牌一起)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：2 个万能图标与 Bonded 关系来自卡面数据（icons / bondedTo），投入检定走 commit 描述子。
// 显式简化（simplified）：引擎在检定收尾（tests.js 的 closeTest）统一把投入区牌放进弃牌堆，
// 没有「绑定副本改为放回场外集合」的读取点，因此「不进入弃牌堆/洗入牌库，改为放一边」未实现。

export default {
  code: '06113',
  simplified: true,
  note: '未实现：「将要进入弃牌堆或洗入牌库时改为放回场外集合（和绑定卡牌一起）」——'
    + '引擎检定收尾会把投入卡统一放进弃牌堆，没有 bonded 读取点；Bonded(Dream Diary) 关系与图标由卡面数据通道生效。',
  abilities: [
    {
      kind: 'commit',
      label: '梦的本质',
      skill: {},
    },
  ],
  modifiers: [],
}
