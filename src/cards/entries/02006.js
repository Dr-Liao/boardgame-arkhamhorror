// 02006 佐伊的十字架
// 卡面：佐伊·萨马拉斯牌库专用。
// 卡面：[reaction]一个敌人与你交战后，横置佐伊的十字架并花费1资源：对该敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02006 佐伊的十字架：与敌人交战后横置并花 1 资源，对交战的敌人造成 1 点伤害。

export default {
  code: '02006',
  abilities: [
    {
      kind: 'reaction', trigger: 'enemyEngaged', id: 'zoeysCross', legacyReaction: true,
      label: '与敌人交战后造成 1 点伤害', cost: { exhaust: true, resources: 1 },
      // 目标固定为「刚与你交战的那个敌人」；不能在同地点其他交战敌人中改选。
      resolve: ({ state, context, api }) => {
        const enemy = context?.enemy
        if (!enemy || !state.enemies.includes(enemy)) return
        api.damageEnemy(enemy, 1, enemy.engagedSeat ?? state.currentSeat)
      },
    },
  ],
  modifiers: [

  ],
}
