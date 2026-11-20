// 11556 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11556',
  scope: 'act',
  implemented: true,
  flags: {"objective":"allAtSanctum","discardPerClue":5,"discardPerClueSolo":10},
  note: "行为在 behavior.actions「apiaryDiscardForLocations」（每花费 1 线索弃 5/单人 10 张并抽取弃掉的地点）、checkObjectives（轮末每位未击败调查员都在[[圣所]]地点可推进）、actReveal（背面按所在圣所进入失落的朝圣者/蜂巢思维幕间）。",
  abilities: [],
}
