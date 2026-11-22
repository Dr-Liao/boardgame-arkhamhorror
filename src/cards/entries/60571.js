// 60571 野外处理 · 事件（2 费，1 经验，快速，意志图标，精魂）
// 卡面：快速。你所在地点的一个[[生物]]或[[怪物]]敌人被击败后打出。
//       治愈你所在地点调查员和/或[[盟友]]支援总计最多 3 点伤害。
const CODE = '60571'
const isCreatureOrMonster = enemy => (enemy?.traits || []).some(trait =>
  ['creature', 'monster'].includes(String(trait).toLowerCase()))

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'defeatEnemy',
    label: '治愈所在地点调查员和/或盟友总计最多 3 点伤害',
    criteria: [({ inv, context }) => {
      const enemy = context?.enemy
      if (!enemy) return false
      return enemy.location === inv.location || !enemy.location
        ? isCreatureOrMonster(enemy) || !enemy.traits
        : false
    }],
    resolve: ({ state, inv, api }) => {
      let remaining = 3
      const locations = state.locations || []
      const here = inv.location
      for (let guard = 0; remaining > 0 && guard < 3; guard += 1) {
        const allies = (inv.assets || []).filter(asset => {
          const traits = api.cardTraits(asset.code).map(trait => String(trait).toLowerCase())
          return traits.includes('ally') && (asset.damage || 0) > 0
        })
        const options = []
        if ((inv.damage || 0) > 0) options.push({ id: 'self', label: `${inv.name}（伤害 ${inv.damage}）` })
        for (const ally of allies) options.push({ id: ally.id, label: `${api.cardName(ally.code)}（伤害 ${ally.damage}）` })
        if (!options.length) break
        const picked = options.length === 1 ? options[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, canSkip: true,
          prompt: `野外处理：治愈 1 点伤害（剩余 ${remaining} 点）。`,
          options: [{ id: 'skip', label: '停止治愈' }, ...options],
        })
        if (!picked || picked === 'skip') break
        if (picked === 'self') api.healDamage(inv.seat, 1)
        else {
          const ally = (inv.assets || []).find(asset => asset.id === picked)
          if (ally) api.healAsset(ally, { damage: 1 })
        }
        remaining -= 1
      }
    },
  }],
  modifiers: [],
}
