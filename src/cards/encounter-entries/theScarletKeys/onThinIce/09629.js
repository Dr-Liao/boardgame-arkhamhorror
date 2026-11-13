// 09629 虚空奇美拉（Void Chimera · Gorefeaster / 尤嗜鲜血）· 敌人 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。
// 卡面（中）：猎手。虚空奇美拉（尤嗜鲜血）得到 +1[per_investigator]生命值。
//   强制 - 虚空奇美拉（尤嗜鲜血）攻击你后：查看你牌库顶的卡牌。如果不是弱点，将其放在一边，
//   位于场外，作为一个空洞，并治愈虚空奇美拉（尤嗜鲜血）等于该空洞印刷费用的伤害。
//
// 读点（章节 behavior，条目只声明数据）：
//   · behavior.enemyAttackResolved 读 `enemyRule.hollowDeckTopWhenAttacks`：每次它攻击结算完成后
//     调 behavior.hollowFromDeckTop（牌库顶 → 空洞原语），再按该空洞的印刷费用 `api.healEnemy`；
//   · 「+1[per_investigator] 生命值」→ definition `healthPerPlayerBonus: 1`；「猎手」→ 印刷关键字。
export default {
  code: '09629',
  name: '虚空奇美拉（尤嗜鲜血）',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    hunter: true,
    healthPerPlayerBonus: 1,
    hollowDeckTopWhenAttacks: true,
    healByHollowCost: true,
  },
  note: 'approximation: 「攻击你后」按引擎的 `enemyAttackResolved` 钩子结算（每次它完成一次攻击，'
    + '无论伤害是否被抵消）；「等于印刷费用的伤害」用 cards-data 的 `cost` 作为印刷费用，费用为空的卡按 0 治愈。',
}
