// 83058 召来的夜魇（Summoned Nightgaunt）
// 归属：关卡专用 · guardiansOfTheAbyss/theNightsUsurper（夜之篡位者）· 遭遇组 abyssal_gifts
// 卡面：使用(3 哨声)。如果召来的夜魇没有哨声，或其离场，将其移出游戏。
//       [action] 花费 1 哨声并受到 1 点恐惧：躲避。自动躲避所有与你交战的非[[夜魇]]敌人，
//       并移动到任意已揭示地点。
//
// 读点：uses/usesType + cost.uses/cost.horror（能力费用入口）；api.autoEvade 自动躲避；
//   api.choice + api.moveInvestigator 选择任意已揭示地点。
// 近似：「没有哨声/离场时移出游戏」用 removeFromGameWhenEmpty 覆盖空哨声分支；
//   离场移出游戏（非空）未接线，见 status.json risks。
export default {
  code: '83058',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  leavesPlayTo: 'removed',
  uses: 3,
  usesType: 'whistles',
  removeFromGameWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      actionKind: 'evade',
      label: '花 1 哨声并受 1 恐惧：自动躲避所有交战中的非夜魇敌人，并移动到任意已揭示地点',
      cost: { action: true, uses: 1, horror: 1 },
      resolve: ({ state, inv, api }) => {
        const engaged = (state.enemies || []).filter(enemy => enemy.engagedSeat === inv.seat
          && !(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'nightgaunt'))
        for (const enemy of engaged) api.autoEvade(enemy)
        const revealed = (state.locations || []).filter(location => location.revealed !== false)
        if (!revealed.length) { api.info('没有已揭示地点可移动。'); return }
        const destination = revealed.length === 1 ? revealed[0].id : api.choice({
          kind: 'move', source: '83058', seat: inv.seat, prompt: '选择要移动到的已揭示地点。',
          options: revealed.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        api.moveInvestigator(inv.seat, destination)
        api.info(`${inv.name} 召唤夜魇：自动躲避 ${engaged.length} 名敌人并移动到「${api.locName(destination)}」。`)
      },
    },
  ],
  modifiers: [],
}
