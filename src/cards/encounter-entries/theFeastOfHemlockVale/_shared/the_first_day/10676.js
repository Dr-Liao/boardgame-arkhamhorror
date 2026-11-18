// 10676 虫群 · 诡计 · 共享遭遇组 the_first_day
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_first_day（印刷 3 张；12 章里有 4 章把本组洗进遭遇牌库）。
// 卡面（cards-data 10676）：[[危险]]。显现 - 检定[敏捷](3)。你检定失败且每低于难度 1 点，
//   必须失去 1 资源或受到 1 点伤害。（[[危险]] 是特质，不是关键词。）
//
// 读点：显现直接在本条目结算（encounterResolve 是引擎 treachery-tokens.js#resolveEntry 的唯一抽屉：
//   api = scenarioRuntime，检定走 api.test(seat, skill, difficulty, resolve) 的位置参数形式）。
//   「每失败 1 点二选一」用 api.choice 逐点询问；资源不足时强制选伤害。
//   没有剧情状态新增，写入全部走 ctx.api（loseResources / damage / info）。
const CODE = '10676'
const SKILL = 'agility'
const DIFFICULTY = 3

function resolveRevelation(state, inv, api) {
  const seat = inv?.seat
  if (!Number.isInteger(seat)) return false
  api.test(seat, SKILL, DIFFICULTY, result => {
    if (result?.success) {
      api.info?.(`✔️ ${inv.name} 通过「虫群」检定（敏捷 ${result.value} vs ${DIFFICULTY}）。`)
      return
    }
    const failedBy = Math.max(0, Number(result?.difficulty ?? DIFFICULTY) - Number(result?.value ?? 0))
    for (let index = 0; index < failedBy; index += 1) {
      const owner = state.investigators?.[seat]
      if (!owner || owner.defeated || owner.resigned) return
      const canPay = (owner.resources || 0) > 0
      const answer = canPay
        ? api.choice({
          kind: 'effect', source: CODE, seat,
          prompt: `「虫群」：失去 1 资源或受到 1 点伤害（剩余 ${failedBy - index} 次）。`,
          options: [{ id: 'resource', label: '失去 1 资源' }, { id: 'damage', label: '受到 1 点伤害' }],
        })
        : 'damage'
      if (answer === 'resource') api.loseResources(seat, 1)
      else api.damage(seat, 1)
    }
  }, 0, { code: CODE, label: '遭遇检定', name: '虫群' })
  // false = 显现结算完成后由引擎把本卡放进遭遇弃牌堆（与其它诡计条目同口径）。
  return false
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    test: { skill: SKILL, difficulty: DIFFICULTY },
    failByChoicePerPoint: ['loseResource', 'takeDamage'],
    quantity: 3,
  },
  encounterResolve(state, inv, card, api) {
    void card
    return resolveRevelation(state, inv, api)
  },
  note: '显现自足实现（api.test + 逐失败点 api.choice）；资源为 0 时强制选伤害（印刷二选一的确定化处理）。',
}
