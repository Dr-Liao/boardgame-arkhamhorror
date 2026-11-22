// 60180 坚韧不屈（Indomitable，3 级）
// 卡面：如果本轮本地点有敌人攻击了调查员，坚韧不屈获得[wild][wild][wild]。
// 读点：commit 描述子 + reaction trigger committedCard；api.addCommittedExtraIcons(wild) x3。
// 「本轮本地点有敌人攻击过调查员」用 api.eoteAttackedThisRound（eote-investigator-support 的攻击记账）近似。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60180'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      skill: {},
      label: '本轮本地点有敌人攻击过调查员时：获得 3 个万能图标',
    },
    {
      kind: 'reaction',
      trigger: 'committedCard',
      label: '条件满足时：本次投入 +3 万能图标',
      criteria: [({ state, inv, context }) => {
        if (context?.cardCode !== CODE || context?.seat !== inv.seat) return false
        // 读点：inv.attackedSinceTurnEnd（引擎攻击记账）里本轮有记录，且攻击发生在本地点的调查员。
        const atLocation = state.investigators.filter(owner => !owner.defeated && !owner.resigned
          && owner.location === inv.location)
        return atLocation.some(owner => (owner.attackedSinceTurnEnd || [])
          .some(item => item && item.round === state.round && item.enemyId))
      }],
      resolve: ({ api }) => {
        api.addCommittedExtraIcons('wild')
        api.addCommittedExtraIcons('wild')
        api.addCommittedExtraIcons('wild')
      },
    },
  ],
  note: "",
  modifiers: [],
}
