// 11737 水中之物（Something in the Water）· 诡计 · 共享遭遇组 tdc_flood（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_flood。
// 卡面（cards-data 11737）：
//   涌动。
//   显现 - 提高最近一处符合条件地点的淹没等级。
//
// 读点（声明即接线）：
//   · 涌动 = 印刷正文「Surge.」由章节 encounterDefinitions 解析（本条目 flags.surge 只作数据）；
//   · 「最近一处符合条件地点」= api.mechanics.water.nearestTargets(inv.location, 1)
//     （nearestFloodTargets：用 canChangeFloodLevel 过滤锁定/边界地点；并列最近返回全部）；
//   · 「提高淹没等级」= api.mechanics.water.change(id, 1)（setFloodLevel 的唯一写入口，
//     触发 floodChanged 窗口并同步关卡水位规则）。
const CODE = '11737'

export default {
  code: CODE,
  name: '水中之物',
  scope: 'treachery',
  implemented: true,
  flags: { traits: ['Hazard'], quantity: 2, surge: true },
  encounterResolve(state, inv, card, api) {
    const targets = api.mechanics?.water?.nearestTargets?.(inv.location, 1) || []
    if (!targets.length) {
      api.info?.('🌊 「水中之物」：没有可以提高淹没等级的地点。')
      return false
    }
    const chosen = targets.length === 1 ? targets[0] : (api.choice({
      kind: 'location', source: CODE, seat: inv.seat,
      prompt: '「水中之物」：选择最近一处可以涨水的地点（并列）。',
      options: targets.map(id => ({ id, label: api.locName?.(id) || id })),
    }) || targets[0])
    api.mechanics.water.change(chosen, 1)
    api.info?.(`🌊 「水中之物」：提高「${api.locName?.(chosen) || chosen}」的淹没等级。`)
    return false
  },
  note: '涌动由章节 encounterDefinitions 从印刷正文解析；显现只结算「抬升最近一处可涨水地点的淹没等级」，'
    + '走 P2 淹没原语的 nearestTargets + change（锁定/上下限由原语内部过滤）。',
}
