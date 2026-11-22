// 60268 确立动机（Establish Motive）
// 卡面：如果本次技能检定成功，执行检定的调查员查找其牌库顶 6 张卡，找出一张[[洞察]]事件，抽取并混洗牌库。
// 读点：commit 描述子 skill.onSuccessResolve（60228 同读点）+ api.searchTop traits。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60268',
  abilities: [{
    kind: 'commit',
    label: '若检定成功：查找牌库顶 6 张中的一张[[洞察]]事件',
    skill: {
      onSuccessResolve: ({ state, api }) => {
        const seat = state.skillTest?.seat
        if (!Number.isInteger(seat)) return
        api.searchTop(seat, {
          amount: 6, trait: 'Insight', choose: 1, source: '60268',
          prompt: '查找牌库顶 6 张，选择 1 张[[洞察]]事件抽取，其余洗回。',
        })
      },
    },
  }],
  modifiers: [],
}
