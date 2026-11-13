// 09085 缟玛瑙五芒星（Onyx Pentacle）· 秘术师支援 · 0 经验。
// 卡面：[action] 躲避。本次躲避尝试使用你的[willpower]，或得到 +1[agility]。在你发动此能力时，选择一项——
//       - 横置缟玛瑙五芒星并在上面放置 1 个毁灭标记，以将你所在地点或连接地点的任意一个敌人作为对象，
//         且本次躲避尝试得到 +1 技能值。
//       - 如果你检定成功且超过难度至少 2 点，移除缟玛瑙五芒星的 1 个毁灭标记。
//
// 读点：api.evade（skill/bonus/allowConnecting）；毁灭写点。
//
// P1-8（2026-11-13）：目标枚举必须与引擎 doEvade 的 canEvade 对齐（combat.js:552-554：已交战 /
//   同地点庞大 / allowConnecting 的连接地点敌人），否则旧实现会先横置+放毁灭再静默失败。
//   卡面「你所在地点的任意敌人」在同地点未交战时先用引擎的交战原语 api.engage 纳入 canEvade；
//   支付费用（横置/毁灭）放在目标确定且可躲避之后。
const CODE = '09085'
const isLocal = (state, inv, enemy) => enemy.location === inv.location
const connectedOf = (state, inv) => new Set(state.locations.find(location => location.id === inv.location)?.connections || [])

const chooseEnemy = (state, inv, api, enhanced) => {
  const connected = connectedOf(state, inv)
  const targets = state.enemies.filter(enemy => {
    if (!enemy || enemy.defeated) return false
    if (enemy.engagedSeat === inv.seat) return true
    if (enemy.massive === true && isLocal(state, inv, enemy)) return true
    if (!enhanced) return false
    // 强化模式：卡面允许「你所在地点或连接地点的任意敌人」。
    // 同地点未交战敌人用 api.engage 纳入 canEvade；连接地点的敌人走 allowConnecting。
    return isLocal(state, inv, enemy) || connected.has(enemy.location)
  })
  if (!targets.length) return null
  if (targets.length === 1) return targets[0]
  const picked = api.choice({
    kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要躲避的敌人。',
    options: targets.map(enemy => ({ id: enemy.id, label: `${enemy.name || enemy.code}（${api.locationName(enemy.location)}）` })),
  })
  return targets.find(enemy => enemy.id === picked) || targets[0]
}

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      label: '躲避：使用意志或 +1 敏捷；可横置放毁灭以躲避连接地点的敌人并获得 +1 技能值',
      cost: { action: true },
      countsAs: 'evade',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const mode = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '在你发动此能力时选择一项。',
          options: [
            { id: 'doom', label: '横置并放置 1 个毁灭：可躲避连接地点的敌人且 +1 技能值' },
            { id: 'rider', label: '若成功且超过难度至少 2 点，移除 1 个毁灭' },
          ],
        })
        const skill = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
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
        // 强化模式目标「同地点未交战」：先按规则交战，使 doEvade 的 canEvade 成立。
        if (enhanced && isLocal(state, inv, enemy) && enemy.engagedSeat !== inv.seat && enemy.massive !== true) {
          api.engage(enemy, inv.seat)
          if (enemy.engagedSeat !== inv.seat) {
            api.info(`「缟玛瑙五芒星」：无法与「${enemy.name || enemy.code}」交战，本次不结算。`)
            return
          }
        }
        if (enhanced) {
          api.exhaust(source)
          api.placeDoomOnCard(source, 1)
        }
        const result = api.evade(inv.seat, {
          enemyId: enemy.id,
          skill: skill.skill,
          bonus: skill.bonus + (enhanced ? 1 : 0),
          allowConnecting: enhanced,
        })
        const successBy = result ? Number(result.value || 0) - Number(result.difficulty || 0) : 0
        if (mode === 'rider' && result?.success && successBy >= 2 && (source.doom || 0) > 0) {
          api.removeDoomFromCard(source, 1)
          api.info('🔯 「缟玛瑙五芒星」：成功超过难度 2 点，移除 1 个毁灭标记。')
        }
      },
    },
  ],
  modifiers: [],
}
