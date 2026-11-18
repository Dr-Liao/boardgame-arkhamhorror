// 10678 大雨倾盆 · 诡计 · 共享遭遇组 the_second_day
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_second_day（印刷 3 张；theLongestNight / dawnOfTheSecondDay
//   等 5 章把本组洗进遭遇牌库）。
// 卡面（cards-data 10678）：[[危险]]。显现 - 检定[智力](3)。你检定失败且每低于难度 1 点，必须失去 1 个行动，
//   或将你的 1 个线索放到你所在地点。
//
// 读点：显现直接在本条目结算（encounterResolve，api = scenarioRuntime）。「把线索放到地点」拆成引擎已有的
//   两个写入口：api.loseClues(seat, 1) + api.addCluesToLocation(inv.location, 1)；没有线索时强制选失去行动。
const CODE = '10678'
const SKILL = 'intellect'
const DIFFICULTY = 3

function placeOneClue(state, seat, api) {
  const owner = state.investigators?.[seat]
  const locationId = owner?.location
  if (!locationId || (owner.clues || 0) < 1) return false
  api.loseClues(seat, 1)
  api.addCluesToLocation(locationId, 1)
  return true
}

function resolveRevelation(state, inv, api) {
  const seat = inv?.seat
  if (!Number.isInteger(seat)) return false
  api.test(seat, SKILL, DIFFICULTY, result => {
    if (result?.success) {
      api.info?.(`✔️ ${inv.name} 通过「大雨倾盆」检定（智力 ${result.value} vs ${DIFFICULTY}）。`)
      return
    }
    const failedBy = Math.max(0, Number(result?.difficulty ?? DIFFICULTY) - Number(result?.value ?? 0))
    for (let index = 0; index < failedBy; index += 1) {
      const owner = state.investigators?.[seat]
      if (!owner || owner.defeated || owner.resigned) return
      const canPlaceClue = (owner.clues || 0) > 0
      const answer = canPlaceClue
        ? api.choice({
          kind: 'effect', source: CODE, seat,
          prompt: `「大雨倾盆」：失去 1 个行动，或把 1 个线索放到你所在地点（剩余 ${failedBy - index} 次）。`,
          options: [{ id: 'action', label: '失去 1 个行动' }, { id: 'clue', label: '把 1 个线索放到地点' }],
        })
        : 'action'
      if (answer === 'clue' && placeOneClue(state, seat, api)) continue
      api.loseActions(seat, 1)
    }
  }, 0, { code: CODE, label: '遭遇检定', name: '大雨倾盆' })
  return false
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    test: { skill: SKILL, difficulty: DIFFICULTY },
    failByChoicePerPoint: ['loseAction', 'placeClueHere'],
    quantity: 3,
  },
  encounterResolve(state, inv, card, api) {
    void card
    return resolveRevelation(state, inv, api)
  },
  note: '显现自足实现（api.test + 逐失败点 api.choice）；「放线索」= api.loseClues + api.addCluesToLocation；无线索时强制失去行动。',
}
