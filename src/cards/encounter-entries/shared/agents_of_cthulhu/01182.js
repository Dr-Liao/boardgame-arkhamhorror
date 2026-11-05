// 01182 拉莱耶之梦（Dreams of R'lyeh）· 克苏鲁的爪牙（agents_of_cthulhu）
//
// 印刷（中文）：
//   [显现] - 将拉莱耶之梦放置入场，放到你的威胁区域。
//   你得到-1[willpower]和-1神智。
//   [action]：检定[willpower](3)。如果你检定成功，弃掉拉莱耶之梦。
// 印刷（英文）：
//   Revelation - Put Dreams of R'lyeh into play in your threat area.
//   You get -1 [willpower] and -1 sanity.
//   [action]: Test [willpower] (3). If you succeed, discard Dreams of R'lyeh.
//
// 归属：跨战役复用（夜之狂热 · 地底噬魔 用旧 DSL 的 definition.threat 实现同名卡；
//   印斯茅斯各章按印刷卡号 01182 抽到时走本条目。修复前全仓没有 01182 行为，真实抽取后
//   直接静默进遭遇弃牌堆、无威胁区无任何效果——审计 H14）。
//
// 引擎读点（与同款模板 07106「印斯茅斯面容」逐项一致）：
//   · 入场 = `encounterResolve` → `api.threat(seat, code, { threatEffect })`；条目声明
//     `treacheryRule.threatArea`。返回 true 表示卡已进入威胁区、不进遭遇弃牌堆。
//   · 意志 -1 = 威胁区卡的修正行（modifierSourceRows 把 inv.threat 当来源，只作用于持有者）。
//   · 神智 -1 = 威胁区效果通道 `threatEffect.sanityModifier`（getMaxSanity 的直接读点；
//     修正管线的 maxSanity 目标目前没有读点）。
//   · [action] 检定意志(3) 成功 → `api.removeThreat(source)` 弃掉。
export default {
  code: '01182', scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true },
  modifiers: [
    { target: 'skill:willpower', amount: -1 },
  ],
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '检定意志(3)：成功后弃掉拉莱耶之梦',
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', 3, {
        source: { type: 'scenario', action: 'activate', code: '01182', name: '拉莱耶之梦', ability: true },
        resolve: result => {
          if (!result.success) return
          api.removeThreat(source)
          api.info?.(`🌀 ${inv.name} 从「拉莱耶之梦」中醒来。`)
        },
      })
    },
  }],
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, '01182', { threatEffect: { sanityModifier: -1 } })
    api.info?.(`🌀 ${inv.name} 陷入「拉莱耶之梦」：意志 -1、神智 -1。`)
    return true
  },
}
