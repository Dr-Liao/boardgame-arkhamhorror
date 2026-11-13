// 09679a 朱三娘（Tzu San Niang · The Lady with the Red Parasol · 红伞夫人）· 敌人 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。同一张物理卡的另一面是 09679b
// （朱三娘 · Out for Blood · 血债血偿），两面都是敌人面。
// 卡面：
//   隐匿 2。
//   强制 - 在朱三娘将要被击败时：改为治愈她的所有伤害，移除场上所有的毁灭标记，将她返回阴影中，
//     并结算她的隐匿关键词，在每个有非弱点[[灵怪]]敌人的地点中，尽可能平均地分发其隐匿迷你卡牌。
//
// 读点（章节 behavior，条目只声明数据）：
//   · 「隐匿 2」→ `enemyRule.concealed`（behavior.concealedAmountOf 的唯一读点；definition 也用同一值）；
//   · 「将要被击败」→ behavior.enemyDefeated 的 `returnsToShadowsWhenDefeated` 分支：
//     治愈全部伤害 → 移除场上所有毁灭 → 返回阴影 → 按 `distributesConcealedToGeistLocations` 重新分配；
//   · 真相迷你卡的 kind 用符号名 `TzuSanNiang`（隐匿原语要求字母开头）。
export default {
  code: '09679a',
  name: '朱三娘',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    concealed: 2,
    unique: true,
    returnsToShadowsWhenDefeated: true,
    distributesConcealedToGeistLocations: true,
  },
  note: 'approximation: 「返回阴影」用「移出战场 + 真身迷你卡重新分配」表达；'
    + '「移除场上所有毁灭」由 behavior.clearDoomInPlay 清掉密谋/敌人/支援上的毁灭（她自己的毁灭也清，'
    + '与参考实现 defaultRemoveDoomMatchers 同口径）。',
}
