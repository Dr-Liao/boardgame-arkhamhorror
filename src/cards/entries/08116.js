// 08116 护身法宝（Talisman of Protection）
// 卡面：快速。只可在你的回合期间打出。
// 打出护身法宝，置于你所在地点任意一位调查员控制之下。
// [reaction] 在你被分配伤害和/或恐惧，且其数量足够击败你时，弃掉护身法宝：
//        取消该伤害和/或恐惧中的最多 2 点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 控制权转移：entersPlay 里 api.giveAsset（与 06020 庄严立誓同一原语）；
//   · 「将受到的伤害/恐惧足以击败你」：既有窗口 `harmDealt`（04111 坚韧不拔同一时机），
//     取消走 api.cancelHarm（maximum 2，弃掉自身是描述子 cost.discardSelf）。
import { ownTurn } from '../../engine/matcher.js'

const code = '08116'

export default {
  code,
  fast: true,
  playCondition: [{ when: ownTurn(), message: '「护身法宝」只能在你的回合期间打出' }],
  abilities: [
    {
      kind: 'entersPlay',
      label: '置于你所在地点任意一位调查员控制之下',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const candidates = state.investigators.filter(other => !other.defeated && !other.resigned
          && other.location === inv.location)
        if (!candidates.length) return
        const chosen = candidates.length === 1 ? candidates[0].seat : Number(api.choice({
          kind: 'investigator', source: code, seat: inv.seat,
          prompt: '选择「护身法宝」的控制者（你所在地点的任意一位调查员）。',
          options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
        }))
        const target = state.investigators[chosen]
        if (!target || chosen === inv.seat) return
        if (!api.giveAsset(source, chosen)) return
        api.info(`🛡️ 「护身法宝」置于 ${target.name} 的控制之下。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'harmDealt',
      label: '将被击败时弃掉：取消本次伤害/恐惧中的最多 2 点',
      cost: { discardSelf: true },
      criteria: [({ state, inv, context }) => {
        if (context?.seat !== inv.seat) return false
        const damage = Number(context?.damage) || 0
        const horror = Number(context?.horror) || 0
        if (!damage && !horror) return false
        const maxHealth = inv.maxHealth ?? inv.health ?? 0
        const maxSanity = inv.maxSanity ?? inv.sanity ?? 0
        const lethalDamage = damage > 0 && maxHealth > 0 && (inv.damage || 0) + damage >= maxHealth
        const lethalHorror = horror > 0 && maxSanity > 0 && (inv.horror || 0) + horror >= maxSanity
        return lethalDamage || lethalHorror
      }],
      resolve: ({ inv, source, context, api }) => {
        const damage = Math.max(0, Number(context?.damage) || 0)
        const horror = Math.max(0, Number(context?.horror) || 0)
        const options = []
        for (let amountDamage = 0; amountDamage <= Math.min(damage, 2); amountDamage++) {
          for (let amountHorror = 0; amountHorror <= Math.min(horror, 2 - amountDamage); amountHorror++) {
            if (amountDamage + amountHorror === 0) continue
            options.push({ id: `${amountDamage}:${amountHorror}`,
              label: `取消 ${amountDamage} 伤害、${amountHorror} 恐惧` })
          }
        }
        if (!options.length) return
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'harm', source: code, seat: inv.seat,
          prompt: '「护身法宝」：选择要取消的伤害与恐惧（最多 2 点）。', options,
        })
        const [cancelledDamage, cancelledHorror] = String(answer).split(':').map(Number)
        if (!Number.isFinite(cancelledDamage) || !Number.isFinite(cancelledHorror)) return
        context.damage = Math.max(0, damage - cancelledDamage)
        context.horror = Math.max(0, horror - cancelledHorror)
        api.info(`🛡️ 「护身法宝」：${inv.name} 取消 ${cancelledDamage} 点伤害、${cancelledHorror} 点恐惧。`)
      },
    },
  ],
  modifiers: [],
}
