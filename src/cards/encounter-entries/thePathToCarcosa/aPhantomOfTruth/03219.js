// 03219 巴黎圣母院
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：位于巴黎圣母院的每个敌人得到-1攻击与+1躲避。
// 卡面：[action]：检定[willpower](6)。如果你检定成功，在当前密谋上放置1个毁灭标记，或从当前密谋上移除1个毁灭标记。(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 巴黎圣母院（03219）：每场游戏一次的意志（6）检定为毁灭标记。

export default {
  code: '03219', scope: 'location',
  modifiers: [
    // 位于巴黎圣母院的每个敌人 -1 攻击、+1 躲避（地点作为修正来源）。
    { target: 'enemyFight', amount: -1 },
    { target: 'enemyEvade', amount: 1 },
  ],
  locationRule: {
    actions({ state, moves }) {
      const used = Boolean(state.scenarioFlags?.notreDameUsed)
      moves.push({ action: 'scenarioAction', rule: 'notreDameDoom',
        label: '检定意志（6），放置或移除1个毁灭',
        reason: used ? '本场游戏已使用（团队每场游戏仅限一次）' : null, used: used || undefined })
    },
  },
}
