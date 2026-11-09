// 威胁区入场后的统一收尾。
//
// 1. 发布 threatEntered 反应窗口（取消显现 / 替代入场的反应在这里结算）；
// 2. 重新判定「有效生命／神智上限」：威胁区的持续修正会在入场的同一瞬间改变上限
//    （04085 伊格的诅咒 -1 生命、01182/07106 -1 神智等），可能让调查员已有的伤害／恐惧
//    立刻变成致命。此前只有「实际受到伤害／恐惧」或行动结算才会触发 checkDefeated，
//    于是「上限降到等于已有伤害」时要拖到下一次受伤／行动才判负——2026-11-09 实机
//    时间线里看起来就是「盟友吃了 1 点恐惧，卢克却突然被击败」。
//
// 判定由引擎注入（本模块不 import 引擎，避免循环依赖），并且只在入场卡确实下调了
// 生命/神智上限时才做：上限没变时提示「已致命」只会在嵌套结算里提前判负、改变既有顺序。
// 放在反应窗口之后，让窗口里的反应先把卡处理掉（例如取消显现），再做判定。
let hooks = { checkLimitDefeat: null }

export function setThreatEntryHooks(next) {
  hooks = { ...hooks, ...next }
}

export function afterThreatEntered(state, inv, card, events, reactionWindow) {
  if (typeof reactionWindow === 'function') {
    reactionWindow(state, 'threatEntered', {
      when: 'threatEntered', seat: inv.seat, card, cardCode: card.code, location: inv.location,
      prompt: '一张卡牌进入你的威胁区域。',
    }, events, { allowNested: true })
  }
  hooks.checkLimitDefeat?.(state, inv, card, events)
  return card
}
