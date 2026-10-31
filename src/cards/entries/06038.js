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
//   · 显式简化：「承受者不能对其进行攻击/造成伤害/击败」是「按攻击者座位」的限制，但引擎的
//     enemyCannotBeAttacked(state, enemy) 没有攻击者参数、enemyCanBeDefeated 的 seat 参数也没有
//     卡条目钩子；现有原语只能表达猎手与 bearer 猎物，无法只挡承受者一人。

export default {
  code: '06038',
  scope: 'enemy',
  simplified: true,
  note: '未实现：承受者不能攻击/伤害/击败它（引擎的被攻击/被击败读点没有按攻击者座位的卡条目钩子；'
    + 'enemyCannotBeAttacked 无攻击者参数）；已实现猎手与「猎物-仅对承受者」。',
  enemyWeakness: { hunter: true, prey: true },
  abilities: [],
  modifiers: [],
}
