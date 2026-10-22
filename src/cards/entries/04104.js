// 04104 枪法如神
// 卡面：快速。在你激活[[枪械]]或[[远程]]支援上的攻击能力时打出。
// 卡面：本次攻击可以选择一个连接地点上的一个敌人作为目标。本次攻击忽略冷漠和反击关键词。
//       如果本次攻击的敌人未与你交战，且你攻击成功，本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04104 枪法如神：在 `activateFirearmFight` 窗口改写正在激活的那次攻击（不另起攻击）：
// 目标可改为连接地点上的敌人、忽略反击、未交战时命中 +1 伤害。战斗加值、伤害与弹药消耗
// 全部沿用被激活的枪械/远程支援。

export default {
  code: '04104',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'activateFirearmFight', label: '枪法如神',
      resolve: ({ state, inv, context, api }) => {
        if (!context) return
        const here = state.locations.find(location => location.id === inv.location)
        const connecting = new Set(here?.connections || [])
        const targets = state.enemies.filter(enemy => connecting.has(enemy.location))
        if (targets.length) {
          const chosen = targets.length === 1 ? targets[0].id
            : api.choice({ kind: 'target', source: '04104', seat: inv.seat,
              prompt: '选择连接地点上的敌人作为本次攻击的目标。',
              options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
          const enemy = targets.find(item => item.id === chosen) || targets[0]
          context.redirectEnemyId = enemy.id
          api.info(`🎯 ${inv.name} 用「枪法如神」把攻击目标改为连接地点上的「${enemy.name}」。`)
        }
        // 本次攻击忽略冷漠与反击；攻击未与本人交战的敌人命中时 +1 伤害。
        context.allowConnecting = true
        context.ignoreRetaliate = true
        context.marksmanship = true
      },
    },
  ],
  modifiers: [

  ],
}
