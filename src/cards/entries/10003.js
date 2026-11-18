// 10003 仓促修补（Hasty Repairs）· 诡计 · 失误 · 威尔森·理查德专属弱点
// 卡面：
//   显现 - 将仓促修补放入你的威胁区域。
//   触发你控制的支援上的能力时，将你的基础技能值设为0。
//   [action][action]：弃掉仓促修补。
//
// 读点（卡面 → 引擎读点）：
//   · 显现进威胁区：`kind:'weakness'` + `weakness: { type: 'threat' }`，读点
//     src/engine/weakness.js#resolveWeaknessBody 的 threat 分支（与 09003/01098 同形）。
//   · 两行动弃掉：`weakness.discardCost = { action: 2 }` → moves.js 的 `discardThreat` 候选 +
//     turn-flow.js#actionCost（花 2 行动）+ actions-extra.js#doDiscardThreat（唯一结算点，与 01098 同形）。
//   · 「触发你控制的支援上的能力时，基础技能值设为 0」：引擎没有「把基础值覆盖为 X」的修正目标
//     （stats.js 的修正管线只有加法与 floor；api.setBaseSkillValue 只能按回合/阶段到期，
//     api.playerTools.baseSkillForTest 会顺带写入 07225 专用的 tokenRewards）。
//     因此用四条按技能的负修正近似：检定由「我控制的支援」发起（与 api.playerTools.testAssetSource
//     同源：skillTest.assetSourceId ?? skillTest.source.assetId ?? state._resolvingAssetId）期间，
//     把四项技能的印刷基础值各扣掉一份 → 合计基础值等价于 0，其余修正（例如 10001 对[[工具]]检定的 +1）
//     照常叠加，与「先把基础值设为 0、再走修正管线」的结果一致。
//     缺口：只抵消印刷基础值；05281 一类 `inv.statOverrides` 的临时基础值覆盖不在扣减范围内。
const SKILLS = Object.freeze(['willpower', 'intellect', 'combat', 'agility'])

const testAssetSourceId = state =>
  state?.skillTest?.assetSourceId
  ?? state?.skillTest?.source?.assetId
  ?? state?._resolvingAssetId
  ?? null

// 「触发你控制的支援上的能力时」：本次检定由某张本人控制的支援发起。
const duringOwnAssetAbility = (state, inv) => {
  if (!state?.skillTest) return false
  const sourceId = testAssetSourceId(state)
  if (sourceId == null) return false
  return (inv?.assets || []).some(asset => asset.id === sourceId)
}

const printedBase = (inv, skill) => Number(inv?.[skill]) || 0

export default {
  code: '10003',
  note: 'approximation: 引擎无「基础技能值覆盖为 X」的修正目标，用四条按技能的 -印刷基础值 修正等价实现（触发本人控制的支援能力期间）；statOverrides 形式的临时基值覆盖未纳入扣减。',
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'threat', discardCost: { action: 2 } },
      label: '显现：将「仓促修补」放入你的威胁区域',
    },
  ],
  modifiers: SKILLS.map(skill => ({
    target: `skill:${skill}`,
    amount: ({ inv }) => -printedBase(inv, skill),
    condition: { when: ({ state, inv }) => duringOwnAssetAbility(state, inv) },
  })),
}
