// 04104 枪法如神
// 卡面：快速。在你激活[[枪械]]或[[远程]]支援上的攻击能力时打出。
// 卡面：本次攻击可以选择一个连接地点上的一个敌人作为目标。本次攻击忽略冷漠和反击关键词。如果本次攻击的敌人未与你交战，且你攻击成功，本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04104 枪法如神：攻击连接地点上的敌人，忽略冷漠与反击。

export default {
  code: '04104',
  abilities: [
    {
      kind: 'played', fast: true, label: '枪法如神',
      resolve: ({ state, inv, api }) => {
        const weapons = inv.assets.filter(card => api.cardTraits(card.code)
          .some(trait => ['firearm', 'ranged'].includes(String(trait).toLowerCase())))
        const here = state.locations.find(location => location.id === inv.location)
        const reachable = new Set([inv.location, ...(here?.connections || [])])
        const targets = state.enemies.filter(enemy => reachable.has(enemy.location))
        if (!targets.length) { api.info('连接地点上没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04104', seat: inv.seat,
            prompt: '选择要射击的敌人（可在连接地点）。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const weaponPick = weapons.length === 1 ? weapons[0]
          : weapons.length ? weapons.find(card => card.id === api.choice({ kind: 'target', source: '04104', seat: inv.seat,
            prompt: '选择使用的枪械或远程支援。',
            options: weapons.map(card => ({ id: card.id, label: api.cardName(card.code) })) })) : null
        if (!weaponPick) { api.info('你没有可用于「枪法如神」的枪械或远程支援。'); return }
        const bonus = enemy.engagedSeat !== inv.seat ? 1 : 0
        api.info(`🎯 ${inv.name} 用「${api.cardName(weaponPick.code)}」瞄准「${enemy.name}」：忽略冷漠与反击${bonus ? '，并造成 +1 伤害' : ''}。`)
        api.fight(inv.seat, enemy.id, {
          assetId: weaponPick.id, atConnectingLocation: true, ignoreRetaliate: true, damageBonus: bonus,
        })
      },
    },
  ],
  modifiers: [

  ],
}
