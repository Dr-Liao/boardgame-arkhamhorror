// 09727b 结社刺客（Coterie Assassin） · 敌人 · cleanup_crew
// 归属：战役共用 · theScarletKeys/_shared/cleanupCrew（A/B 同名印刷卡，各自一文件）。
// 卡面：隐匿 1。
//   强制 - 当敌军阶段结束时，如果结社刺客在阴影中：其攻击每位所在地点有隐匿迷你卡牌的调查员。
// 读点（与 09727a 同一份，只换印刷卡号）：
//   · 「敌军阶段结束时」用维持阶段开始的 phaseBegins 等价结算（引擎未派发 enemyPhaseEnds）；
//   · 「在阴影中」= 该敌人有未揭露的非诱饵迷你卡（kind === 本卡卡号）；
//   · 攻击 = api.attack。
const CODE = '09727b'

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
// 迷你卡 kind 只允许字母开头（tsk-concealed 的 KIND_PATTERN），敌人真身统一记作 enemy<卡号>。
const miniKindOf = code => `enemy${code}`
const inShadows = (state, code) => miniCardsIn(state).some(card => !card.decoy && (card.code != null ? card.code === code : card.kind === miniKindOf(code)))

export default {
  code: CODE, scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'phaseBegins', silent: true,
    label: '敌军阶段结束时，若它在阴影中：攻击每位所在地点有隐匿迷你卡牌的调查员',
    criteria: ({ state, source }) => state.phase === 'upkeep'
      && state.enemies.includes(source) && inShadows(state, CODE),
    resolve: ({ state, source, api }) => {
      const locations = new Set(miniCardsIn(state).map(card => card.locationId))
      const targets = state.investigators.filter(inv => !inv.defeated && !inv.resigned && locations.has(inv.location))
      for (const inv of targets) {
        if (!state.enemies.includes(source)) break
        if (inv.defeated || inv.resigned) continue
        api.scenario.attack(source, inv)
      }
      if (targets.length) api.info?.(`🥷 「${source.name}」从阴影中袭击了 ${targets.length} 位调查员。`)
    },
  }],
  note: 'approximation: 「敌军阶段结束」用维持阶段开始的 phaseBegins 等价时机结算（引擎未派发 enemyPhaseEnds）；'
    + '隐匿关键词的生成/分配入口属共享层（请求见 primitive-requests/09727b.json）。',
}
