// 01039 推理
// 卡面：如果调查一个地点时本技能检定成功，额外发现该地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01039',
  abilities: [
    { kind: 'commit', label: '推理', skill: { onSuccess: { clueBonus: 1 } } },
  ],
  modifiers: [

  ],
}
