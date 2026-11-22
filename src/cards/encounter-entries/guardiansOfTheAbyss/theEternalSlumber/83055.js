// 83055 约翰和杰西·伯克（John & Jessie Burke）
// 归属：关卡专用 · guardiansOfTheAbyss/theEternalSlumber（永恒沉睡）· 遭遇组 abyssal_tribute
// 卡面：[action] 横置约翰和杰西·伯克，并对其造成 1 点伤害：选择连接地点的一个敌人。
//       移动到该敌人所在地点，然后与其交战并对其造成 1 点伤害。
//
// 读点：encyclopedia 条目 action 描述子（cost.exhaust + cost.assetDamage 由引擎能力费用入口扣除）；
//   resolve 内用 api.choice 选连接地点的敌人，api.moveInvestigator / api.engage / api.damageEnemy
//   全部走 ctx.api（R1 合规）。
export default {
  code: '83055',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  abilities: [
    {
      kind: 'action',
      actionKind: 'activate',
      label: '横置并造成 1 点伤害：移动到连接地点的一个敌人处，与其交战并造成 1 点伤害',
      cost: { action: true, exhaust: true, assetDamage: 1 },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const connected = new Set(here?.connections || [])
        const targets = (state.enemies || []).filter(enemy => !enemy.defeated
          && enemy.location !== inv.location && connected.has(enemy.location))
        if (!targets.length) { api.info('连接地点没有敌人。'); return }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '83055', seat: inv.seat, prompt: '选择连接地点的一个敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        if (!enemy) return
        api.moveInvestigator(inv.seat, enemy.location)
        api.engage(enemy, inv.seat)
        api.damageEnemy(enemy, 1, inv.seat, '83055')
        api.info(`${inv.name} 与「${enemy.name}」交战并对其造成 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
