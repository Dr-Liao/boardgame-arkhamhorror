// 03244 前途受阻
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：目标 - “告诉我们怎么阻止通路打开！”如果苍白面具下的男子被击败，推进场景。
// 卡面：目标 - “他想让我们看什么？”在暗影坟墓的调查员可以共同花费所需数量的线索以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03244', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const defeated = state.scenarioFlags.actTwoAdvancedWith === 'defeat'
      const records = state.campaign.records ||= {}
      const key = defeated ? 'conviction' : 'doubt'
      records[key] = Number(records[key] || 0) + 2
      const stranger = state.enemies.find(enemy => enemy.code === '03059')
      if (stranger) {
        state.enemies.splice(state.enemies.indexOf(stranger), 1)
        state.scenarioZones.removed.push('03059')
      }
      const nextCode = defeated ? '03245' : '03246'
      state.acts = [
        ...state.acts.slice(0, 2),
        structuredClone(state.scenario.acts.find(card => card.originalCode === nextCode)),
      ]
    },
  },
}
