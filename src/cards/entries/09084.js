// 09084 圣杯（Hallowed Chalice）· 秘术师支援 · 0 经验。
// 卡面：[action] 选择你所在地点的一位调查员并（选择一项）——
//       - 横置圣杯并在上面放置 1 个毁灭标记，以治愈该调查员的 2 点伤害或 2 点恐惧。
//       - 治愈该调查员的 1 点伤害或 1 点恐惧。如果你完全治愈了该调查员的伤害或恐惧，
//         移除圣杯的 1 个毁灭标记。
//
// 读点：目标选择 target.kind='investigator'（含自己）；治疗走 api.healDamage / api.healHorror；
//       毁灭写点 placeDoomOnCard / removeDoomFromCard。
const healKind = (inv, api) => api.choice({
  kind: 'effect', source: '09084', seat: inv.seat,
  prompt: '选择要治疗的伤害或恐惧。',
  options: [{ id: 'damage', label: '治疗伤害' }, { id: 'horror', label: '治疗恐惧' }],
})

export default {
  code: '09084',
  abilities: [
    {
      kind: 'action',
      label: '选择同地点调查员：横置放毁灭治疗 2 点，或治疗 1 点并在完全治愈时移除 1 个毁灭',
      cost: { action: true },
      target: { kind: 'investigator' },
      resolve: ({ inv, source, target, api }) => {
        const chosen = target?.entity
        if (!source || !chosen) return
        const mode = api.choice({
          kind: 'effect', source: '09084', seat: inv.seat,
          prompt: '选择圣杯的治疗方式。',
          options: [
            { id: 'greater', label: '横置并放置 1 个毁灭：治疗 2 点' },
            { id: 'lesser', label: '治疗 1 点（完全治愈时移除 1 个毁灭）' },
          ],
        })
        const kind = healKind(inv, api)
        if (mode === 'greater' && !source.exhausted) {
          api.exhaust(source)
          api.placeDoomOnCard(source, 1)
          if (kind === 'damage') api.healDamage(chosen.seat, 2)
          else api.healHorror(chosen.seat, 2)
          api.info(`🍷 「圣杯」：治疗 ${chosen.name} 2 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
          return
        }
        if (kind === 'damage') api.healDamage(chosen.seat, 1)
        else api.healHorror(chosen.seat, 1)
        const fullyHealed = kind === 'damage' ? (chosen.damage || 0) === 0 : (chosen.horror || 0) === 0
        if (fullyHealed && (source.doom || 0) > 0) {
          api.removeDoomFromCard(source, 1)
          api.info('🍷 「圣杯」：完全治愈，移除 1 个毁灭标记。')
        } else {
          api.info(`🍷 「圣杯」：治疗 ${chosen.name} 1 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
        }
      },
    },
  ],
  modifiers: [],
}
