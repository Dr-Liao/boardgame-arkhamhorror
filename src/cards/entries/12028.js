// 12028 长柄大锤
// 卡面：[action]：攻击([combat])。本次攻击造成伤害+1。
// 卡面：[action][action]：攻击([combat])。你本次攻击得到+3[combat]。如果你检定成功，你可以横置[长柄大锤]以使本次攻击造成伤害+2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 两种攻击都是 action 描述子 + countsAs:'fight' + target:{kind:'enemy'}（legalMoves 按候选展开，
//     目标的合法性与 doFight 共用 attackableEnemies 口径）；
//   · 攻击结算 = api.fight（doFight 是唯一入口；战斗加值/伤害加值在这里传）；
//   · 「成功后可以横置本牌使伤害 +2」= api.fight 的 onSuccess 回调（引擎在判定成功之后、
//     伤害合计之前回调，与 10021 武士刀同一读点）；横置用 api.exhaust（唯一横置写点）。

import { attackableEnemies } from './_shared.js'

const CODE = '12028'

const target = {
  kind: 'enemy',
  query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity),
}

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：本次攻击造成伤害 +1',
      target,
      cost: { action: true },
      resolve: ({ inv, target, api }) => {
        if (!target) return
        api.fight(inv.seat, target.id, { damageBonus: 1 })
      },
    },
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：战斗 +3；成功后可以横置本牌使本次攻击伤害 +2',
      target,
      cost: { action: 2 },
      resolve: ({ inv, source, target, api }) => {
        if (!target) return
        api.fight(inv.seat, target.id, {
          combatBonus: 3,
          onSuccess: ({ opts }) => {
            if (!source || source.exhausted) return
            const answer = api.choice({
              kind: 'effect', source: source.id ?? CODE, seat: inv.seat, canSkip: true,
              prompt: '长柄大锤：本次攻击检定成功。是否横置长柄大锤，使本次攻击造成 +2 伤害？',
              options: [
                { id: 'skip', label: '不横置（本次攻击照常造成伤害）' },
                { id: 'exhaust', label: '横置长柄大锤：本次攻击 +2 伤害' },
              ],
            })
            if (answer !== 'exhaust') return
            api.exhaust(source)
            opts.damageBonus = (opts.damageBonus || 0) + 2
            api.info('⚒️ 长柄大锤：横置本牌，本次攻击造成 +2 伤害。')
          },
        })
      },
    },
  ],
  modifiers: [
  ],
}
