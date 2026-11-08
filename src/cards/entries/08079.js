// 08079 血债血偿
// 卡面：快速。在一个敌人攻击你后打出。每次攻击最多1张。该攻击造成的伤害/恐惧不能分配给[[盟友]]支援。
//       你从本次攻击中每受到1点伤害和/或恐惧，抽取1张卡牌。
//
// 读点：快速事件窗口 harmAssigned（enemies.js 在敌人攻击实际造成伤害/恐惧后开，context 带 damage/horror/attack）。
// approximation: 「该攻击的伤害/恐惧不能分配给盟友支援」没有回溯改写分配策略的引擎读点，
//   已提交 primitive request m2-3-08079；本实现只结算「每受到 1 点伤害/恐惧抽 1 张牌」的主效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08079',
  abilities: [
    { kind: 'played', fast: true, trigger: 'harmAssigned',
      label: '敌人攻击你造成伤害/恐惧后：每受到 1 点伤害/恐惧抽 1 张牌',
      criteria: ({ inv, context }) => Boolean(context) && context.seat === inv.seat
        && Boolean(context.attack) && ((context.damage || 0) + (context.horror || 0) > 0),
      resolve: ({ inv, context, api }) => {
        const amount = (context.damage || 0) + (context.horror || 0)
        if (!amount) return
        api.drawCards(inv.seat, amount)
      } },
  ],
  modifiers: [],
}
