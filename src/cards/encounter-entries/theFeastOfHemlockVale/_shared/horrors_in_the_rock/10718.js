// 10718 虹彩通道（Iridescent Passage）· 地点 · 共享遭遇组 horrors_in_the_rock
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10718）：
//   强制 - 在你调查虹彩通道时，技能检定失败后：选择并弃掉你 1 张手牌。
//
// 读点（声明即接线）：investigateFail 窗口（actions.js#doInvestigate 的失败结算点，
//   context 带 seat / location / failedBy），地点作为非玩家实体来源按其 id 过滤；
//   「选择并弃掉」走 api.choice + api.discardFromHand（deck-ops.js 的唯一弃手牌入口，
//   保留手牌弃置窗口与「该牌离开手牌后」的反应）。
const CODE = '10718'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Cave'],
    printedShroud: 3,
    printedClues: 2,
    quantity: 1,
    investigateFailDiscard: 1,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'investigateFail',
    silent: true,
    label: '调查虹彩通道失败后：选择并弃掉 1 张手牌',
    criteria: [({ inv, source, context }) => context?.location === source?.id
      && (inv.hand || []).length > 0],
    resolve: ({ inv, api }) => {
      const codes = [...new Set(inv.hand || [])]
      if (!codes.length) return
      const answer = codes.length === 1 ? codes[0] : String(api.choice({
        kind: 'card', source: CODE, seat: inv.seat,
        prompt: '虹彩通道：选择并弃掉 1 张手牌。',
        options: codes.map(code => ({ id: code, label: api.cardName?.(code) || code, cardCode: code })),
      }))
      const code = codes.includes(answer) ? answer : codes[0]
      api.discardFromHand(inv.seat, code)
      api.info?.(`🪞 「虹彩通道」：${inv.name} 调查失败，弃掉「${api.cardName?.(code) || code}」。`)
    },
  }],
  note: '「调查失败」按 investigateFail 窗口结算（只在本地点调查时触发）；弃手牌走 api.discardFromHand。',
}
