// 60173 巡逻中（On the Beat，1 级）
// 卡面：快速。在你的回合开始时打出。直到你的回合结束，你调查或谈判时得到技能值 +3。
// 读点：played fast + trigger turnBegins（turn.js 窗口）；api.addEffect duration:endOfTurn
// modifiers 条件 when({state}) 读当前检定 actionKind（investigate/parley）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60173'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'turnBegins',
    label: '直到你的回合结束，调查或谈判 +3 技能值',
    criteria: [({ inv, context }) => context?.seat === inv.seat],
    resolve: ({ inv, api }) => api.addEffect({
      duration: 'endOfTurn',
      sourceCode: CODE,
      controllerSeat: inv.seat,
      label: '巡逻中：调查或谈判 +3',
      modifiers: [{
        target: 'skill:*',
        amount: 3,
        condition: { when: ({ state }) => ['investigate', 'parley'].includes(state.skillTest?.actionKind) },
      }],
    }),
  }],
  modifiers: [],
}
