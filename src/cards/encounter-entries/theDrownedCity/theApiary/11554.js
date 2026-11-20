// 11554 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11554',
  scope: 'agenda',
  implemented: true,
  flags: {"backPlacesClues":true,"backShufflesGrotesque":true},
  note: "data-type：阈值 doom=12；正面无强制。背面在 behavior.agendaReveal：在每处无胜利 X 的地点放线索直到线索值，并把放一边的奇丑混种与遭遇弃牌堆洗到遭遇牌库底。",
  abilities: [],
}
