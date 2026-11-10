// 09018 查理·凯恩（Charlie Kane）· 中立 · 政客
// 卡面：
//   你有 3 个额外的盟友槽位。
//   [fast] 在你进行的一次技能检定期间，横置你控制的一名 [[盟友]] 支援：
//     本次检定获得 +1 技能值；该盟友每有一个与本次检定技能相匹配的图标，再 +1。
//   [elder_sign] 效果：+1。重整你控制的一名 [[盟友]] 支援。
//
// 读点：
//   · 额外盟友槽：investigator.extraSlots（assets.js#canEquip 容量读点）；
//   · 检定加成：free 能力 + duringOwnSkillTest + api.addTestValue；
//   · 重整：api.ready；图标数来自卡面数据（api.cardIcons 读取卡牌 icons 字段）。
export default {
  code: '09018',
  kind: 'investigator',
  investigator: {
    freeAction: {
      id: 'charlieExhaustAlly',
      cost: {},
      label: '⚡ 横置一名盟友：本次检定 +1，并按匹配图标数追加技能值',
      duringOwnSkillTest: true,
      resolve: ({ state, inv, api }) => {
        const allies = (inv.assets || []).filter(asset => !asset.exhausted
          && (api.cardTraits(asset.code) || []).some(trait => String(trait).toLowerCase() === 'ally'))
        if (!allies.length) return
        const target = allies.length === 1 ? allies[0] : allies[Number(api.choice({
          kind: 'target', source: '09018', seat: inv.seat, prompt: '选择要横置的盟友支援。',
          options: allies.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (!target) return
        api.exhaust(target)
        const skill = state.skillTest?.skill?.[0] || state.skillTest?.skill
        const icons = Object.entries(api.cardIcons(target.code)).filter(([icon]) => icon === skill || icon === 'wild')
          .reduce((sum, [, count]) => sum + (Number(count) || 0), 0)
        api.addTestValue(1 + icons)
      },
    },
 elderSign: { bonus: 1 }, extraSlots: { ally: 3 } },
  elderSign: {
    id: '09018-eldersign',
    label: '查理旧印：+1；重整你控制的一名盟友支援',
    resolve: ({ inv, api }) => {
      const allies = (inv.assets || []).filter(asset => (api.cardTraits(asset.code) || [])
        .some(trait => String(trait).toLowerCase() === 'ally') && asset.exhausted)
      if (allies.length) {
        const target = allies.length === 1 ? allies[0] : allies[Number(api.choice({
          kind: 'target', source: '09018', seat: inv.seat, prompt: '选择要重整的盟友支援。',
          options: allies.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (target) api.ready(target)
      }
      return { delta: 1 }
    },
  },
  abilities: [],
  modifiers: [],
}
