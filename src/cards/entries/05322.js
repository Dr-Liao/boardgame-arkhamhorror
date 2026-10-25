// 05322 第六感
// 卡面：[action]：调查。本次调查不使用[intellect]，改为使用[willpower]。你本次调查得到+2[willpower]。
//       如果本次检定期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，你可以选择与你所在地点之间
//       连接次数不超过2的一个已揭示地点；如同你在所在地点调查的同时，也在所选地点调查(你可以使用两个地点中
//       任意一个地点的隐藏值)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：符号效果改成 symbolRevealed 窗口的 reaction（05157/05158 模板，可被 05033「恐怖灵感」取消/再结算）：
//   主能力先给本次调查打上 05322 的 endOfTest 标记（sourceCode='05322'），再用意志 +2 调查；
//   符号窗口里选「2 次连接内的另一已揭示地点」+「用新/原隐藏值」→ api.chooseDualInvestigation，
//   引擎在调查成功时给原地点与所选地点各发现一次线索（actions.doInvestigate 读调查帧 dual）。
// 说明：symbolRevealed 的 context.sourceCard 是「调查地点卡号」（tests.js 读 state.skillTest.source.code，
//   actions.js 把调查 source 固定为地点），不是发起能力的卡号；因此用 endOfTest 标记识别本卡的调查，
//   criteria 同时兼容将来 sourceCard 直接带能力卡号的情况。

const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

// 与 inv 所在地点相距 1–2 次连接、已揭示且在场上的其他地点（不含自身）。
function locationsWithinTwo(state, inv) {
  const here = state.locations.find(location => location.id === inv.location)
  if (!here) return []
  const found = new Map()
  let frontier = [here.id]
  const seen = new Set(frontier)
  for (let depth = 1; depth <= 2; depth++) {
    const next = []
    for (const id of frontier) {
      const location = state.locations.find(item => item.id === id)
      for (const connection of location?.connections || []) {
        if (seen.has(connection)) continue
        seen.add(connection)
        const target = state.locations.find(item => item.id === connection)
        if (target && target.id !== here.id && target.revealed === true && target.inPlay !== false) {
          found.set(target.id, target)
        }
        next.push(connection)
      }
    }
    frontier = next
  }
  return [...found.values()]
}

function thisCardInvestigation(state, inv, context) {
  if (context?.sourceCard === '05322') return true
  return (state.effects || []).some(effect => effect.sourceCode === '05322' && effect.controllerSeat === inv.seat)
}

export default {
  code: '05322',
  abilities: [
    {
      kind: 'action',
      label: '调查（意志代替智力，+2 意志；符号后同时在 2 次连接内另一已揭示地点调查）',
      cost: { action: true },
      resolve: ({ inv, api }) => {
        // 本次调查的来源标记：符号窗口据此限定是第六感发起的调查（endOfTest 到期自动清理）。
        api.addEffect({ duration: 'endOfTest', sourceCode: '05322', label: '第六感：本次调查', modifiers: [] })
        api.investigate(inv.seat, { skill: 'willpower', bonus: 2, sourceCode: '05322' })
      },
    },
    {
      kind: 'reaction', trigger: 'symbolRevealed',
      // 同一场检定只结算一次：窗口在符号揭示后重复枚举候选，不设上限会在同一窗口里重复触发。
      limit: { scope: 'perTest', owner: 'instance' },
      label: '第六感：同时在 2 次连接内的另一已揭示地点调查（新/原隐藏值二选一）',
      criteria: [({ state, inv, context }) => {
        if (!context || context.seat !== inv.seat) return false
        if (!SYMBOLS.includes(context.token)) return false
        if (!thisCardInvestigation(state, inv, context)) return false
        return locationsWithinTwo(state, inv).length > 0
      }],
      resolve: ({ state, inv, api }) => {
        const targets = locationsWithinTwo(state, inv)
        if (!targets.length) return
        const locationId = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'location', source: '05322', seat: inv.seat,
            prompt: '第六感：选择你要同时在彼处调查的、与你所在地点连接次数不超过 2 的已揭示地点。',
            options: targets.map(location => ({ id: location.id, label: location.name || api.locName(location.id) })) })
        const shroud = api.choice({ kind: 'effect', source: '05322', seat: inv.seat,
          prompt: '第六感：使用哪个地点的隐藏值？',
          options: [
            { id: 'new', label: '使用所选地点的隐藏值' },
            { id: 'original', label: '使用原调查地点的隐藏值' },
          ] })
        const chosen = api.chooseDualInvestigation(locationId, { shroud: shroud === 'original' ? 'original' : 'new' })
        if (!chosen) api.info('第六感：无法在所选地点同时调查。')
      },
    },
  ],
  modifiers: [],
}
