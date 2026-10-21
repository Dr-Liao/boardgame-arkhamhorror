// 02299 致命打击
// 卡面：如果攻击期间本次技能检定成功，则本次攻击造成+1伤害(如果检定成功且超过难度2点或更多，则改为造成+2伤害)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02299 致命打击：检定成功 +1 伤害；成功 2 点以上再 +1。

export default {
  code: '02299',
  abilities: [
    {
      kind: 'commit', label: '成功 +1 伤害',
      skill: { onSuccess: { damageBonus: 1 }, successBy: { threshold: 2, damageBonus: 1 } },
    },
  ],
  modifiers: [

  ],
}
