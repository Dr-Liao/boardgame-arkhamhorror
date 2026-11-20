// 11537 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11537',
  scope: 'agenda',
  implemented: true,
  flags: {"air":true,"backSpawns":"11537b"},
  note: "data-type：阈值为卡表 doom=7；正面「挣扎呼吸空气」由 scenario.mechanics.water.air 执行；背面（双面议程的另一面 = 11537b 海底利维坦）在 behavior.agendaReveal 生成敌人。",
  abilities: [],
}
