// 05005 丽塔·杨
// 卡面：[reaction]在你躲避一个敌人后：对该敌人造成1点伤害，或移动到一个连接地点。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+2。直到本轮结束，忽略以上[reaction]能力的限制。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P2-6（2026-10-28）：「每轮仅限一次」改用引擎的通用上限账本（limits.js）：
//   · 描述子声明 `limit: { scope: 'perRound', owner: 'player' }`，引擎统一提供候选与记账；
//   · 旧印调用 `api.ignoreLimitForRound('ritaEvadeReaction')` 记「本轮忽略这条上限」，
//     忽略期间同一窗口实例内仍只结算一次（由 limitUsed 的 windowSerial 口径保证）。
// 原先的 inv.ritaEvadeRound / ritaEvadeUses / ritaIgnoreLimitRound 三个单卡字段全部删除。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05005')

export default {
  code: '05005',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 2 },
  },
  elderSign: {
    id: '05005-eldersign',
    label: '旧印：+2，直到本轮结束忽略反应限制',
    resolve: ({ state, inv, api }) => {
      api.ignoreLimitForRound('ritaEvadeReaction')
      api.info(`直到本轮结束，${inv.name} 的躲避反应不再限每轮一次。`)
      return { delta: Number(sign.bonus ?? 2) }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'evadeSuccess',
      id: 'ritaEvadeReaction',
      label: '躲避后：对该敌人造成 1 点伤害，或移动到连接地点',
      // 卡面「每轮仅限一次」：引擎 limits.js 的通用账本（旧印可临时忽略，见 elderSign）。
      limit: { scope: 'perRound', owner: 'player' },
      criteria: [({ inv, context }) => {
        if (!context?.enemy) return false
        if (context.seat != null && context.seat !== inv.seat) return false
        return true
      }],
      resolve: ({ state, inv, api, context }) => {
        const enemy = context.enemy
        const options = []
        if (enemy && state.enemies.includes(enemy)) options.push({ id: 'damage', label: `对「${enemy.name}」造成 1 点伤害` })
        for (const id of api.moveDestinations(inv.seat)) {
          options.push({ id: `move:${id}`, label: `移动到「${api.locName(id)}」` })
        }
        if (!options.length) return
        const answer = api.choice({
          kind: 'effect', source: 'ritaEvadeReaction', seat: inv.seat, canSkip: true,
          prompt: '躲避后：对该敌人造成 1 点伤害，或移动到连接地点。',
          options: [{ id: 'skip', label: '不结算' }, ...options],
        })
        if (answer === 'skip') return
        if (answer === 'damage') {
          api.damageEnemy(enemy, 1, inv.seat, 'ritaEvadeReaction')
        } else if (String(answer).startsWith('move:')) {
          api.moveInvestigator(inv.seat, String(answer).slice('move:'.length))
        }
      },
    },
  ],
  modifiers: [],
}
