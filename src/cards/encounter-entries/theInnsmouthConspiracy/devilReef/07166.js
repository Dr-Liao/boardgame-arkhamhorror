// 07166 深海的魔鬼 · 深陷其中
//
// 印刷（中文）：
//   你不在载具上时，作为在[[海洋]]地点间移动的额外费用，你必须花费2行动。
//   强制 - 在你回合开始时，如果你位于完全淹没的地点，你奋力挣扎，求取空气：在你回合结束时，
//          如果你在自己回合期间没有进入过载具、未淹没或部分淹没的地点，受到5点直接伤害。
//
// 与 07164/07165 印刷正文相同：步行额外费用走 `agendaRule.movementActionSurcharge`，
// 求取空气由引擎的水位规则承担。细节见 07164 的注释。

export default {
  code: '07166', scope: 'agenda', implemented: true,
  agendaRule: { movementActionSurcharge: { amount: 2, betweenTraits: ['Ocean'] } },
}
