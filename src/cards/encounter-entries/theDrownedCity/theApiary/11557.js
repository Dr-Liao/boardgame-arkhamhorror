// 11557 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11557',
  scope: 'act',
  implemented: true,
  flags: {"parley":{"skills":["intellect","combat"],"difficulty":2},"objective":"cultistCardsAtLeast","amount":5},
  note: "行为在 behavior.actions「apiaryParleyCultist」、checkObjectives（轮末异教徒卡牌合计 ≥5 必须推进）、actReveal（背面按幕下异教徒 ≥3 张进入结局 1，否则结局 2）。近似：「每成功超出难度 1 点移动一次」只实现一次移动；异教徒获得「冷漠 / 胜利 0」未接线（无条目级修饰读点）。",
  abilities: [],
}
