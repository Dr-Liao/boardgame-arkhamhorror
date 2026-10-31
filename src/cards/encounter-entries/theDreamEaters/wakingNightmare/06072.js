// 06072 实验疗法病房（Experimental Therapies Ward）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：[reaction] 当你调查「实验疗法病房」时，受到 1 点恐惧：本次调查该地点获得 -2 帷幕。
// 读点：数据 flag → 章节 behavior.beforeInvestigate（调查行动结算前询问）与
//   behavior.locationShroudModifier（本次调查 -2 帷幕）、behavior.afterInvestigate（清除本次修正）。
// 简化：卡面是「调查时」的反应窗口，引擎没有调查内的可选反应读点；behavior 在调查开始前询问，
//   等价于「本次调查」的时机，见 simplified[]。
const CODE = '06072'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: {
    investigateReactionHorrorForShroud: { horror: 1, shroud: -2 },
  },
}
