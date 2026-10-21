// 04004 马泰奥神父
// 卡面：[reaction]在一位调查员揭示[auto_fail]混乱标记时：取消该标记并改为将其视作[elder_sign]标记。(每场游戏仅限一次。)
// 卡面：[elder_sign]效果：你检定自动成功。在本次检定结束后，选择一项：
// 卡面：- 抽取1张卡牌并获得1资源。
// 卡面：- 如果此时是你的回合，你本回合可以进行额外一次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 马泰奥神父：旧印自动成功，结束后二选一。

const factory = () => () => ({ delta: 0, autoSuccess: true, chosenReward: true })

export default {
  code: '04004',
  investigator:   {
    "autofailToElderSign": {
      "oncePerGame": true
    },
    "elderSign": {
      "kind": "tfaChosenReward"
    }
  },
  kind: 'investigator',
  elderSign: { id: '04004-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
