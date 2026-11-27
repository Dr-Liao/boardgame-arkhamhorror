// 08079 血债血偿
// 卡面：快速。在一个敌人攻击你后打出。每次攻击最多1张。该攻击造成的伤害/恐惧不能分配给[[盟友]]支援。
//       你从本次攻击中每受到1点伤害和/或恐惧，抽取1张卡牌。
//
// 攻击分配到盟友支援时，这次攻击不能作为打出时机。
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08079',
  abilities: [
    { kind: 'played', fast: true, trigger: 'harmAssigned',
      limit: { scope: 'perAttack', owner: 'player' },
      label: '敌人攻击你造成伤害/恐惧后：每受到 1 点伤害/恐惧抽 1 张牌',
      criteria: ({ inv, context }) => Boolean(context) && context.seat === inv.seat
        && Boolean(context.attack) && context.assignedAlly !== true && ((context.damage || 0) + (context.horror || 0) > 0),
      resolve: ({ inv, context, api }) => {
        const amount = (context.damage || 0) + (context.horror || 0)
        if (!amount) return
        api.drawCards(inv.seat, amount)
      } },
  ],
  modifiers: [],
}
