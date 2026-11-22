// 99003 安息日男爵（Baron Samedi）· 中立 · 支援/化身/弱点 · 盟友槽 · 玛丽·朗博。
// cards-data 的 99003 与 05019 同文同面（推广印刷），行为沿用 canonical 实现（05019）：
//   · weaknessPlaysAsAsset / cannotLeavePlayWhile（<3 毁灭不能离场）/ harmDealt 强制额外伤害 /
//     [fast] 横置放毁灭并在 ≥3 时弃掉自身。
// 本文件只覆盖 code，并把两处「卡号常量」改成 99003（05019 的描述子用 BARON_CODE 比较来源/弃置自身）：
//   · forced criteria：source?.code === '99003'
//   · free resolve：api.discardSelf('99003')
// 若 Lead 后续把 99003 标为 05019 的 duplicateOfCode，应改走 REPRINT_ALIASES 并删除本文件。
import base from './05019.js'

const code = '99003'

const abilities = base.abilities.map((ability, index) => {
  if (index === 1) {
    return {
      ...ability,
      criteria: [({ inv, state, context, source }) => {
        if (source?.code !== code) return false
        if (!(Number(context?.damage) > 0)) return false
        if (!Number.isInteger(context?.seat)) return false
        const harmed = state.investigators?.[context.seat]
        return Boolean(harmed) && harmed.location === inv.location
      }],
    }
  }
  if (index === 2) {
    return {
      ...ability,
      resolve: ({ api, source }) => {
        const card = source?.code === code ? source : null
        if (!card) return
        api.placeDoomOnCard(card, 1)
        if ((card.doom || 0) >= 3) {
          api.discardSelf(code)
          api.info('安息日男爵身上有 3 个毁灭标记，被弃掉。')
        }
      },
    }
  }
  return ability
})

export default { ...base, code, abilities }
