// 10078 告密（Snitch）· 潜袭者（Rogue）事件 · 1 费 · 2 经验 · [[人情]]/[[诡计]]。
// 卡面：快速。你谈判时技能检定成功后打出。
//       发现你所在地点和连接地点的总计 2 个线索。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「快速。谈判检定成功后打出」→ played + fast + trigger:['testEnds']；testEnds 窗口由
//     reactionWindow 枚举手牌快速事件（played+fast+trigger 的统一通道）。criteria 同时要求
//     context.result.success 与 state.skillTest.actionKind==='parley'（source 由谈判事件写入）。
//   · 「发现……总计 2 个线索」→ 逐点 api.choice 选地点 + api.discoverClue（含 canDiscoverClueAt
//     过滤），候选 = 所在地点 + 连接地点。
const CODE = '10078'

// 谈判检定的统一识别：api.test 写入的 actionKind、旧来源的 action/actionKind 字段都算。
const duringParley = state => {
  const test = state.skillTest
  if (!test) return false
  return test.actionKind === 'parley' || test.source?.actionKind === 'parley'
    || test.source?.action === 'parley' || test.target?.actionKind === 'parley'
}

const clueLocations = (state, inv, api) => {
  const here = (state.locations || []).find(location => location.id === inv.location)
  const ids = [inv.location, ...(here?.connections || [])]
  return ids
    .map(id => (state.locations || []).find(location => location.id === id))
    .filter(location => Boolean(location) && (Number(location.clues) || 0) > 0
      && api.canDiscoverClueAt(inv.seat, location.id))
}

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'testEnds',
      label: '快速（谈判检定成功后）：发现所在地点和连接地点的总计 2 个线索',
      criteria: [({ state, inv, context }) => {
        if (context?.result?.success !== true) return false
        if (state.skillTest?.seat !== inv.seat) return false
        return duringParley(state)
      }],
      resolve: ({ state, inv, api }) => {
        let found = 0
        for (let point = 0; point < 2; point++) {
          const candidates = clueLocations(state, inv, api)
          if (!candidates.length) break
          const locationId = candidates.length === 1 ? candidates[0].id : api.choice({
            kind: 'location', source: CODE, seat: inv.seat,
            prompt: `🐦 「告密」：第 ${point + 1}/2 个线索从哪个地点发现？`,
            options: candidates.map(location => ({
              id: location.id, cardCode: location.code,
              label: `${api.locationName(location.id)}（${location.clues} 线索）`,
            })),
          })
          const got = api.discoverClue(inv.seat, 1, locationId)
          if (!got) break
          found += got
        }
        if (found > 0) api.info(`🐦 「告密」：${inv.name} 从所在地点或其连接地点发现 ${found} 个线索。`)
        else api.info('🐦 「告密」：所在地点与连接地点都没有可发现的线索。')
      },
    },
  ],
  modifiers: [],
}
