// 09083 寻龙尺（Dowsing Rod）· 秘术师支援 · 0 经验。
// 卡面：[action] 调查。本次调查使用你的[willpower]。或得到 +1[intellect]。在你发动此能力时，选择一项——
//       - 横置寻龙尺并在上面放置 1 个毁灭标记，以移动到一个连接地点。
//       - 如果本次调查发现了一个地点的最后一个线索，移除寻龙尺的 1 个毁灭标记。
//
// 读点：真实调查检定 api.investigate（skill / bonus / onInvestigateSuccess）；
//       移动 api.moveInvestigator；毁灭写点 placeDoomOnCard / removeDoomFromCard。
const chooseSkill = (inv, api) => api.choice({
  kind: 'effect', source: '09083', seat: inv.seat,
  prompt: '选择本次调查使用的技能。',
  options: [
    { id: 'willpower', label: '使用意志' },
    { id: 'intellect', label: '使用智识并获得 +1 智识' },
  ],
}) === 'willpower' ? { skill: 'willpower', bonus: 0 } : { skill: 'intellect', bonus: 1 }

export default {
  code: '09083',
  abilities: [
    {
      kind: 'action',
      label: '调查：使用意志或 +1 智识；可选择横置放毁灭先移动，或发现最后线索时移除毁灭',
      cost: { action: true },
      countsAs: 'investigate',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const base = chooseSkill(inv, api)
        const mode = api.choice({
          kind: 'effect', source: '09083', seat: inv.seat,
          prompt: '在你发动此能力时选择一项。',
          options: [
            { id: 'move', label: '横置并放置 1 个毁灭：先移动到一个连接地点' },
            { id: 'lastClue', label: '若本次调查发现最后一个线索，移除 1 个毁灭' },
          ],
        })
        if (mode === 'move' && !source.exhausted) {
          const here = state.locations.find(location => location.id === inv.location)
          const destinations = (here?.connections || []).map(id => ({ id, label: api.locationName(id) }))
          if (destinations.length) {
            const destination = destinations.length === 1 ? destinations[0].id : api.choice({
              kind: 'move', source: '09083', seat: inv.seat, prompt: '选择要移动到的连接地点。', options: destinations,
            })
            api.exhaust(source)
            api.placeDoomOnCard(source, 1)
            api.moveInvestigator(inv.seat, destination)
            api.info(`🔮 「寻龙尺」：移动到「${api.locationName(destination)}」。`)
          }
        }
        let lastClue = false
        const result = api.investigate(inv.seat, {
          skill: base.skill,
          bonus: base.bonus,
          onInvestigateSuccess: (r, context) => {
            lastClue = (context.loc?.clues || 0) <= 1
          },
        })
        if (mode === 'lastClue' && result?.success && lastClue && (source.doom || 0) > 0) {
          api.removeDoomFromCard(source, 1)
          api.info('🔮 「寻龙尺」：发现最后一个线索，移除 1 个毁灭标记。')
        }
      },
    },
  ],
  modifiers: [],
}
