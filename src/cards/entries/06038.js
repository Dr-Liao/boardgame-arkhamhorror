// 06038 最可怕的噩梦（基础弱点）
// 卡面：多人游戏专用。
//       猎手。
//       猎物 - 仅对承受者。
//       最可怕的噩梦的承受者不能对其进行攻击，不能对其造成伤害，也不能将其击败。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06038 最可怕的噩梦：
//   · 敌人型弱点：条目 scope:'enemy'（非玩家通道）。敌人型弱点由 resolveWeakness 的
//     `def.type === 'enemy'` 分支直接生成，不需要 weakness 描述子（scope enemy 的条目不允许
//     声明 weakness kind）；bearerSeat = 抽到它的座位。
//   · 关键词来自条目 enemyWeakness（hunter + prey: bearer）。
//   · 承受者攻击、伤害与击败限制由 enemyRule 的座位敏感读点统一执行。

export default {
  code: '06038',
  scope: 'enemy',
  enemyWeakness: { hunter: true, prey: true },
  enemyRule: { bearerCannotFightDamageDefeat: true },
  abilities: [],
  modifiers: [],
}
