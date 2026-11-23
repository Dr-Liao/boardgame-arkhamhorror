// 11735 水下狩猎（Undersea Hunt）· 诡计 · 共享遭遇组 undersea_creatures（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/undersea_creatures。
// 卡面（cards-data 11735）：
//   显现 - 检定[agility](3)。如果你所在地点完全淹没，本检定难度+2。
//          如果你失败，受到1点伤害并提高最近一处符合条件地点的淹没等级。
//
// 读点（声明即接线）：
//   · 淹没等级 = api.mechanics.water.level(id)（flood.js#floodLevel 的只读查询）：
//     完全淹没 = 等级 2，因此难度 = 3 + (level === 2 ? 2 : 0)；
//   · 显现检定 = api.test；失败伤害 = api.damage；
//   · 「提高最近一处符合条件地点的淹没等级」= api.mechanics.water.nearestTargets(inv.location, 1)
//     （nearestFloodTargets：用 canChangeFloodLevel 过滤被锁定/边界限制的地点）+ 并列时 api.choice
//     + api.mechanics.water.change(id, 1)（setFloodLevel 的唯一写入口，会开 floodChanged 窗口）。
const CODE = '11735'
const BASE_DIFFICULTY = 3

export default {
  code: CODE,
  name: '水下狩猎',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Scheme'],
    quantity: 2,
    test: { skill: 'agility', difficulty: BASE_DIFFICULTY, fullyFloodedPlus: 2 },
  },
  encounterResolve(state, inv, card, api) {
    const water = api.mechanics?.water
    const difficulty = BASE_DIFFICULTY + (water?.level?.(inv.location) === 2 ? 2 : 0)
    api.test(inv.seat, 'agility', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「水下狩猎」检定（敏捷 ${result.value} vs ${difficulty}）。`)
        return
      }
      api.damage(inv.seat, 1)
      api.info?.(`🌊 「水下狩猎」：${inv.name} 检定失败，受到 1 点伤害。`)
      const targets = water?.nearestTargets?.(inv.location, 1) || []
      if (!targets.length) {
        api.info?.('🌊 「水下狩猎」：没有可以继续提高淹没等级的地点。')
        return
      }
      const chosen = targets.length === 1 ? targets[0] : (api.choice({
        kind: 'location', source: CODE, seat: inv.seat,
        prompt: '「水下狩猎」：选择最近一处可以涨水的地点（并列）。',
        options: targets.map(id => ({ id, label: api.locName?.(id) || id })),
      }) || targets[0])
      water.change(chosen, 1)
      api.info?.(`🌊 「水下狩猎」：提高「${api.locName?.(chosen) || chosen}」的淹没等级。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '水下狩猎' })
    return false
  },
  note: '难度按所在地点是否完全淹没（level 2）+2；失败后先受 1 点伤害再抬升最近可涨水地点的淹没等级。'
    + '全部读点复用 P2 淹没原语（water.level / nearestTargets / change），被锁定的地点由'
    + ' canChangeFloodLevel 自动排除。',
}
