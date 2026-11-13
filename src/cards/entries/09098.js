// 09098 缟玛瑙五芒星（Onyx Pentacle）· 秘术师支援 · 4 经验。
// 卡面：[action] 躲避。本次躲避尝试使用你的[willpower]，或得到 +1[agility]。在你发动此能力时，选择一项——
//       - 横置缟玛瑙五芒星并在上面放置 1 个毁灭标记，以将你所在地点或连接地点的任意一个敌人作为对象，
//         且本次躲避尝试得到 +3 技能值。
//       - 如果你检定成功且超过难度至少 2 点，重整缟玛瑙五芒星并移除上面所有的毁灭标记。
//
// 与 09085 同句模板，升级版数值不同；读点相同。
const chooseEnemy = (state, inv, api, allowConnecting) => {
  const here = state.locations.find(location => location.id === inv.location)
  const connected = new Set(here?.connections || [])
  const targets = state.enemies.filter(enemy => allowConnecting
    ? enemy.location === inv.location || connected.has(enemy.location)
    : enemy.engagedSeat === inv.seat)
  if (!targets.length) return null
  if (targets.length === 1) return targets[0]
  const picked = api.choice({
    kind: 'target', source: '09098', seat: inv.seat, prompt: '选择要躲避的敌人。',
    options: targets.map(enemy => ({ id: enemy.id, label: `${enemy.name || enemy.code}（${api.locationName(enemy.location)}）` })),
  })
  return targets.find(enemy => enemy.id === picked) || targets[0]
}

export default {
  code: '09098',
  abilities: [
    {
      kind: 'action',
      label: '躲避：使用意志或 +1 敏捷；可横置放毁灭躲避连接地点敌人并 +3 技能值',
      cost: { action: true },
      countsAs: 'evade',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const mode = api.choice({
          kind: 'effect', source: '09098', seat: inv.seat,
          prompt: '在你发动此能力时选择一项。',
          options: [
            { id: 'doom', label: '横置并放置 1 个毁灭：可躲避连接地点的敌人且 +3 技能值' },
            { id: 'rider', label: '若成功且超过难度至少 2 点，重整并移除所有毁灭' },
          ],
        })
        const skill = api.choice({
          kind: 'effect', source: '09098', seat: inv.seat,
          prompt: '选择本次躲避使用的技能。',
          options: [
            { id: 'willpower', label: '使用意志' },
            { id: 'agility', label: '使用敏捷并获得 +1 敏捷' },
          ],
        }) === 'willpower' ? { skill: 'willpower', bonus: 0 } : { skill: 'agility', bonus: 1 }
        const enhanced = mode === 'doom' && !source.exhausted
        const enemy = chooseEnemy(state, inv, api, enhanced)
        if (!enemy) {
          api.info('「缟玛瑙五芒星」：没有可躲避的敌人。')
          return
        }
        if (enhanced) {
          api.exhaust(source)
          api.placeDoomOnCard(source, 1)
        }
        const result = api.evade(inv.seat, {
          enemyId: enemy.id,
          skill: skill.skill,
          bonus: skill.bonus + (enhanced ? 3 : 0),
          allowConnecting: enhanced,
        })
        const successBy = result ? Number(result.value || 0) - Number(result.difficulty || 0) : 0
        if (mode === 'rider' && result?.success && successBy >= 2) {
          api.ready(source)
          api.setAssetDoom(source, 0)
          api.info('🔯 「缟玛瑙五芒星」：成功超过难度 2 点，重整并移除所有毁灭标记。')
        }
      },
    },
  ],
  modifiers: [],
}
