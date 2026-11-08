// 08542 罗尔德·埃尔斯沃思（Roald Ellsworth） · 被附身队员 · 敌人
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// [action]：谈判。检定[combat]或[agility](5) 以使埃尔斯沃思放下石头。成功在其上放置 1 资源；失败其攻击你。若其上有 1[per_investigator] 资源，将其加入胜利区。 读点：本条目声明 enemyScript.negotiation 与可谈判 [action]（actionKind: parley）；进度用 api.setScenarioFlag/scenarioFlag 记账，达到阈值时 api.buryEnemyInVictory 加入胜利区（behavior.enemyDefeated 负责划掉名字）。
const PARTNER = '08721'
const CONFIG = {
  "kind": "test",
  "skill": "combat",
  "difficulty": 5,
  "flatOnSuccess": 1,
  "thresholdPerInvestigator": 1
}
const THRESHOLD = state => (CONFIG.thresholdPerInvestigator || 1) * Math.max(1, state.numInvestigators || (state.investigators || []).length || 1)
const progressOf = (api, source) => Number(api.scenarioFlag?.('possessed:' + source.id) || 0)
const addProgress = (api, state, inv, source, amount) => {
  if (!amount) return progressOf(api, source)
  const next = Math.min(THRESHOLD(state), progressOf(api, source) + amount)
  api.setScenarioFlag?.('possessed:' + source.id, next)
  api.info?.('「' + (api.cardName?.(source.code) || source.code) + '」谈判进度 ' + next + '/' + THRESHOLD(state) + '。')
  if (next >= THRESHOLD(state)) {
    api.buryEnemyInVictory?.(source)
    api.setScenarioFlag?.('possessedRescued:' + source.code, true)
    api.info?.('🤝 「' + (api.cardName?.(source.code) || source.code) + '」被说服，加入胜利区。')
  }
  return next
}

export default {
  code: '08542',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    partner: PARTNER,
    negotiation: CONFIG,
    rescueThresholdPerInvestigator: CONFIG.thresholdPerInvestigator || 1,
    crossOutOnDefeat: true,
    ...(CONFIG.retaliate ? { retaliate: true } : {}),
  },
  enemyRule: { victory: 1 },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    cost: { action: 1 },
    label: '谈判：[action]：谈判。检定[combat]或[agility](5) 以使埃尔斯沃思放下石头。成功在其上放置 1 资源；失败其攻击你。若其上有 1[per_investigator] 资源，将其加入胜利区。',
    resolve: ({ state, inv, source, api }) => {
      const finish = amount => addProgress(api, state, inv, source, amount)
      if (CONFIG.kind === 'discardForResources') {
        const max = Math.min(CONFIG.maxDiscard || 2, (inv.hand || []).length)
        const count = max > 0 ? api.choice({ kind: 'effect', source: source.id, seat: inv.seat,
          prompt: '弃掉最多 ' + max + ' 张手牌换取资源（当前进度 ' + progressOf(api, source) + '）。',
          options: Array.from({ length: max + 1 }, (_, n) => ({ id: String(n), label: '弃 ' + n + ' 张' })) }) : 0
        let discarded = 0
        for (let i = 0; i < Number(count); i += 1) {
          const card = (inv.hand || [])[0]
          if (!card) break
          api.discardFromHand?.(inv.seat, card)
          discarded += 1
        }
        finish(discarded)
        return
      }
      if (CONFIG.kind === 'drawTekeliliForResources') {
        const max = CONFIG.maxDraw || 2
        const count = api.choice({ kind: 'effect', source: source.id, seat: inv.seat,
          prompt: '抽取忒咳哩-哩牌库顶最多 ' + max + ' 张。',
          options: Array.from({ length: max + 1 }, (_, n) => ({ id: String(n), label: '抽 ' + n + ' 张' })) })
        const drawn = Number(count) || 0
        if (drawn) api.drawCards?.(inv.seat, drawn)
        finish(drawn)
        return
      }
      if (CONFIG.kind === 'spendResources') {
        const available = Math.min(CONFIG.maxSpend || 3, inv.resources || 0)
        const count = available > 0 ? api.choice({ kind: 'effect', source: source.id, seat: inv.seat,
          prompt: '花费最多 ' + available + ' 资源放在其上进行谈判。',
          options: Array.from({ length: available + 1 }, (_, n) => ({ id: String(n), label: '花费 ' + n + ' 资源' })) }) : 0
        const spent = Math.max(0, Math.min(available, Number(count) || 0))
        if (spent) api.spendResources?.(inv.seat, spent)
        finish(spent)
        return
      }
      // 技能检定型谈判：成功且（每超过难度 1 点 / 固定 1）放置资源；失败其攻击你。
      api.test(inv.seat, CONFIG.skill, CONFIG.difficulty, {
        source: { type: 'scenario', action: 'parley', code: '08542', ability: true },
        resolve: result => {
          if (!result?.success) {
            api.enemyAttackByCard?.(source, (api.cardName?.(source.code) || source.code) + '：谈判失败', inv.seat)
            return
          }
          const margin = Math.max(0, (result.value || 0) - (result.difficulty || CONFIG.difficulty || 0))
          finish(CONFIG.perOverSuccess ? Math.max(1, margin) : (CONFIG.flatOnSuccess || 1))
        },
      })
    },
  }],
}
