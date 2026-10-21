// 03305 阿登护甲
// 卡面：[reaction]在分配伤害给阿登护甲时，横置阿登护甲：取消该伤害中的1点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03305 阿登森林护甲：伤害分配到自身时横置，抵消 1 点伤害。
// 5c-18：抵消走 api.cancelDamage（与旧原语的接线点相同：优先写 reaction.context.cancelDamage）。

export default {
  code: '03305',
  abilities: [
    {
      kind: 'reaction', trigger: 'damageAssignedToSelf', id: 'armorArdennes', legacyReaction: true,
      label: '抵消 1 点伤害', cost: { exhaust: true },
      resolve: ({ api }) => { api.cancelDamage(1) },
    },
  ],
  modifiers: [

  ],
}
