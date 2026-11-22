// 12084 悬崖勒马（On the Brink）
// 卡面：每次技能检定最多投入 1 张。
//       如果本次检定失败，将投入本次检定的其他每张卡牌都返回其所有者的手牌并抽取一张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 技能牌 = kind:'commit' 描述子（commitProfile 唯一入口）；两个[万用]图标由 cards-data 提供；
//     「每次检定最多 1 张」由 commit-rules 从卡面文本自动识别；
//   · 失败后的脚本 = skill.onFail 函数（tests.js 的失败结算段逐张调用，07035/60370 同一读点）；
//   · 「其他投入卡返回所有者手牌」= api.setCommitDestination(item, 'hand')（tests.js 检定收尾按
//     item.destination 决定去向的既有读点）；「抽 1 张」= api.drawCards（本卡所有者）。

const CODE = '12084'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '检定失败：其他投入本次检定的卡返回各自手牌，抽 1 张牌',
      skill: {
        maxPerTest: 1,
        onFail: ({ state, inv, source, api }) => {
          const test = state.skillTest
          if (!test) return
          let returned = 0
          for (const item of test.committed || []) {
            if (item === source) continue
            if (item.code === CODE) continue
            if (api.setCommitDestination(item, 'hand')) returned += 1
          }
          const seat = Number.isInteger(source?.seat) ? source.seat : inv.seat
          api.drawCards(seat, 1)
          api.info(`⚖️ 「悬崖勒马」：检定失败，${returned} 张其他投入卡返回手牌，并抽 1 张牌。`)
        },
      },
    },
  ],
  modifiers: [],
}
