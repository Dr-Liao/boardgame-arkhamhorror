// 08021 “到我身后！”
// 卡面：快速。可在任何[free]时间段期间打出。
//       直到本阶段结束，每次敌人攻击你所在地点的另一位调查员时，改为攻击你，然后与你交战。
//       取消每次这种攻击造成的 1 点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：引擎没有「持续到阶段结束的攻击改向」读点（08021 原语请求 m2-1-08021.json）。
// 这里退化成与 03106「英勇救援」同构的手牌快速反应：在「同地点另一位调查员被攻击」的 enemyAttack
// 窗口打出一次，取消原攻击 → 敌人改为攻击你并交战 → 结算后治愈 1 点恐惧（等价于取消该次 1 点恐惧，
// 差别是不会触发「取消伤害/恐惧」的窗口）。持续整阶段的多次拦截没有建模。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '08021',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyAttack',
      criteria: [
        ownSeat(),
        ({ inv, context }) => {
          const ctx = context?.context || context || {}
          return Boolean(ctx.enemy) && ctx.seat !== inv.seat && ctx.location === inv.location
        },
      ],
      label: '另一位调查员被攻击时：改为攻击你并交战，取消该次攻击造成的 1 点恐惧',
      resolve: ({ inv, api }) => {
        const raw = api.reactionContext()
        const ctx = raw?.context || raw
        const enemy = ctx?.enemy
        if (!enemy) return
        // 取消原攻击，再让该敌人改为攻击你。
        api.cancelCurrentAttack(ctx)
        api.engage(enemy, inv.seat)
        api.info(`“到我身后！”：${inv.name} 替同地点的调查员承受「${enemy.name}」的攻击。`)
        api.enemyAttackByCard(enemy, api.cardName('08021'), inv.seat)
        // 取消每次这种攻击造成的 1 点恐惧（近似：结算后治愈 1 点恐惧）。
        api.healHorror(inv.seat, 1)
      },
    },
  ],
  modifiers: [],
}
