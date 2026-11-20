// 11538 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11538',
  scope: 'agenda',
  implemented: true,
  flags: {"air":true,"backDefeatsAll":true},
  note: "data-type：阈值为卡表 doom=7；正面空气规则同 11537；背面在 behavior.agendaReveal：每位存活调查员 1 点肉体创伤并被击败、进入无结局。",
  abilities: [],
}
