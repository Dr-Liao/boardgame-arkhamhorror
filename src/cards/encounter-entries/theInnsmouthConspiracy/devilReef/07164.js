// 07164 大海的秘密（版本一）· 深陷其中
//
// 印刷（中文）：
//   你不在载具上时，作为在[[海洋]]地点间移动的额外费用，你必须花费2行动。
//   强制 - 在你回合开始时，如果你位于完全淹没的地点，你奋力挣扎，求取空气：在你回合结束时，
//          如果你在自己回合期间没有进入过载具、未淹没或部分淹没的地点，受到5点直接伤害。
// 背面（1b）：生成放在一边的「魔鬼礁石的骇物」（07164b），生成在渔船所在地点。
//
// 引擎读点：
//   · 第一句是**步行额外行动费用**：`agendaRule.movementActionSurcharge: { amount: 2, betweenTraits: ['Ocean'] }`，
//     读点在 turn-flow.js 的 movementActionSurcharge——只加在基础移动行动（move）上，起止地点都要有
//     该特性，在载具上的调查员不付。
//   · 第二句是引擎的**求取空气**规则：turn.js 在回合开始调用 flood.beginAirTurn、移动时
//     checkAirAfterMove、回合结束 endAirTurn 结算 5 点直接伤害；完全淹没＝有效淹没等级 ≥ 2，
//     载具内的淹没保护由 effectiveFloodLevel 自己算。规则是水位驱动的，所以不需要条目再声明一遍。
//   · 背面「生成 - 渔船所在地点」= `agendaRule.onReveal`（读点 content/.../entry-rules.js#agendaReveal）：
//     渔船是 middle-setup.js 放入 state.storyAssets 的 07178 剧情资产；取其实例 location 交给
//     `api.spawn('07164b', location)`（07164b 条目自带 spawnAtStoryAsset/cannotEnterTraits/enemyHealth
//     读点）。渔船不在场时回退 `api.spawn('07164b')`（走敌人自己声明的生成规则）。

export default {
  code: '07164', scope: 'agenda', implemented: true,
  agendaRule: {
    movementActionSurcharge: { amount: 2, betweenTraits: ['Ocean'] },
    onReveal(state, agenda, api) {
      const boat = (state.storyAssets || []).find(asset => (asset.originalCode || asset.code) === '07178')
      api.spawn('07164b', boat?.location ?? null)
    },
  },
}
