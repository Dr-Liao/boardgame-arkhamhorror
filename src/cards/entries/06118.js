// 06118 洁西卡·海德
// 卡面：你得到+1[combat]。
// 卡面：洁西卡·海德入场时，其上带有2点伤害。
// 卡面：[reaction]你的回合结束后：治愈洁西卡·海德的1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：+1[combat] 走 modifiers（引擎统计管线读点）。
// 显式简化（simplified）：
//   ①「入场时其上带有 2 点伤害」——ctx.api 没有「给支援加伤害」的入口（只有 addAssetHorror），
//      条目也不能直写资产字段（R1）；
//   ②「你的回合结束后：治愈洁西卡·海德 1 点伤害」——引擎没有回合结束窗口（只有
//      healSelfHorrorAfterTurn 的恐惧版本），资产上的伤害也没有统一治愈读点。

import { skillModifier } from './_shared.js'

export default {
  code: '06118',
  simplified: true,
  note: '未实现：①入场时其上带有 2 点伤害（缺「给支援加伤害」的 ctx.api；不能直写资产字段）；'
    + '②[reaction]你的回合结束后治愈她 1 点伤害（引擎没有回合结束窗口，也没有资产伤害的通用治愈读点）。'
    + '你得到 +1[combat] 已由 modifiers 生效。',
  modifiers: [
    skillModifier('combat', 1),
  ],
}
