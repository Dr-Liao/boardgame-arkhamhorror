function replace({ state, api }) {
  api.chaosTokens.replace('curse', 'bless', state.chaosBag.filter(token => token === 'curse').length)
  api.chaosTokens.scheduleReplacement('bless', 'curse')
}
export default { code: '07030', abilities: [
  { kind: 'played', fast: true, label: '将袋内诅咒替换成祝福，轮末反转', resolve: replace },
  { kind: 'reaction', trigger: 'roundStarts', fromHand: true, label: '轮初：将袋内诅咒替换成祝福，轮末反转', resolve: replace },
] }
