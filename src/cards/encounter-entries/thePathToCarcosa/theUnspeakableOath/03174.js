// 03174 医务室
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[action]：治愈1点伤害并受到1点直接恐惧；或治愈1点恐惧并受到1点直接伤害。(每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03174', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      if (state.scenarioFlags.infirmaryRound === state.round) return
      moves.push({ action: 'scenarioAction', rule: 'infirmary', label: '使用医务室' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'infirmary') return false
      state.scenarioFlags.infirmaryRound = state.round
      const answer = api.choose({
        kind: 'location', source: '03174', seat: inv.seat, prompt: '选择医务室的治疗。',
        options: [{ id: 'damage', label: '治疗 1 伤害，受到 1 直接恐惧' }, { id: 'horror', label: '治疗 1 恐惧，受到 1 直接伤害' }],
      })
      if (answer === 'damage') {
        inv.damage = Math.max(0, inv.damage - 1)
        api.directHorror(inv.seat, 1)
      } else {
        inv.horror = Math.max(0, inv.horror - 1)
        api.directDamage(inv.seat, 1)
      }
      return true
    },
  },
}
