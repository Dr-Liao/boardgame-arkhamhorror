// 03096 哈斯塔的傀儡
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：hasturs_gift
// 卡面：强制 - 在哈斯塔的傀儡与你交战后：你必须受到1点恐惧，或哈斯塔的傀儡得到+3攻击直到调查阶段结束。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 哈斯塔的傀儡（03096）：调查阶段，它的战斗值获得本轮累积的傀儡加值。

export default {
  code: '03096', implemented: true,
  name: '哈斯塔的傀儡',
  scope: 'enemy',
  text: '调查阶段，它的战斗值获得本轮累积的加值。',
  modifiers: [{
    target: 'enemyFight',
    amount: ({ state, entity }) => (state.phase === 'investigation'
      ? (entity.puppetFightBonuses || [])
        .filter(bonus => bonus.investigationRound === state.round)
        .reduce((sum, bonus) => sum + bonus.amount, 0)
      : 0),
  }],
  enemyScript: {
    onEngage(state, enemy, inv, api) {
      const choice = api.choose({
        kind: 'encounter', source: '03096', seat: inv.seat,
        prompt: '哈斯塔的傀儡与你交战：选择承受1点恐惧，或令其本调查阶段战斗+3。',
        options: [{ id: 'horror', label: '承受1点恐惧' }, { id: 'fight', label: '本调查阶段战斗+3' }],
      })
      if (choice === 'horror') api.horror(inv.seat, 1)
      else {
        const investigationRound = ['enemy', 'upkeep'].includes(state.phase) ? state.round + 1 : state.round
        enemy.puppetFightBonuses ||= []
        enemy.puppetFightBonuses.push({ amount: 3, investigationRound })
      }
    },
  },
}
