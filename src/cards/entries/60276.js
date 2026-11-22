// 60276 解剖报告（Autopsy Report）
// 卡面：[reaction] 你所在地点的一个敌人被击败后，横置解剖报告：调查([intellect])。本次调查 +X[intellect]，
// 其中 X 为被击败敌人的印刷生命值（最多 +5）。
// 读点：reaction trigger defeatEnemy + cost.exhaust + api.investigate(skillBonus)（context.enemy 印刷生命值）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60276'

export default {
  code: CODE,
  abilities: [{
    kind: 'reaction',
    trigger: 'defeatEnemy',
    label: '所在地点敌人被击败后横置：调查 +X 智识（X=印刷生命值，最多 5）',
    cost: { exhaust: true },
    criteria: [({ inv, context }) => context?.location === inv.location && context?.enemy],
    resolve: ({ inv, context, api }) => {
      const enemy = context.enemy
      const printed = Number(enemy.health) || Number(api.cardDef?.(enemy.code)?.health) || 1
      const bonus = Math.min(5, Math.max(1, printed))
      api.investigate(inv.seat, { skillBonus: bonus, source: CODE })
    },
  }],
  modifiers: [],
}
