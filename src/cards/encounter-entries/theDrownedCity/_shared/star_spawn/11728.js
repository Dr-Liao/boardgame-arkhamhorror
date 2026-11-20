// 11728 星之眷族观察者（Star Spawn Observer）· 敌人 · 共享遭遇组 star_spawn（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/star_spawn。
// 卡面（cards-data 11728）：
//   冷漠。猎手。猎物 - [intellect]最高者。
//   强制 - 你调查星之眷族观察者所在地点时揭示[elder_thing]标记：该敌人与您交战并立刻攻击。
//
// 读点（声明即接线）：
//   · 「你调查它所在地点时」= chaosTokenRevealed 窗口 + state.skillTest（actionKind 'investigate'、
//     target 是地点）；条件要求 target.id === 本敌人所在地点；
//   · 「与你交战」= api.engage；「立刻攻击」= api.scenario.attack（enemies.js#enemyAttack 的剧本入口）；
//   · 冷漠/猎手/猎物来自章节 encounterDefinitions 解析印刷正文。
const CODE = '11728'
const TOKEN = 'elderthing'

export default {
  code: CODE,
  name: '星之眷族观察者',
  scope: 'enemy',
  implemented: true,
  flags: {
    traits: ['Monster', 'Star Spawn', 'Elite'],
    quantity: 1,
    fight: 4,
    evade: 3,
    health: 4,
    damage: 1,
    horror: 1,
    victory: 1,
    aloof: true,
    hunter: true,
    prey: 'highestIntellect',
  },
  abilities: [{
    kind: 'forced',
    trigger: 'chaosTokenRevealed',
    silent: true,
    label: '调查它所在地点时揭示 elder_thing：交战并立刻攻击',
    criteria: ({ state, source, context }) => {
      if (context?.token !== TOKEN) return false
      const test = state?.skillTest
      if (!test || test.seat !== context.seat) return false
      if (test.actionKind !== 'investigate' || test.target?.kind !== 'location') return false
      if (!source?.id) return false
      return (state.enemies || []).some(enemy => enemy.id === source.id && enemy.location === test.target.id)
    },
    resolve: ({ state, source, context, api }) => {
      const inv = state?.investigators?.[context?.seat]
      if (!inv) return
      api.engage?.(source, inv.seat)
      api.scenario?.attack?.(source, inv)
      api.info?.(`👁️ 「星之眷族观察者」：${inv.name} 调查它所在地点并揭示旧神标记，它与该调查员交战并立刻攻击。`)
    },
  }],
  note: '「调查它所在地点时」按 skillTest.actionKind=investigate 且检定目标地点 = 敌人所在地点判定；'
    + '交战/攻击走 api.engage + api.scenario.attack。冷漠/猎手/猎物来自印刷正文解析。'
    + '近似：「立刻攻击」按剧本攻击入口结算（含攻击窗口/伤害分配），与普通敌人阶段攻击同口径。',
}
