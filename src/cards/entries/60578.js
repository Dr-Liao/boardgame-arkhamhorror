// 60578 绳索陷阱 · 事件（2 费，2 经验，战斗/智识图标，陷阱/诡计）
// 卡面：附属到你所在地点。每个地点仅限附属 1 张[[陷阱]]。
//       [reaction]一个敌人进入所附属的地点后，横置：对该敌人造成 1 点伤害。
//       从混乱袋中随机揭示一个标记。如果揭示了[skull]或[auto_fail]标记，弃掉绳索陷阱。
const CODE = '60578'

export default {
  code: CODE,
  keepOnPlay: true,
  assetRule: { ownerLocationAttachmentAbility: true },
  abilities: [
    {
      kind: 'played',
      label: '附属到你所在地点',
      resolve: ({ inv, api }) => api.attachToLocation(inv.location, { code: CODE, ownerSeat: inv.seat }),
    },
    {
      kind: 'reaction',
      trigger: 'entersAttachedLocation',
      label: '横置绳索陷阱：对进入所附属地点的敌人造成 1 点伤害并揭示 1 个混乱标记',
      cost: { exhaust: true },
      criteria: [({ source, context }) => Boolean(context?.enemy) && context.location === source?.location],
      resolve: ({ inv, source, context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        api.damageEnemy(enemy, 1, inv.seat)
        const token = api.revealChaosTokens(1)[0]
        if (token === 'skull' || token === 'autofail') {
          api.putIntoDiscard(inv.seat, CODE)
          api.info(`绳索陷阱：揭示了「${api.tokenLabel(token)}」，弃掉绳索陷阱并造成 1 点伤害。`)
        } else {
          api.info(`绳索陷阱：对敌人造成 1 点伤害（揭示了「${api.tokenLabel(token)}」）。`)
        }
        void source
      },
    },
  ],
  modifiers: [],
  note: '「敌人进入地点」已接 entersAttachedLocation 窗口（生成/移动进入均触发）。',
}
