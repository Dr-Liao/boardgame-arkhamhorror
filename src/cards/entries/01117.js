// 01117 丽塔·钱德勒
// 卡面：你控制丽塔·钱德勒时，她获得：
// 卡面：“每位在你所在地点的调查员得到+1[combat]。
// 卡面：[reaction]在一位你所在地点的调查员成功攻击一个[[怪物]]敌人时：该调查员造成+1伤害。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01117 丽塔·钱德勒：她所在地点的调查员战斗 +1（原 litaAuraAt）。

export default {
  code: '01117',
  modifiers: [
    { target: 'skill:combat', amount: 1, audience: 'here', condition: { controllerHasNoThreat: '02088' } },
  ],
  auraWhileInPlay: true,
  abilities: [

  ],
}
