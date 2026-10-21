// 02150 推理
// 卡面：如果调查一个地点时本技能检定成功，额外发现该地点的1个线索(如果检定成功且超过难度2点或更多，则改为额外2个线索)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02150 推理：检定成功额外发现 1 个线索；成功 2 点以上再 1 个。

export default {
  code: '02150',
  abilities: [
    {
      kind: 'commit', label: '成功额外发现线索',
      skill: { onSuccess: { clueBonus: 1 }, successBy: { threshold: 2, clueBonus: 1 } },
    },
  ],
  modifiers: [

  ],
}
