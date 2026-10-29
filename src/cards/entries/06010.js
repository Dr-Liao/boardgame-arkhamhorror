// 06010 赏金合约
// 卡面：永久。托尼·摩尔根牌库专用。使用(6 赏金)。
//       [reaction] 敌人入场后：将赏金合约上的 1-3 赏金放到该敌人上，最多放置等于该敌人生命值的赏金。
//       强制 - 你击败带有至少 1 赏金的敌人后：将其所有赏金移动到你的资源池，作为资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 赏金是通用具名计数器（src/engine/card-counters.js，原语 `counter.card`）：
// 合约上的 6 点由 setup 描述子放好，敌人身上的赏金用 api.moveCardCounters 搬运。
// `permanent: true` 来自卡面数据，setup.js 会把这张卡直接放进场并结算 setup 描述子。

export default {
  code: '06010',
  abilities: [
    {
      kind: 'setup',
      label: '入场：放置 6 赏金',
      resolve: ({ source, api }) => {
        if (source) api.addCardCounter(source, 'bounty', 6, { max: 6 })
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemySpawn',
      id: 'bountyContractsMove',
      label: '敌人入场后：把 1-3 赏金移到该敌人上',
      criteria: [({ inv, context }) => {
        const contracts = (inv.assets || []).find(asset => asset.code === '06010')
        return Boolean(context?.enemy) && Boolean(contracts) && (contracts.markers?.bounty || 0) > 0
      }],
      resolve: ({ inv, context, api }) => {
        const contracts = (inv.assets || []).find(asset => asset.code === '06010')
        const enemy = context.enemy
        if (!contracts || !enemy) return
        const available = api.cardCounterOf(contracts, 'bounty')
        const max = Math.min(3, available, Math.max(0, (enemy.health || 0) - api.cardCounterOf(enemy, 'bounty')))
        if (max <= 0) return
        const amountId = max === 1 ? '1' : api.choice({
          kind: 'effect', source: 'bountyContracts', seat: inv.seat,
          prompt: `把几点赏金放到「${enemy.name}」上（最多 ${max} 点）？`,
          options: Array.from({ length: max }, (_, index) => ({ id: String(index + 1), label: `${index + 1} 点赏金` })),
        })
        const amount = Math.max(1, Math.min(max, Number(amountId) || 1))
        api.moveCardCounters(contracts, enemy, 'bounty', amount, { max: enemy.health || 0 })
        api.info(`${inv.name} 把 ${amount} 点赏金放到「${enemy.name}」上。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'defeatEnemy',
      id: 'bountyContractsPayout',
      label: '击败带赏金的敌人后：其赏金作为资源进入资源池',
      criteria: [({ inv, context }) => Boolean(context?.enemy)
        && (inv.assets || []).some(asset => asset.code === '06010')
        && (context.enemy.markers?.bounty || 0) > 0],
      resolve: ({ inv, context, api }) => {
        const enemy = context.enemy
        const amount = enemy.markers?.bounty || 0
        if (!amount) return
        api.addCardCounter(enemy, 'bounty', -amount)
        api.gainResources(inv.seat, amount)
        api.info(`「${enemy.name}」被击败：${amount} 点赏金转化为 ${inv.name} 的资源。`)
      },
    },
  ],
  modifiers: [],
}
