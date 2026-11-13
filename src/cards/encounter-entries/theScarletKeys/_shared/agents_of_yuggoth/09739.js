// 09739 犹格斯星的密使（Emissary from Yuggoth） · 敌人 · agents_of_yuggoth
// 归属：战役共用 · theScarletKeys/_shared/agentsOfYuggoth。
// 卡面：隐匿 2。猎手。庞大。胜利 1。
//   强制 - 你在有隐匿迷你卡牌的地点发现线索后，如果犹格斯星的密使在阴影中：其攻击你。
//   Concealed 2. Hunter. Massive. Victory 1.
//   Forced - After you discover a clue at a location with 1 or more concealed mini-cards, if Emissary from
//   Yuggoth is in the shadows: It attacks you.
// 读点：
//   · 「隐匿 2」= `enemyRule.concealed: 2`——章节 behavior 的 concealedAmountOf 唯一读点
//     （onThinIce/behavior.js:447、shadesOfSuffering/behavior.js；同类 09564/09557/09626/09679a）；
//     content 侧待办：onThinIce/dealingsInTheDark 目前只给「本章自有敌人」分配迷你卡，尚未在
//     共享组敌人入场时统一结算 Concealed 关键词（见汇报「引擎读点清单」）。
//   · 猎手/庞大/胜利点由章节遭遇定义提供（card-data#encounterDefinitions 解析印刷关键词与 victory）；
//   · 「你在有隐匿迷你卡牌的地点发现线索后」= clueDiscovered 窗口（locations.js#discoverCluesAt 派发，
//     context 带 seat/location/amount/lastClue）；
//   · 「在阴影中」= 该敌人有一张未揭露的非诱饵迷你卡（kind === 本卡卡号 / code === 本卡卡号）；
//   · 「该地点有隐匿迷你卡」= concealed 容器里 locationId === context.location（不看正面身份）；
//   · 攻击 = api.attack。
const CODE = '09739'

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
// 迷你卡 kind 只允许字母开头（tsk-concealed 的 KIND_PATTERN），敌人真身统一记作 enemy<卡号>。
const miniKindOf = code => `enemy${code}`
const inShadows = (state, code) => miniCardsIn(state).some(card => !card.decoy && (card.code != null ? card.code === code : card.kind === miniKindOf(code)))

export default {
  code: CODE, scope: 'enemy', implemented: true,
  // 「隐匿 2」：内容层 concealedAmountOf 的唯一声明读点（1 张真身迷你卡 + 每名调查员 1 张诱饵的分配，
  // 由章节 behavior 结算；单卡只能声明这个数值）。
  enemyRule: { concealed: 2 },
  abilities: [{
    kind: 'forced', trigger: 'clueDiscovered', silent: true,
    label: '在有隐匿迷你卡牌的地点发现线索后，若它在阴影中：其攻击你',
    criteria: ({ state, source, context }) => {
      if (!state.enemies.includes(source) || !inShadows(state, CODE)) return false
      if (!Number.isInteger(context?.seat)) return false
      if (context?.location == null) return false
      return miniCardsIn(state).some(card => card.locationId === context.location)
    },
    resolve: ({ state, source, context, api }) => {
      const inv = state.investigators[context.seat]
      if (!inv || inv.defeated || inv.resigned || !state.enemies.includes(source)) return
      api.scenario.attack(source, inv)
      api.info?.(`🪐 ${inv.name} 发现线索后，「${source.name}」从阴影中发动攻击。`)
    },
  }],
  note: 'approximation: 隐匿 2 已按条目声明（enemyRule.concealed:2，内容层 concealedAmountOf 读），但共享组敌人的'
    + '「入场即结算 Concealed」仍缺 content 侧统一入口（引擎只提供 tsk-concealed 的 place/distribute 底层原语）；'
    + '条目实现显现关键词之后的强制能力。请求见 primitive-requests/09739.json。',
}
