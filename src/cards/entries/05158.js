// 05158 第六感
// 卡面：[action]：调查。本次调查不使用[intellect]，改为使用[willpower]。
// 如果本次检定期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，
// 你可以选择与你所在地点连接的一个已揭示地点；改为如同你在所选地点调查，而不是在你当前所在地点
// (你可以使用两个地点中任意一个地点的隐藏值)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：意志调查走效果 DSL 的 investigate + skill:'willpower'（02028 礼寻术同一写法）。
// 显式简化：符号后「改写本次调查的地点/隐藏值」需要在检定进行中替换进行中的调查目标，
// 现有 investigate 效果原语没有这个读点，本批只实现意志调查本身。

export default {
  code: '05158',
  simplified: true,
  note: '未实现：符号揭示后「改为如同在连接的已揭示地点调查（可用两者任一隐藏值）」——需要在检定进行中改写本次调查地点/难度，现有 investigate 效果原语没有该读点；主要效果（用意志调查）已实现。',
  abilities: [
    {
      kind: 'action', label: '用意志调查',
      cost: { action: true },
      effect: { type: 'investigate', skill: 'willpower' },
    },
  ],
  modifiers: [],
}
