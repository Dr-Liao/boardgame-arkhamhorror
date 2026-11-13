// 09108 拨云见日（Shed a Light）· 幸存者事件 · 0 经验
// 卡面：快速。在你执行的调查期间，揭示混乱标记前打出，且本次检定的当前难度值须为 0。
//       本次检定自动成功。你发现此地点额外 1 个线索与任意地点额外 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · beforeChaosTokenReveal 窗口 + played.fast（快速事件统一通道）；
//   · 自动成功：api.setTestAutoSuccess；线索走 api.discoverClue（唯一发现线索入口）。
//   · 「调查检定」判定：优先 state.skillTest.actionKind；引擎只在「有人声明 trackTestTarget」时才写
//     actionKind（tests.js:171-181），本卡是事件、没有该声明，因此回落到检定来源 label
//     （actions.js:606 调查检定的 source.label = '调查'，与 09030 同一读点）。
// approximation: 两次「额外线索」在打出时立即发现（自动成功已保证原检定成功，结果等价）；
//   「任意地点」限定为已揭示且仍有线索的地点（没有可发现线索的地点不提供）。
const code = '09108'

const isInvestigateTest = test => test?.actionKind
  ? test.actionKind === 'investigate'
  : String(test?.source?.label || '').includes('调查')

const inPosition = ({ state, inv }) => {
  const test = state.skillTest
  if (!test || test.seat !== inv.seat) return false
  if (!isInvestigateTest(test)) return false
  return (Number(test.difficulty) || 0) === 0
}

export default {
  code,
  note: 'approximation: 额外线索在打出时立即发现（自动成功保证原检定成功，结果等价）。',
  playCondition: [{ when: inPosition, message: '「拨云见日」只能在难度为 0 的调查检定、揭示标记前打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'beforeChaosTokenReveal',
      criteria: [inPosition],
      label: '本次检定自动成功：本地点与任意地点各额外发现 1 个线索',
      resolve: ({ state, inv, api }) => {
        api.setTestAutoSuccess()
        api.discoverClue(inv.seat, 1, inv.location)
        const candidates = (state.locations || []).filter(location => location.revealed && (location.clues || 0) > 0)
        if (!candidates.length) return
        let locationId = candidates[0].id
        if (candidates.length > 1) {
          locationId = api.choice({
            kind: 'location', source: code, seat: inv.seat,
            prompt: '「拨云见日」：选择额外发现 1 个线索的地点。',
            options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
          })
        }
        if (locationId) api.discoverClue(inv.seat, 1, locationId)
        api.info(`💡 「拨云见日」：${inv.name} 在「${api.locName(inv.location)}」与「${api.locName(locationId)}」各额外发现 1 个线索。`)
      },
    },
  ],
  modifiers: [],
}
