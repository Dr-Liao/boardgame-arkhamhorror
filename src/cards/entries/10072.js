// 10072 “我肯定还！”（"I'll Pay You Back!"）· 潜袭者（Rogue）事件 · 0 费 · [[策略]]/[[诡计]]。
// 卡面：快速。只能在你的回合期间打出。
//       选择你所在地点的另一位调查员。将该调查员资源池的所有资源移动到你的资源池。
//       当本轮结束时，将你资源池的所有资源移动到该调查员的资源池。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「快速。只能在你的回合期间打出」→ played.fast + playCondition ownTurn()。
//   · 「移走全部资源」→ api.loseResources + api.gainResources（引擎没有“移动资源”原语；
//     失去/获得各自走统一读点，因此“不能失去资源”等修正会照常生效——见 note/primitive request）。
//   · 「本轮结束时还回去」→ 打出后 returnToHandAfterPlay 让本卡留在手牌；手牌里的 forced 描述子
//     trigger:'roundEnds' 由 window-listeners 扫手牌 → 轮末窗口打开 → 自动结算。
//     目标座位记在 api.addEffect 的 endOfRound 记录里（不新造 state 字段；effect 到期自动清理）。

// 「只能在自己回合期间打出」的纯判据（与 engine/matcher.js#ownTurn 同口径；卡文件不 import 引擎）。
const ownTurn = () => ctx => {
  const { state, inv } = ctx || {}
  return state?.phase === 'investigation' && state?.currentSeat === inv?.seat
}


const CODE = '10072'
const RETURN_PREFIX = `${CODE}:returnTo:`

const pendingReturn = state => (state.effects || []).find(effect =>
  effect.sourceCode === CODE && typeof effect.sourceInstanceId === 'string'
  && effect.sourceInstanceId.startsWith(RETURN_PREFIX)) || null

const othersHere = (state, inv) => (state.investigators || []).filter(other =>
  other && other.seat !== inv.seat && other.location === inv.location && !other.defeated && !other.resigned)

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: 引擎没有「移动资源」原语，本期用 loseResources + gainResources 等价实现（失去资源的替代/防止会生效）；轮末返还通过 returnToHandAfterPlay + 手牌 forced(roundEnds) 结算，期间本卡留在手牌（playCondition 挡住重复打出）；目标座位记在 endOfRound effect 的 sourceInstanceId 上。见 primitive-requests/10072.json。',
  returnToHandAfterPlay: true,
  playCondition: [
    ownTurn(),
    {
      when: ({ state }) => !pendingReturn(state),
      message: '「我肯定还！」的轮末返还尚未结算，不能再次打出',
    },
    {
      when: ({ state, inv }) => othersHere(state, inv).length > 0,
      message: '你所在地点没有另一位调查员',
    },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：把同地点另一位调查员的全部资源移到你的资源池；本轮结束时还回去',
      resolve: ({ state, inv, api }) => {
        const others = othersHere(state, inv)
        if (!others.length) {
          api.info('「我肯定还！」：你所在地点没有另一位调查员。')
          return
        }
        const seat = Number(others.length === 1 ? others[0].seat : api.choice({
          kind: 'investigator', source: CODE, seat: inv.seat,
          prompt: '「我肯定还！」：选择要借用资源的同地点调查员。',
          options: others.map(other => ({ id: String(other.seat), label: `${other.name}（${other.resources} 资源）` })),
        }))
        const target = others.find(other => other.seat === seat) || others[0]
        const amount = Math.max(0, Number(target.resources) || 0)
        if (amount > 0) {
          const lost = Number(api.loseResources(target.seat, amount)) || 0
          if (lost > 0) {
            api.gainResources(inv.seat, lost)
            api.info(`💸 「我肯定还！」：${target.name} 的 ${lost} 资源移到 ${inv.name} 的资源池；本轮结束时归还。`)
          }
        } else {
          api.info(`💸 「我肯定还！」：${target.name} 没有资源，本轮结束时也不会有资源需要归还。`)
        }
        api.addEffect({
          duration: 'endOfRound',
          sourceCode: CODE,
          sourceInstanceId: `${RETURN_PREFIX}${target.seat}`,
          controllerSeat: inv.seat,
          label: '「我肯定还！」：本轮结束时把资源还给该调查员',
        }, inv.seat)
      },
    },
    {
      kind: 'forced',
      trigger: 'roundEnds',
      fromHand: true,
      noPlayCost: true,
      label: '本轮结束时：把你资源池的所有资源移到该调查员的资源池，然后弃掉本卡',
      criteria: [({ state, inv }) => Boolean(pendingReturn(state))
        && Number.isInteger(Number(String(pendingReturn(state).sourceInstanceId).slice(RETURN_PREFIX.length)))
        && (inv.hand || []).includes(CODE)],
      resolve: ({ state, inv, api }) => {
        const effect = pendingReturn(state)
        if (!effect) return
        const targetSeat = Number(String(effect.sourceInstanceId).slice(RETURN_PREFIX.length))
        const target = state.investigators[targetSeat]
        const amount = Math.max(0, Number(inv.resources) || 0)
        if (amount > 0) {
          const lost = Number(api.loseResources(inv.seat, amount)) || 0
          if (lost > 0 && target) api.gainResources(targetSeat, lost)
          api.info(`💸 「我肯定还！」：本轮结束，${inv.name} 把 ${lost} 资源还给 ${target?.name || '所选调查员'}。`)
        }
        api.putInDiscard(inv.seat, CODE, { fromHand: true })
      },
    },
  ],
  modifiers: [],
}
