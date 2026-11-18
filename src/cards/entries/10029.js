// 10029 净化（Purified）· 守护者技能 · 0 经验 · 天赋/祝福
// 卡面：每次技能检定最多投入 1 张。
//       你可以将净化投入任意类型的检定。
//       如果本次检定成功，你每超过难度 1 点（最多 5 点），在混乱袋中加入 1 个[bless]标记，
//       或从混乱袋中移除 1 个[curse]标记。
//
// 读点（卡面 → 引擎）：
//   · 「任意类型的检定」= commit 档案 skill.anySkill（tests.js 的投入候选过滤器读它；
//     这张牌的印刷图标为 0，没有 anySkill 时根本不会出现在任何投入列表里）；
//   · 「每次检定最多 1 张」= skill.maxPerTest: 1（tests.js 的投入候选过滤器同名字段）；
//   · 成功点数结算 = commit 档案 skill.afterTest(ctx)：lifecycle.js#closeTest 在 ST.8 调用，
//     ctx.result 是标准检定结果（success / value / difficulty）。
//   混乱袋写入只经 api.addChaosToken / api.removeChaosToken（不直写 state.chaosBag）。
const CODE = '10029'
const BLESS = 'bless'
const CURSE = 'curse'
const MAX_POINTS = 5

function purify({ state, inv, result, api }) {
  if (!result?.success) return
  const successBy = Math.max(0, Number(result.value ?? 0) - Number(result.difficulty ?? 0))
  const points = Math.min(MAX_POINTS, successBy)
  if (!points) return
  let added = 0
  let removed = 0
  for (let index = 0; index < points; index += 1) {
    const curseInBag = (state.chaosBag || []).includes(CURSE)
    const options = [{ id: BLESS, label: '加入 1 个祝福标记' }]
    if (curseInBag) options.push({ id: CURSE, label: '移除 1 个诅咒标记' })
    const pick = options.length === 1 ? BLESS : api.choice({
      kind: 'chaosToken', source: CODE, seat: inv.seat,
      prompt: `净化：本次检定成功 ${points} 点（还可净化 ${points - index} 次）。`,
      options,
    })
    if (pick === CURSE && (state.chaosBag || []).includes(CURSE)) {
      api.removeChaosToken(CURSE)
      removed += 1
    } else {
      api.addChaosToken(BLESS)
      added += 1
    }
  }
  const parts = []
  if (added) parts.push(`加入 ${added} 个祝福标记`)
  if (removed) parts.push(`移除 ${removed} 个诅咒标记`)
  if (parts.length) api.info(`🕊 净化：${inv.name} ${parts.join('、')}。`)
}

export default {
  code: CODE,
  name: 'Purified',
  abilities: [
    {
      kind: 'commit',
      label: '净化：可投入任意检定；成功后每超出难度 1 点净化 1 次（最多 5 次）',
      skill: { anySkill: true, maxPerTest: 1, afterTest: purify },
    },
  ],
  modifiers: [],
}
