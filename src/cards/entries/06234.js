// 06234 英勇救援
// 卡面：快速。在一个非[[精英]]敌人将要攻击你所在地点或连接地点的另一位调查员时打出。
//       如果你此时不在该地点，你移动到该地点。改为你与该敌人交战并对你结算它的攻击。
//       然后，对其造成 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：快速事件 = played + fast + trigger（reactionWindow 统一通道）；
//   · enemyAttack 窗口上下文 { seat: 被攻击者, location, enemy }；
//   · 取消原攻击：context.cancelled = true（interrupt 窗口的统一取消口径）；
//   · 改为对自己结算攻击：api.enemyAttackByCard(enemy, label, seat)；
//   · 交战 / 移动 / 1 点伤害：api.engage / api.moveInvestigator / api.damageEnemy。

export default {
  code: '06234',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyAttack',
      label: '快速：代替另一位调查员承受非精英敌人的攻击，然后对其造成 1 点伤害',
      criteria: [({ state, inv, context }) => {
        const target = context?.seat != null ? state.investigators[context.seat] : null
        const enemy = context?.enemy
        if (!target || !enemy || enemy.elite || context.seat === inv.seat) return false
        const here = state.locations.find(location => location.id === inv.location)
        const there = context.location
        if (there == null) return false
        return there === inv.location || (here?.connections || []).includes(there)
      }],
      resolve: ({ state, inv, api, context }) => {
        const enemy = state.enemies.find(item => item.id === context?.enemy?.id)
        const targetSeat = context?.seat
        if (!enemy || targetSeat == null) return
        const destination = context.location
        if (destination && destination !== inv.location) api.moveInvestigator(inv.seat, destination)
        if (enemy.engagedSeat !== inv.seat) api.engage(enemy, inv.seat)
        // 原攻击改为对打出者结算：先取消对原目标的攻击，再以效果来源发起同一次攻击。
        context.cancelled = true
        api.enemyAttackByCard(enemy, '英勇救援', inv.seat)
        api.damageEnemy(enemy, 1, inv.seat)
        api.info(`${inv.name} 用「英勇救援」替 ${state.investigators[targetSeat]?.name || '其他调查员'} 承受了「${enemy.name}」的攻击，并对其造成 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
