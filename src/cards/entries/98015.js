// 98015 深海之梦（Dreams of the Deep）· 中立 · 技能/弱点 · 诅咒 · 替换（西拉斯·马什）。
// 卡面（cards-data 98015）：
//   西拉斯·马什牌库专用。替换。
//   本技能的图标从你的技能值中减去，而不是加上。
//   如果本次技能检定失败，将本技能返回你的手牌。
//   强制 - 如果深海之梦在你的手牌中，在你的回合结束时：揭示它并受到 2 点伤害。
//
// 引擎读点：
//   · 「图标从技能值中减去」= commit 描述子的 skill.subtractIcons（stats.js#commitIcons 读点：
//     投入图标求和后取负）；
//   · 「检定失败返回手牌」= commit 描述子的 skill.destination(ctx)（tests.js#closeTest 在投入卡去向段
//     读取 profile.destination；ctx.result.success 判定，返回 'hand' 表示回到手牌）；
//   · 回合结束强制（在手牌中）= forced 描述子 + fromHand:true + trigger 'turnEnded'
//     （ability-exec.js#openAbilityWindow 对 descriptorSources 的手牌来源只放行 fromHand 描述子）；
//     受到 2 点伤害 = api.damage（applyDamage 统一入口；不是直接伤害）。
const code = '98015'

export default {
  code,
  abilities: [
    {
      kind: 'commit',
      label: '本技能的图标从技能值中减去；检定失败时返回手牌',
      skill: {
        subtractIcons: true,
        destination: ({ result }) => (result?.success ? null : 'hand'),
      },
    },
    {
      kind: 'forced',
      fromHand: true,
      trigger: 'turnEnded',
      label: '回合结束时若深海之梦在手牌中：揭示它并受到 2 点伤害',
      criteria: [({ inv, state }) => state.currentSeat === inv.seat && (inv.hand || []).includes(code)],
      resolve: ({ inv, api }) => {
        api.info(`「深海之梦」在 ${inv.name} 的手牌中被揭示。`)
        api.damage(inv.seat, 2)
      },
    },
  ],
  modifiers: [],
}
