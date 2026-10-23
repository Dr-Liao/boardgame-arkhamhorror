// 05017 兜帽人
// 卡面：猎物 - 仅对丽塔·杨。
// 卡面：警戒。猎手。
// 卡面：强制 - 在你躲避兜帽人后：其攻击你。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 敌人型弱点：条目用 scope: 'enemy' 声明，这样引擎按「场上实体」枚举它的强制能力
// （读点：src/engine/ability-rules.js 的 entityAbilityEntry）。

export default {
  code: '05017',
  scope: 'enemy',
  enemyWeakness: { hunter: true, alert: true, prey: 'bearer' },
  abilities: [
    {
      kind: 'forced',
      trigger: 'evadeSuccess',
      label: '被躲避后攻击你',
      silent: false,
      criteria: [({ inv, context }) => context?.enemy?.code === '05017'
        && (context?.enemy?.engagedSeat == null || context.enemy.engagedSeat === inv.seat)],
      resolve: ({ api, context }) => {
        api.enemyAttackByCard(context.enemy, '兜帽人的攻击', context.seat)
      },
    },
  ],
  modifiers: [],
}
