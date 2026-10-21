// 02268 无所畏惧
// 卡面：如果本次技能检定成功，治愈1点恐惧(如果检定成功且超过难度2点或更多，则改为治愈2点恐惧)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02268 无所畏惧：检定成功治疗 1 点恐惧；成功 2 点以上再 1 点。

export default {
  code: '02268',
  abilities: [
    {
      kind: 'commit', label: '成功治疗恐惧',
      skill: { onSuccess: { healHorror: 1 }, successBy: { threshold: 2, healHorror: 1 } },
    },
  ],
  modifiers: [

  ],
}
