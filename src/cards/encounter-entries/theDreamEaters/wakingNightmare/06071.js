// 06071 急救病房（Emergency Room）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：当你在急救病房时，你的每次技能检定，其难度 +1（每张投入本次检定的卡牌）。
// 读点：数据 flag → 章节 behavior 的 testDifficultyModifier / beforeCommitCard 读取。
// 简化：引擎的检定难度在检定开始时固定，没有「投入后难度重算」读点；behavior 在 beforeCommitCard
//   里按已投入张数递增 state.skillTest.difficulty（对揭示符号标记的检定在符号窗口会回读该值），
//   无符号标记的检定可能仍按初始难度结算——见 w-p8-a.json 的 simplified[]。
export default {
  code: '06071',
  scope: 'location',
  implemented: true,
  flags: {
    difficultyPerCommittedCard: 1,
  },
}
