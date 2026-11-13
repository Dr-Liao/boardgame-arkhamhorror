// 09734 异界仿体（Otherworldly Mimic） · 敌人 · secret_war
// 归属：战役共用 · theScarletKeys/_shared/secretWar。
// 卡面：冷漠。猎手。
//   强制 - 如果异界仿体处于重整状态，其所在地点的调查员在将放在一边的空洞的同名卡牌打出、投入，
//   或触发其能力时：它攻击该调查员。
//   Aloof. Hunter. Forced - If Otherworldly Mimic is ready, when an investigator at its location plays,
//   commits, or triggers an ability on a copy of a set-aside hollow: It attacks that investigator.
// 读点：
//   · 冷漠/猎手由章节遭遇定义提供（card-data#encounterDefinitions 解析印刷关键词）；
//   · 「打出卡牌」= eventPlayed（事件打出后）与 assetEnteredPlay（支援入场后）两个引擎窗口；
//   · 「投入卡牌」= committedCard（tests.js 派发，context 带 cardCode/seat/location）；
//   · 「触发了卡牌的能力」= assetActionResolved（ability-exec.js 派发，context 带 assetCode/seat）；
//   · 「同名的放在一边的空洞」= api.mechanics.tsk.hollow.cards()（tsk-hollow 只读视图）里同卡号的记录；
//   · 攻击 = api.attack（唯一攻击结算入口）。
const CODE = '09734'

const hollowCodes = state => new Set((state.scenarioFlags?.mechanics?.tsk?.hollows?.cards || []).map(card => card.code))
const codeOf = context => context?.cardCode || context?.assetCode || context?.asset?.code || null

export default {
  code: CODE, scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: ['eventPlayed', 'assetEnteredPlay', 'committedCard', 'assetActionResolved'], silent: true,
    label: '重整时，本地点的调查员打出/投入/触发空洞同名卡牌的能力：它攻击该调查员',
    criteria: ({ state, source, context }) => {
      if (!state.enemies.includes(source) || source.exhausted === true) return false
      const code = codeOf(context)
      if (!code || !hollowCodes(state).has(code)) return false
      const seat = Number.isInteger(context?.seat) ? context.seat : null
      if (seat == null) return false
      const inv = state.investigators[seat]
      return Boolean(inv) && !inv.defeated && !inv.resigned && inv.location === source.location
    },
    resolve: ({ state, source, context, api }) => {
      const inv = state.investigators[context.seat]
      if (!inv || !state.enemies.includes(source)) return
      api.scenario.attack(source, inv)
      api.info?.(`🪞 「${source.name}」模仿了空洞中的「${api.cardName(codeOf(context))}」，攻击 ${inv.name}。`)
    },
  }],
  note: 'approximation: 三种触发各自映射到既有引擎窗口（eventPlayed / assetEnteredPlay / committedCard / '
    + 'assetActionResolved）；「在别处触发的同名卡能力」不会命中（窗口只覆盖本地点的这些时机）。无缺读点。',
}
