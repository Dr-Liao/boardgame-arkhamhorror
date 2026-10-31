// 06112 梦境日记（Dream Diary · Untranslated）
// 卡面：[action]：查找你的绑定卡牌，找出梦的本质，将其加入你的手牌。
// 卡面：[reaction]你在投入了梦的本质的技能检定期间成功并超过了难度至少3点后：在剧本日志中，记录“你洞悉了梦境”。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 绑定集合来自卡面数据（bondedCards: 06113），检索走 api.bonded.retrieve（src/engine/bonded.js）；
//   · 记录走 api.recordResearch（campaign.records + 每名调查员的 research 记录，读点 harm-threat.js）；
//   · 「检定成功且超过难度 ≥3」用旧式反应 criteria.successByAtLeast，窗口 skillTestSuccess
//     （triggerReaction 只枚举 legacyReaction 描述子；state.skillTest.committed 在窗口里仍可读）。

export default {
  code: '06112',
  abilities: [
    {
      kind: 'action',
      label: '查找绑定卡牌：把「梦的本质」加入手牌',
      cost: { action: true },
      resolve: ({ inv, api }) => {
        const taken = api.bonded.retrieve(inv.seat, '06112', { handCount: 1 })
        if (!taken.length) api.info('「梦境日记」的绑定卡牌已不在场外集合中。')
        else api.info(`📖 ${inv.name} 从绑定卡牌中找出「${api.cardName('06113')}」加入手牌。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'skillTestSuccess',
      // triggerReaction 只枚举带 legacyReaction 标记的描述子；criteria 是旧式反应条件字段。
      legacyReaction: true,
      criteria: { successByAtLeast: 3 },
      label: '投入「梦的本质」的检定成功且超过难度 3 点后：记录「你洞悉了梦境」',
      resolve: ({ state, inv, api }) => {
        const committed = (state.skillTest?.committed || []).map(item => item.code)
        if (!committed.includes('06113')) {
          api.info('本次检定没有投入「梦的本质」，不做梦境记录。')
          return
        }
        api.recordResearch('youHaveInterpretedTheDreams')
        api.info(`📜 剧本日志：${inv.name} 记录「你洞悉了梦境」。`)
      },
    },
  ],
  modifiers: [],
}
