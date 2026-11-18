// 10680 异界幻象 · 诡计 · 共享遭遇组 the_final_day
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_final_day（印刷 3 张；fateOfTheVale / preludeTheFinalEvening
//   等 4 章把本组洗进遭遇牌库）。
// 卡面（cards-data 10680）：[[恐怖]]。[[力量]]。显现 - 检定[意志](3)。如果你所在地点有[[色彩]]敌人，
//   本次检定难度 +2。你检定失败且每低于难度 1 点，必须受到 1 点恐惧，或弃掉你随机 1 张手牌。
//
// 读点：显现直接在本条目结算（encounterResolve，api = scenarioRuntime）。
//   · 「[[色彩]]敌人」读 state.enemies 的 traits（只读；traits 来自卡表，比较时统一小写）；
//   · 「随机弃 1 张手牌」走引擎 api.discardRandom(seat, 1)（能力面的别名是 discardRandomFromHand）；
//   · 手牌为空时强制选恐惧。
const CODE = '10680'
const SKILL = 'willpower'
const BASE_DIFFICULTY = 3
const COLOUR_DIFFICULTY_BONUS = 2

const traitsOf = (state, enemy) => (enemy?.traits || state.scenario?.enemies?.[enemy?.code]?.traits || [])
const isColour = (state, enemy) => traitsOf(state, enemy)
  .some(trait => String(trait).toLowerCase() === 'colour')
const colourEnemyHere = (state, inv) => (state.enemies || [])
  .some(enemy => !enemy.defeated && enemy.location === inv?.location && isColour(state, enemy))

function discardRandomCard(api, seat) {
  if (typeof api.discardRandom === 'function') api.discardRandom(seat, 1)
  else api.discardRandomFromHand?.(seat, 1)
}

function resolveRevelation(state, inv, api) {
  const seat = inv?.seat
  if (!Number.isInteger(seat)) return false
  const difficulty = BASE_DIFFICULTY + (colourEnemyHere(state, inv) ? COLOUR_DIFFICULTY_BONUS : 0)
  api.test(seat, SKILL, difficulty, result => {
    if (result?.success) {
      api.info?.(`✔️ ${inv.name} 通过「异界幻象」检定（意志 ${result.value} vs ${difficulty}）。`)
      return
    }
    const failedBy = Math.max(0, Number(result?.difficulty ?? difficulty) - Number(result?.value ?? 0))
    for (let index = 0; index < failedBy; index += 1) {
      const owner = state.investigators?.[seat]
      if (!owner || owner.defeated || owner.resigned) return
      const canDiscard = (owner.hand || []).length > 0
      const answer = canDiscard
        ? api.choice({
          kind: 'effect', source: CODE, seat,
          prompt: `「异界幻象」：受到 1 点恐惧，或随机弃掉 1 张手牌（剩余 ${failedBy - index} 次）。`,
          options: [{ id: 'horror', label: '受到 1 点恐惧' }, { id: 'discard', label: '随机弃掉 1 张手牌' }],
        })
        : 'horror'
      if (answer === 'discard') discardRandomCard(api, seat)
      else api.horror(seat, 1)
    }
  }, 0, { code: CODE, label: '遭遇检定', name: '异界幻象' })
  return false
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Terror', 'Power'],
    test: { skill: SKILL, difficulty: BASE_DIFFICULTY },
    difficultyBonusIfColourEnemyHere: COLOUR_DIFFICULTY_BONUS,
    failByChoicePerPoint: ['takeHorror', 'discardRandomCard'],
    quantity: 3,
  },
  encounterResolve(state, inv, card, api) {
    void card
    return resolveRevelation(state, inv, api)
  },
  note: '显现自足实现：[[色彩]]敌人读 state.enemies.traits（难度 +2）；随机弃牌走 api.discardRandom；空手强制选恐惧。',
}
