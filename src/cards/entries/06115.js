// 06115 势不可挡
// 卡面：如果本次技能检定成功，你在本阶段执行的下一次技能检定难度降低X，
//       其中X为本次技能检定超过难度的点数(最多为3)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：1 个万能图标由卡面数据通道生效（commitIcons 读 cards-data 的 icons）。
// 显式简化（simplified）：引擎没有「下一次技能检定难度降低 X」的持久账本（commit 描述子只有
// onSuccess 的固定数值键，没有「按成功点数写入下一次检定」的读取点），因此该效果未实现。

export default {
  code: '06115',
  simplified: true,
  note: '未实现：「检定成功后本阶段下一次技能检定难度降低 X（X=超出难度点数，至多 3）」——'
    + '引擎没有下一次检定的难度账本，commit 描述子也没有可写读点；1 个万能图标由卡面数据通道生效。',
  abilities: [
    {
      kind: 'commit',
      label: '势不可挡',
      skill: {},
    },
  ],
  modifiers: [],
}
