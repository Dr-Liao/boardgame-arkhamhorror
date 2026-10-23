// 05005 丽塔·杨
// 卡面：[reaction]在你躲避一个敌人后：对该敌人造成1点伤害，或移动到一个连接地点。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+2。直到本轮结束，忽略以上[reaction]能力的限制。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「每轮一次」没有走引擎的 limit 账本：旧印要「忽略这条限制直到本轮结束」，
// 那是账本表达不了的状态（账本只记用过/没用过，不能临时放开又不能重复触发同一次躲避）。
// 因此这里自己记账，两个实例字段：
//   inv.ritaEvadeRound       —— 本轮已经用过这条反应（旧印后不再限制轮次）
//   inv.ritaIgnoreLimitRound —— 旧印放开了本轮的限制
//   inv.ritaEvadeUses        —— 本轮已经结算过的「第几次躲避/哪个敌人」，防止同一窗口重复提供

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05005')

const windowKey = (state, enemy) => `${state.round}:${state.moveCount}:${enemy?.id ?? '-'}`

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
      inv.ritaIgnoreLimitRound = state.round
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
      criteria: [({ state, inv, context }) => {
        if (!context?.enemy) return false
        if (context.seat != null && context.seat !== inv.seat) return false
        // 同一次躲避只结算一次（避免窗口把同一个反应重复提供）。
        if ((inv.ritaEvadeUses || []).includes(windowKey(state, context.enemy))) return false
        // 每轮一次；旧印放开的那个回合不设这个限制。
        if (inv.ritaEvadeRound === state.round && inv.ritaIgnoreLimitRound !== state.round) return false
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
        inv.ritaEvadeRound = state.round
        inv.ritaEvadeUses = [...(inv.ritaEvadeUses || []).filter(key => key.startsWith(`${state.round}:`)),
          windowKey(state, enemy)]
      },
    },
  ],
  modifiers: [],
}
