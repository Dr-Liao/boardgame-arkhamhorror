// 11558 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11558',
  scope: 'act',
  implemented: true,
  flags: {"objective":"motherDefeated","roundEndCoinRotate":"centralChamber"},
  note: "行为在 behavior.actions「apiaryCluesForDamage」、roundEnded（掷币旋转中央腔室）、checkObjectives（主母被击败立刻推进）、actReveal（背面 → 结局 3）。",
  abilities: [],
}
