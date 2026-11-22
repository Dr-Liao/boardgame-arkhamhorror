// 60225 "我有个计划！"
// 卡面：攻击。本次攻击不使用[combat]，改为使用[intellect]。本次检定你得到+2[intellect]。你每有1个线索，本次攻击造成+1伤害(最多+3伤害)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60225',
  abilities: [{
    kind: 'played', label: '用智识 +2 攻击，每个线索 +1 伤害，最多 +3',
    effect: { type: 'fight', skill: 'intellect', combatBonus: 2, damagePerClue: true, maxDamageBonus: 3 },
  }],
}
