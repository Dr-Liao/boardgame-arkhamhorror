// 90093 塞缪尔·布莱克（Samuel Blake · Obsessive Producer）· 中立 · 支援/类人/异教徒 · 盟友槽 ·
// 萝拉（平行）牌库专用 · 替换 · 险境。
//
// 卡面（cards-data 90093）：
//   Lola Hayes deck only. Replacement. Peril.
//   While Samuel Blake is in your hand, you cannot switch roles or play cards belonging to another role.
//   While Samuel Blake is in play, as an additional cost for you to switch your role, you must take
//   1 horror.
//
// 引擎读点：
//   · 「抽到后留在手牌、可支付费用打出」：条目级 `weaknessStaysInHand` + `playableWeakness`
//     （deck-ops.drawCards 弱点分支 / play-condition.js 的 LEGACY_RULES 读点；01013 黑暗回忆同款）。
//   · 在场上时的切换角色追加 1 点恐惧：平行萝拉（90087）的切换逻辑已读本卡并结算（见 90087.js）。
//     基础萝拉的切换走引擎 carcosaInvestigator 的 lolaSwitchRole（不在本文件），未接 → 见 request。
//   · 在手牌时的两条禁止（不能切换角色 / 不能打出其它角色的卡）：引擎没有「手牌中的弱点影响角色系统」
//     的读点（stats.lolaCanUseCard 只看 current role；切换无 hand 判据）→
//     primitive-requests/core-inv-90093-samuel-blake-role-lock.json；
//     平行萝拉 90087 的切换入口已按「在手即禁止」实现（近似覆盖部分读点）。
//   · 险境：cards-data 已有的关键字，无引擎行为读点需求（由遭遇/显现流程使用；本卡无显现）。

const code = '90093'

export default {
  code,
  weaknessStaysInHand: true,
  playableWeakness: true,
  weaknessHandNote: '「塞缪尔·布莱克」留在手中：你不能切换角色，也不能打出属于其他角色的卡牌；可支付 3 资源将他打出（进入盟友槽）。',
  abilities: [],
  modifiers: [],
  note: '待原语：手牌中的弱点限制角色切换与「打出其它角色卡」需要引擎 stats.lolaCanUseCard / 切换入口加入手牌判据（primitive-requests/core-inv-90093-samuel-blake-role-lock.json）；在场上时的切换恐惧由 90087 覆盖平行萝拉。',
}
