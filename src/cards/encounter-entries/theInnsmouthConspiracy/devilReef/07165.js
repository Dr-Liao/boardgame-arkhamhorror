// 07165 大海的秘密（版本二）· 深陷其中
//
// 印刷（中文）：
//   你不在载具上时，作为在[[海洋]]地点间移动的额外费用，你必须花费2行动。
//   强制 - 在你回合开始时，如果你位于完全淹没的地点，你奋力挣扎，求取空气：在你回合结束时，
//          如果你在自己回合期间没有进入过载具、未淹没或部分淹没的地点，受到5点直接伤害。
// 背面（1b）：生成放在一边的「魔鬼礁石的骇物」（07165b），生成在渔船所在地点。
//
// 与 07164 印刷正文完全相同（同为「大海的秘密」的两张阶段版本）：
// 步行额外费用走 `agendaRule.movementActionSurcharge`，求取空气由引擎的水位规则承担。
// 背面 onReveal 同样按「渔船所在地点」生成对应的 07165b；细节见 07164 的注释。

export default {
  code: '07165', scope: 'agenda', implemented: true,
  agendaRule: {
    movementActionSurcharge: { amount: 2, betweenTraits: ['Ocean'] },
    onReveal(state, agenda, api) {
      const boat = (state.storyAssets || []).find(asset => (asset.originalCode || asset.code) === '07178')
      api.spawn('07165b', boat?.location ?? null)
    },
  },
}
