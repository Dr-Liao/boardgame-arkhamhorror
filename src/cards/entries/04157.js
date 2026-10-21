// 04157 如痴如醉
// 卡面：如果调查期间本次技能检定成功，在你控制的一张支援卡牌上放置1充能或秘密。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04157',
  abilities: [
    {
      kind: 'commit',
      label: '如痴如醉',
      skill: { onSuccess: { placeChargeOrSecret: true } },
    },
  ],
  modifiers: [

  ],
}
