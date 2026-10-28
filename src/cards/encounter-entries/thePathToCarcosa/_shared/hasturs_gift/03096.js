// 03096 哈斯塔的傀儡
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：hasturs_gift
// 卡面：强制 - 在哈斯塔的傀儡与你交战后：你必须受到1点恐惧，或哈斯塔的傀儡得到+3攻击直到调查阶段结束。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// P2-6（2026-10-28）：+3 攻击改为引擎运行期敌人修正（enemy.statMods，读点 enemies.js 的
// runtimeEnemyStat），不再写 `enemy.puppetFightBonuses` 单卡字段、也不再在条目里声明 modifiers。

export default {
  code: '03096', implemented: true,
  name: '哈斯塔的傀儡',
  scope: 'enemy',
  text: '调查阶段，它的战斗值获得本轮累积的加值。',
  enemyScript: {
    onEngage(state, enemy, inv, api) {
      const choice = api.choose({
        kind: 'encounter', source: '03096', seat: inv.seat,
        prompt: '哈斯塔的傀儡与你交战：选择承受1点恐惧，或令其本调查阶段战斗+3。',
        options: [{ id: 'horror', label: '承受1点恐惧' }, { id: 'fight', label: '本调查阶段战斗+3' }],
      })
      if (choice === 'horror') api.horror(inv.seat, 1)
      else api.addEnemyStatModifier(enemy, { fight: 3 }, { until: 'investigationEnd' })
    },
  },
}
