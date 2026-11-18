// 10020 清理工具套装（Cleaning Kit）· 守卫者资产 · 0 经验 · 饰品槽
// 卡面：使用(3 补给)。
//       清理工具套装上的补给可以花费，如同是你控制的支援上的补给或子弹。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 使用次数：条目级 `uses: 3` / `usesType: 'supplies'`（newPlayerAssetInstance 初始化、
//     assetEffect 文案、执行完弃置都在这一组字段上）。
//   · 代付：`assetRule.shareSuppliesAs: ['supply', 'ammo']` 是「补给代付」的唯一声明读点
//     （use-transfer.js#useCostSources：目标支援的使用类型为 supply 或 ammo 时，把本支援的
//     supplies 一起算进可用来源；payUseCost 结算时按同一来源表扣减、并派发 sharedSuppliesSpent）。
//     条目自身没有主动/触发能力，因此 abilities 为空。
export default {
  code: '10020',
  name: 'Cleaning Kit',
  uses: 3,
  usesType: 'supplies',
  assetRule: { shareSuppliesAs: ['supply', 'ammo'] },
  abilities: [],
  modifiers: [],
}
