// 04289 岌岌可危的悬崖
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：强制 - 在你位于岌岌可危的悬崖并尝试探索时：检定[willpower](4)。如果你检定失败，检定[agility](3)。如果你检定失败，检定[combat](2)。如果你检定失败，你坠入深渊，阵亡。(如果你在以上任一检定中成功，你如常探索。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 94 轮：幽嘶深渊的岌岌可危的悬崖。

export default {
  code: '04289', scope: 'location',
  locationRule: {
    beforeExplore(state, inv, api) {
      const tests = [['willpower', 4], ['agility', 3], ['combat', 2]]
      const outcome = { died: false }
      const run = index => {
        api.test(inv.seat, tests[index][0], tests[index][1], result => {
          if (result.success) { outcome.died = false; return }
          if (index + 1 < tests.length) { run(index + 1); return }
          outcome.died = true
          api.info?.(`岌岌可危的悬崖：${inv.name} 三次检定全部失败，坠入深渊身亡。`)
          api.defeat(inv, 'killed')
          const record = state.campaign?.investigators?.[inv.seat]
          if (record) record.status = 'killed'
        }, 0, { label: '岌岌可危的悬崖', ability: true })
      }
      run(0)
      return !outcome.died
    },
  },
}
