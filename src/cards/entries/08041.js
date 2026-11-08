// 08041 通路档案
// 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
//       [free]：从本支援上移动 1 灵脉到一个非[[精英]]敌人。
//       [action]：选择一位调查员和一个在已揭示地点且带有灵脉的敌人。该调查员移动到该地点。
//       你可以移除该灵脉来对该敌人造成 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：没有通用「灵脉」标记原语（请求 m2-1-08033.json）。用支援上的 uses 记灵脉数
// （api.setAssetUses）；移动到敌人身上只扣 uses、不持久化敌人标记，因此行动选择「带有灵脉的敌人」
// 退化为任意已揭示地点的敌人；移除灵脉的伤害/额外效果按 uses 扣除表达。
export default {
  code: '08041',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场：获得 4 个灵脉（使用次数）',
      resolve: ({ source, api }) => {
        if (source) api.setAssetUses(source, 4)
      },
    },
    {
      kind: 'free',
      label: '从本支援移动 1 灵脉到一个非精英敌人',
      cost: { action: false },
      resolve: ({ state, inv, source, api }) => {
        if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
        const candidates = (state.enemies || []).filter(enemy => !enemy.elite)
        if (!candidates.length) return api.info('通路档案：没有非精英敌人。')
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '08041', seat: inv.seat,
          prompt: '通路档案：选择要放置灵脉的非精英敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = candidates.find(item => item.id === chosen) || candidates[0]
        api.setAssetUses(source, (source.uses || 0) - 1)
        api.info(`通路档案：把 1 灵脉移到「${enemy.name}」上（近似：仅扣减灵脉数）。`)
      },
    },
    {
      kind: 'action',
      label: '选择调查员与已揭示地点的敌人：移动该调查员；可移除灵脉造成 1 点伤害',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const investigators = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
        const enemies = (state.enemies || []).filter(enemy => {
          const location = (state.locations || []).find(item => item.id === enemy.location)
          return location?.revealed === true
        })
        if (!investigators.length || !enemies.length) return api.info('通路档案：没有合法的调查员/敌人。')
        const chosenInvestigator = investigators.length === 1 ? String(investigators[0].seat) : api.choice({
          kind: 'investigator', source: '08041', seat: inv.seat,
          prompt: '通路档案：选择要移动的调查员。',
          options: investigators.map(person => ({ id: String(person.seat), label: person.name })),
        })
        const person = investigators.find(item => String(item.seat) === String(chosenInvestigator)) || investigators[0]
        const chosenEnemy = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: '08041', seat: inv.seat,
          prompt: '通路档案：选择已揭示地点上的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === chosenEnemy) || enemies[0]
        api.moveInvestigator(person.seat, enemy.location)
        api.info(`通路档案：将 ${person.name} 移动到「${api.locName(enemy.location)}」。`)
        if ((source.uses || 0) > 0) {
          const remove = api.choice({
            kind: 'effect', source: '08041', seat: inv.seat, canSkip: true,
            prompt: '通路档案：是否移除 1 灵脉，对该敌人造成 1 点伤害？',
            options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉造成 1 点伤害' }],
          })
          if (remove === 'remove') {
            api.setAssetUses(source, (source.uses || 0) - 1)
            const current = (api.enemiesAt(enemy.location) || []).find(item => item.id === enemy.id)
            if (current) api.damageEnemy(current, 1, inv.seat)
          }
        }
      },
    },
  ],
  modifiers: [],
}
