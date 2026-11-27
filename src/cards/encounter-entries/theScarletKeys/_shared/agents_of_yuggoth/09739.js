// 09739 犹格斯星的密使（Emissary from Yuggoth） · 敌人 · agents_of_yuggoth
// 归属：战役共用 · theScarletKeys/_shared/agentsOfYuggoth。
// 卡面：隐匿 2。猎手。庞大。胜利 1。
//   强制 - 你在有隐匿迷你卡牌的地点发现线索后，如果犹格斯星的密使在阴影中：其攻击你。
//   Concealed 2. Hunter. Massive. Victory 1.
//   Forced - After you discover a clue at a location with 1 or more concealed mini-cards, if Emissary from
//   Yuggoth is in the shadows: It attacks you.
// 读点：
//   · 「隐匿 2」= 共享敌人入场时放置一张真身和两张诱饵。
//   · 猎手/庞大/胜利点由章节遭遇定义提供（card-data#encounterDefinitions 解析印刷关键词与 victory）；
//   · 「你在有隐匿迷你卡牌的地点发现线索后」= clueDiscovered 窗口（locations.js#discoverCluesAt 派发，
//     context 带 seat/location/amount/lastClue）；
//   · 「在阴影中」= 在场且尚未移动到任一地点；
//   · 「该地点有隐匿迷你卡」= concealed 容器里 locationId === context.location（不看正面身份）；
//   · 攻击 = api.attack。
const CODE = '09739'

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyRule: { concealed: 2, sharedConcealed: true },
  abilities: [{
    kind: 'forced', trigger: 'clueDiscovered', silent: true,
    label: '在有隐匿迷你卡牌的地点发现线索后，若它在阴影中：其攻击你',
    criteria: ({ state, source, context }) => {
      if (!state.enemies.includes(source) || source.location != null) return false
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
}
