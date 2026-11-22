// 12102 后有追兵（Pursued）· 中立 · 诡计/恐惧 · 基础弱点。
//
// 卡面：
//   显现 - 将后有追兵放置入场，位于你的威胁区域。
//   强制 - 敌人进入你的地点后（移动进入或生成在你的地点）：受到 1 点恐惧。
//   [action][action]：弃掉后有追兵。
//
// 引擎读点：
//   · 显现 + 摆脱行动：weakness 描述子的 `{ type: 'threat', discardCost: { action: 2 } }`
//     （weakness.js 进威胁区域；moves.js 从 getThreatEffect(...).discardCost 枚举「弃掉威胁」行动，
//     actions-extra.js#doDiscardThreat 结算，2 行动由 cost 声明）。
//   · 「敌人进入你的地点后」两个入口都接到：
//     - 移动进入 → `enemyEnteredLocation` 窗口（movement.js#dispatchEnemyMovement）；
//     - 生成在你的地点 → `enemySpawn` 窗口（enemies.js#enterExistingEnemy，context 带 location/enemy）。
//     威胁区卡的强制能力由 openAbilityWindow 逐座位派发；一条描述子挂两个 trigger，
//     同一事件只会有其中一个窗口，不会重复结算。
//   · 受到 1 点恐惧：api.horror（普通恐惧，可分配给支援）。

const code = '12102'

export default {
  code,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入你的威胁区域；可用两个行动弃掉',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
    {
      kind: 'forced',
      trigger: ['enemyEnteredLocation', 'enemySpawn'],
      label: '敌人进入你的地点后（移动进入或生成在此）：受到 1 点恐惧',
      criteria: [({ inv, context }) => Boolean(context?.enemy) && context?.location === inv.location],
      resolve: ({ inv, api }) => api.horror(inv.seat, 1),
    },
  ],
  modifiers: [],
}
