// 09726b 结社打手（Coterie Enforcer） · 敌人 · cleanup_crew
// 归属：战役共用 · theScarletKeys/_shared/cleanupCrew（A/B 两张同名印刷卡，行为逐字相同、各自一文件）。
// 卡面：隐匿 1。
//   强制 - 你揭露阴影中其他名称的敌人后，如果结社打手在阴影中：其攻击你。
//   Concealed 1. Forced - After you expose an enemy in the shadows not named Coterie Enforcer, if
//   Coterie Enforcer is in the shadows: It attacks you.
// 读点（与 09726a 同一份，只换印刷卡号）：
//   · 「在阴影中」= 该敌人有一张未揭露的非诱饵迷你卡（kind === 本卡卡号）；
//   · 「揭露后」= tskExposed 窗口；引擎当前未派发（请求见 primitive-requests/09726b.json）；
//   · 敌人攻击 = api.scenario.attack（描述子里走 api.scenario 别名）。
const CODE = '09726b'

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
// 迷你卡 kind 只允许字母开头（tsk-concealed 的 KIND_PATTERN），敌人真身统一记作 enemy<卡号>。
const miniKindOf = code => `enemy${code}`
const inShadows = (state, code) => miniCardsIn(state).some(card => !card.decoy && (card.code != null ? card.code === code : card.kind === miniKindOf(code)))
const SAME_PRINTED_NAME = new Set(['enemy09726a', 'enemy09726b', '09726a', '09726b'])

export default {
  code: CODE, scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'tskExposed', silent: true,
    label: '你揭露阴影中其他名称的敌人后，若它在阴影中：其攻击你',
    criteria: ({ state, context }) => (context?.code ?? context?.kind) != null && context.decoy !== true
      && !SAME_PRINTED_NAME.has(context.code ?? context.kind) && !SAME_PRINTED_NAME.has(context.kind) && inShadows(state, CODE),
    resolve: ({ state, source, context, api }) => {
      if (!state.enemies.includes(source)) return
      const seat = Number.isInteger(context?.seat) ? context.seat : api.scenario.decideSeat()
      const inv = state.investigators[seat]
      if (!inv || inv.defeated || inv.resigned) return
      api.scenario.attack(source, inv)
      api.info?.(`🥷 「${source.name}」从阴影中扑向 ${inv.name}。`)
    },
  }],
  note: 'approximation: 隐匿关键词的「生成时进入阴影并分配迷你卡」属于章节/共享层入口（引擎没有 spawn→shadows 读点），'
    + '条目只实现显现关键词之后的强制能力；「揭露后」时机依赖 tskExposed 窗口派发（引擎当前未开窗）。'
    + '请求见 primitive-requests/09726b.json。',
}
