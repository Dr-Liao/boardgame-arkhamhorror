// 01025 致命打击
// 卡面：如果攻击期间本次技能检定成功，则本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01025',
  abilities: [
    { kind: 'commit', label: '致命打击', skill: { onSuccess: { damageBonus: 1 } } },
  ],
  modifiers: [

  ],
}
