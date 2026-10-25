// 05158 第六感
// 卡面：[action]：调查。本次调查不使用[intellect]，改为使用[willpower]。
// 如果本次检定期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，
// 你可以选择与你所在地点连接的一个已揭示地点；改为如同你在所选地点调查，而不是在你当前所在地点
// (你可以使用两个地点中任意一个地点的隐藏值)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：主能力改为 resolve（先给本次调查打上 05158 的持续效果标记，再调用 api.investigate 用意志调查），
// 符号窗口（symbolRevealed，context 带 token/sourceCard）里再挂一条 reaction：
// 选连接已揭示地点 + 选新/原隐藏值 → api.retargetInvestigation（引擎把难度改成所选地点完整当前隐藏值，
// 成功时线索发现到新目标地点，actions.doInvestigate 已读调查帧）。
// 说明：doInvestigate 的 test.source.code 是「调查地点卡号」，因此「由 05158 发起」用持续效果标记
// （sourceCode='05158'，duration endOfTest）识别；若未来 sourceCard 直接带能力卡号，criteria 亦兼容。

const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

function connectedRevealedLocations(state, inv) {
  const here = state.locations.find(location => location.id === inv.location)
  return (here?.connections || [])
    .map(id => state.locations.find(location => location.id === id))
    .filter(location => location && location.revealed === true && location.inPlay !== false)
}

function mineThisTest(state, inv, context) {
  if (context?.sourceCard === '05158') return true
  return (state.effects || []).some(effect => effect.sourceCode === '05158')
}

export default {
  code: '05158',
  abilities: [
    {
      kind: 'action', label: '用意志调查',
      cost: { action: true },
      resolve: ({ inv, api }) => {
        // 本次调查的「来源」标记：符号窗口据此限定是第六感发起的调查。
        api.addEffect({ duration: 'endOfTest', sourceCode: '05158', label: '第六感：本次调查', modifiers: [] })
        api.investigate(inv.seat, { skill: 'willpower' })
      },
    },
    {
      kind: 'reaction', trigger: 'symbolRevealed',
      label: '第六感：改为在连接的已揭示地点调查',
      criteria: [({ state, inv, context }) => {
        if (!context || context.seat !== inv.seat) return false
        if (!SYMBOLS.includes(context.token)) return false
        if (!mineThisTest(state, inv, context)) return false
        return connectedRevealedLocations(state, inv).length > 0
      }],
      resolve: ({ state, inv, api }) => {
        const targets = connectedRevealedLocations(state, inv)
        if (!targets.length) return
        const locationId = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'location', source: '05158', seat: inv.seat,
            prompt: '第六感：选择你要改为调查的、与你所在地点连接的已揭示地点。',
            options: targets.map(location => ({ id: location.id, label: location.name || api.locName(location.id) })) })
        const shroud = api.choice({ kind: 'effect', source: '05158', seat: inv.seat,
          prompt: '第六感：使用哪个地点的隐藏值？',
          options: [
            { id: 'new', label: '使用所选地点的隐藏值' },
            { id: 'original', label: '使用原调查地点的隐藏值' },
          ] })
        const retargeted = api.retargetInvestigation(locationId, { shroud: shroud === 'original' ? 'original' : 'new' })
        if (!retargeted) api.info('第六感：无法改为在所选地点调查。')
      },
    },
  ],
  modifiers: [],
}
