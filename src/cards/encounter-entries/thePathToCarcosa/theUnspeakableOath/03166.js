// 03166 出逃计划
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：忽略阿卡姆疯人院地点未揭示面上的文字。
// 卡面：目标 - 如果调查员达成了以下条件中的4个，你必须推进场景。
// 卡面：- “获知了守卫的巡逻路线。”
// 卡面：- “在厨房放了火。”
// 卡面：- “煽动病人互相攻击。”
// 卡面：- “释放了一个危险的病人。”
// 卡面：- “想起了出去的路。”
// 卡面：- “分散了守卫的注意力。”
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03166', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const underAct = state.scenarioZones.underAct.splice(0)
      const discardedMonsters = state.encounterDiscard.filter(code =>
        state.scenario.enemies[code]?.traits?.includes('Monster')).length
      if (underAct.length + discardedMonsters >= 3) {
        state.encounterDeck.push(...underAct)
        api.shuffleDiscard()
        const index = state.encounterDeck.findLastIndex(code =>
          state.scenario.enemies[code]?.traits?.includes('Monster'))
        if (index >= 0) {
          const monster = state.encounterDeck.splice(index, 1)[0]
          const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
          const lowest = Math.min(...active.map(inv => inv.willpower))
          const candidates = active.filter(inv => inv.willpower === lowest)
          const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
            kind: 'target', source: '03166', seat: state.campaign.leadSeat,
            prompt: '选择一位意志最低的调查员抽取怪物。',
            options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
          }))
          api.spawn(monster, state.investigators[seat].location)
        }
      } else {
        state.encounterDeck.push(...underAct)
        api.shuffleDiscard()
      }
    },
  },
}
