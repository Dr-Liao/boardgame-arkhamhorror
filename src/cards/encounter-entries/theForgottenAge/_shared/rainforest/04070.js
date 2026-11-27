// 04070 河流峡谷
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：[action]：治愈河流峡谷一位调查员1点伤害。检查你的补给品。如果你带有水壶，治愈额外2点伤害。(每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 河流峡谷（04070）：每场游戏一次的「治愈」场景行动。

export default {
  code: '04070', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      const used = state.scenarioFlags?.riverCanyonHealed === true
      moves.push({
        action: 'scenarioAction', rule: 'healRiverCanyon',
        label: '💧 治愈河流峡谷的一位调查员 1 点伤害（有水壶再额外 2 点）',
        reason: used ? '本场游戏已使用（每场游戏仅限一次）' : null,
        used: used || undefined,
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'healRiverCanyon') return false
      if (state.scenarioFlags?.riverCanyonHealed) return false
      api.setScenarioFlag('riverCanyonHealed')
      const candidates = state.investigators.filter(entry =>
        !entry.defeated && !entry.resigned && entry.location === inv.location)
      const seat = candidates.length <= 1 ? candidates[0]?.seat : Number(api.choose({
        kind: 'investigator', source: 'riverCanyon', seat: inv.seat,
        prompt: '选择河流峡谷中要治愈的调查员。',
        options: candidates.map(entry => ({ id: String(entry.seat), label: entry.name })),
      }))
      const healed = candidates.find(entry => entry.seat === seat) || inv
      api.healDamage(healed.seat, 1)
      if (api.checkSupplies(inv.seat, 'canteen')) api.healDamage(healed.seat, 2)
      return true
    },
  },
}
