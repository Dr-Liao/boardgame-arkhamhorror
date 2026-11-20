import { ownSeat } from '../../engine/matcher.js'

export function agathaEntry(code) {
  return {
    code,
    investigator: { trackChaosTokenChanges: true, elderSign: { bonus: 2 } },
    elderSign: { id: code + '-sign', resolve: ({ state, inv, api }) => {
      if (!state.chaosBag.length) return { delta: 2 }
      const choice = api.choice({
        kind: 'token', source: inv.code, seat: inv.seat, prompt: '是否取消旧印并揭示另一枚标记？',
        options: [{ id: 'keep', label: '保留旧印（+2）' }, { id: 'replace', label: '重抽并抽 1 张牌' }],
      })
      return choice === 'replace' ? { delta: 0, redraw: true, draw: 1 } : { delta: 2 }
    } },
    abilities: [{
      kind: 'reaction', trigger: 'turnEnded', limit: { scope: 'perTurn', owner: 'player' }, label: '从弃牌堆打出一个法术或洞察事件',
      criteria: [ownSeat(), ({ state, inv, helpers }) => inv.chaosTokenChangeRound === state.round
        && helpers.eventPlayChoices({ from: 'discard', traits: ['spell', 'insight'] }).length > 0],
      resolve: ({ inv, api }) => api.offerEventPlay(inv.seat, {
        from: 'discard', traits: ['spell', 'insight'], removeAfter: true, source: inv.code,
      }),
    }],
  }
}
export default agathaEntry('11007')
