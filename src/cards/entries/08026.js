// 08026 闪躲
// 卡面：快速。在一个敌人攻击你所在地点的一位调查员时打出。
//       取消该次攻击。然后，检定[agility](1)。如果你成功，对该敌人造成 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：快速事件挂在 enemyAttack 窗口（played + fast + trigger）；取消写回窗口上下文的
// cancelled（api.cancelCurrentAttack）；随后的一次敏捷(1)检定用 api.startTest（performTest），
// 成功后的伤害在 resolve 回调里执行。
export default {
  code: '08026',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyAttack',
      label: '取消该次攻击；敏捷(1)：成功则对该敌人造成 1 点伤害',
      resolve: ({ inv, api }) => {
        const raw = api.reactionContext()
        const context = raw?.context || raw
        const enemyId = context?.enemy?.id || null
        api.cancelCurrentAttack(context)
        api.info(`闪躲：取消了「${context?.enemy?.name || '敌人'}」的这次攻击。`)
        api.startTest({
          seat: inv.seat, skill: 'agility', difficulty: 1, source: { label: '闪躲', code: '08026' },
          resolve: result => {
            if (!result?.success || !enemyId) return
            const target = (api.enemiesAt(inv.location) || []).find(item => item.id === enemyId)
            if (target) api.damageEnemy(target, 1, inv.seat)
          },
        })
      },
    },
  ],
  modifiers: [],
}
