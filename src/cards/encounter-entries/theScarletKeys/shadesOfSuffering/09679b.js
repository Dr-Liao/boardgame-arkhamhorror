// 09679b 朱三娘（Tzu San Niang · Out for Blood · 血债血偿）· 敌人 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。物理卡 09679 的另一面（正面 09679a）。
// 卡面：
//   猎手。反击。
//   朱三娘得到 +2[per_investigator]生命值。
//   强制 - 你尝试攻击或躲避朱三娘时，在你技能检定成功时：你每超过难度 1 点，移除影穑的 1 充能。
//     受到等于移除充能数量的伤害和/或恐惧，尽可能平均分配。
//
// 读点（章节 behavior，条目只声明数据）：
//   · `enemyRule.hunter/retaliate/healthPerPlayerBonus`：翻面时 behavior.flipTzuOutForBlood 读它们
//     重算生命值（印刷字段由 physical-faces 换面，不含每人数加成）；
//   · 「移除充能 + 平均分配伤害/恐惧」→ behavior.drainShadeReaperOnSuccess（读 `drainsShadeReaperOnSuccess`）；
//   · 胜利 1 来自印刷数据（definition / 翻面时写入实例）。
export default {
  code: '09679b',
  name: '朱三娘',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    hunter: true,
    retaliate: true,
    healthPerPlayerBonus: 2,
    drainsShadeReaperOnSuccess: true,
    unique: true,
  },
  note: 'approximation: 成功后的伤害/恐惧分配在「奇数」时由调查员选择 1 点归属（卡面「尽可能平均」），'
    + '偶数直接平分；充能来源是场景旗标 `shadeReaperCharges`（见 primitive-requests/extend-scarlet-key-charges.json）。',
}
