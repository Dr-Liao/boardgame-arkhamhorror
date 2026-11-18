// 10685 毒堇诅咒（The Hemlock Curse）· 弱点 ·[[枯疫]] [[色彩]] · 共享遭遇组 day_of_rain
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_rain（印刷 4 张；dawnOfTheSecondDay 用
//   behavior.addCampaignCard 把它加进调查员牌组：第 2 日黎明「finished their meal」分支）。
// 卡面（cards-data 10685，skill / subtype weakness，图标 1×［wild］）：
//   本技能的图标不加入你的技能值，改为减去。
//   如果本次技能检定失败，弃掉你手里的每张卡牌。
//   强制 - 当你的回合结束时，如果毒堇诅咒在你手中：随机弃掉你 1 张手牌。
//
// 读点（条目自足实现，全部走 ctx.api）：
//   · 玩家侧弱点通道：条目用 scope 'card' 声明（非玩家 scope 注册期禁止 weakness 生命周期），
//     与忒咳哩-哩（08723–08729）同一口径；卡在手中由条目级 weaknessStaysInHand 声明（deck-ops.js#drawCards 读点）；
//   · 「图标改为减去」= commit 描述子的 subtractIcons（引擎 stats.js#commitIcons 读点）；
//   · 「检定失败弃掉整手牌」= commit 描述子的 skill.onFail 函数（tests.js#resolveResult 读点）；
//   · 「回合结束在手 → 随机弃 1 张」= 手牌来源的 forced 描述子，窗口 turnEnded，
//     读点 openAbilityWindow 的手牌枚举（descriptorSources 的 fromHandIndex）+ api.discardRandomFromHand。
const CODE = '10685'

function discardWholeHand(state, seat, api) {
  const inv = state.investigators?.[seat]
  if (!inv) return 0
  let discarded = 0
  for (const code of [...(inv.hand || [])]) {
    api.discardFromHand(seat, code)
    discarded += 1
  }
  return discarded
}

export default {
  code: CODE,
  scope: 'card',
  implemented: true,
  // 抽到后留在手里（印刷没有「显现」，它就是一张要投入/占手的技能弱点）。
  weaknessStaysInHand: true,
  weaknessHandNote: '「毒堇诅咒」留在手中：投入时图标改为减去，检定失败弃掉整手牌；回合结束时随机弃 1 张。',
  flags: {
    traits: ['Blight', 'Colour'],
    weakness: true,
    subtractIcons: true,
    quantity: 4,
    inHandEffect: true,
  },
  abilities: [{
    kind: 'commit',
    label: '本技能的图标改为减去技能值；若本次检定失败，弃掉你手里的每张卡牌',
    skill: {
      anySkill: true,
      subtractIcons: true,
      onFail: ({ state, inv, api }) => {
        const discarded = discardWholeHand(state, inv?.seat, api)
        api.info?.(`🌑 「毒堇诅咒」：${inv?.name || '调查员'} 的检定失败，弃掉手中 ${discarded} 张卡牌。`)
      },
    },
  }, {
    kind: 'forced',
    fromHand: true,
    noPlayCost: true,
    trigger: 'turnEnded',
    silent: true,
    label: '回合结束时若「毒堇诅咒」在你手中：随机弃掉 1 张手牌',
    criteria: ({ state, inv, context }) => (inv.hand || []).includes(CODE)
      && (context?.seat == null || context.seat === inv.seat)
      && (state.currentSeat == null || state.currentSeat === inv.seat),
    resolve: ({ inv, api }) => {
      if (!(inv.hand || []).includes(CODE)) return
      api.discardRandomFromHand(inv.seat, 1)
      api.info?.(`🌑 「毒堇诅咒」：${inv.name} 的回合结束，随机弃掉 1 张手牌。`)
    },
  }],
  note: '弱点按玩家侧管线结算（scope card + weaknessStaysInHand）；图标减法/失败弃手/回合结束弃牌三个读点全部落到引擎既有字段。',
}
