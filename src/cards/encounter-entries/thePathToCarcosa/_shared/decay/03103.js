// 03103 蟑螂群
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：decay
// 卡面：X为蟑螂群所在地点的隐藏值。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 蟑螂群（03103）：战斗值等于所在地点的帷幕（含帷幕修正）。
// 迁移自 thePathToCarcosa/encounter-rules.js 的 enemyStatModifier 分支。

export default {
  code: '03103', implemented: true,
  name: '蟑螂群',
  scope: 'enemy',
  text: '它的战斗值等于所在地点的帷幕（含帷幕修正）。',
  modifiers: [{
    target: 'enemyFight',
    amount: ({ state, entity }) => {
      const location = (state.locations || []).find(candidate => candidate.id === entity.location)
      return (location?.shroud || 0) + (location?.shroudMod || 0) - (entity.fight || 0)
    },
  }],
}
