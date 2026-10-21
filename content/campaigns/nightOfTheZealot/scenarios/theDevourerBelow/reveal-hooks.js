// 「地底噬魔」幕/密谋揭示（第 5 批从 src/engine/reveal.js 与 phases.js 搬出）。
export function agendaForcedEnemyDefeated(state, enemy, api) {
  const forced = state.agendas[state.agendaIndex]?.forced?.enemyDefeated
  if (!forced || forced.type !== 'umordhothDefeated') return false
  if (enemy.code !== 'umordhoth') return false
  api.finish('r2')
  return true
}

// 乌默尔多斯在每位调查员回合结束时重整（原 actions-extra.js 的 readyUmordhoth）。
export function turnEnded(state, inv, api) {
  const boss = state.enemies.find(enemy => enemy.code === 'umordhoth' && enemy.exhausted)
  if (!boss) return
  boss.exhausted = false
  api.info('🌀 「乌默尔多斯」重整。')
}

// 献祭丽塔（原 actions-extra.js / moves.js 的 sacrificeLita 分支）。
export function scenarioActionError(state, inv, action) {
  if (action !== 'sacrificeLita') return undefined
  const boss = state.enemies.find(enemy => enemy.code === 'umordhoth')
  if (!boss) return '乌默尔多斯尚未降临'
  if (boss.location !== inv.location) return '乌默尔多斯不在你所在的地点'
  if (!inv.assets.some(asset => asset.code === '01117')) return '你没有控制丽塔·钱德勒'
  return null
}

export function sacrificeLitaAction(state, inv, api) {
  const asset = inv.assets.find(item => item.code === '01117')
  if (!asset) return false
  const owners = Object.values(state.campaign.investigators || {})
    .filter(record => record.deck?.includes(asset.code))
  if (owners.length !== 1) return false
  api.spendAction(inv.seat)
  api.removeAsset(inv.seat, asset.id)
  api.campaignCardChange(state.campaign, owners[0].seat, asset.code, 'remove', 'sacrificedLita')
  state.exiled.push(asset.code)
  api.info(`${inv.name} 将丽塔·钱德勒推向了乌默尔多斯，并从实际牌组中移除丽塔。`)
  api.finish('r3')
  return true
}

export function actReveal(state, act, api, revealType) {
  if (revealType === 'revealRitualSite') {
    api.place('ritualSite')
    for (const originalCode of state.campaign.records.cultistsEscaped || []) {
      const code = api.ruleCode(originalCode)
      const enemy = api.spawn(code, 'mainPath')
      if (enemy) api.info(`👹 逃跑的异教徒「${enemy.name}」出现在「主道路」！`)
    }
    return true
  }
  if (revealType === 'drawEnemyAtRitualSite') {
    if (state.encounterDiscard.length) {
      state.encounterDeck = api.shuffle([...state.encounterDeck, ...state.encounterDiscard])
      state.encounterDiscard = []
    }
    const times = state.numInvestigators >= 3 ? 2 : 1
    for (let index = 0; index < times; index++) {
      const code = api.discardAnyEnemy()
      if (!code) continue
      const enemy = api.spawn(code, 'ritualSite')
      if (enemy) api.info(`👹 「${enemy.name}」在「仪式地」生成！`)
    }
    return true
  }
  if (revealType === 'resolution2') {
    api.finish('r2')
    return true
  }
  return false
}

export function agendaReveal(state, ag, api, revealType) {
  if (revealType === 'drawMonsterAtMainPath') {
    if (state.encounterDiscard.length) {
      state.encounterDeck = api.shuffle([...state.encounterDeck, ...state.encounterDiscard])
      state.encounterDiscard = []
    }
    const code = api.discardUntilEnemyTrait('monster')
    if (code) {
      const enemy = api.spawn(code, 'mainPath')
      if (enemy) {
        api.doomOn(enemy, 1)
        api.info(`👹 「${enemy.name}」在「主道路」生成，并放置 1 点毁灭。`)
      }
    }
    return true
  }
  if (revealType === 'madnessTest') {
    const pool = api.basicWeaknesses('madness')
    if (!pool.length) throw new Error('疯狂弱点依赖缺失')
    for (const inv of state.investigators) {
      if (inv.defeated || inv.resigned) continue
      api.test(inv.seat, 'willpower', 6, result => {
        if (result.success) {
          api.info(`✔️ ${inv.name} 通过意志检定，未被疯狂侵蚀。`)
          return
        }
        const code = pool[Math.floor(api.random() * pool.length)]
        inv.hand.push(code)
        api.info(`❌ ${inv.name} 意志检定失败，获得疯狂弱点「${api.cardName(code)}」。`)
      }, 0, { label: '密谋结算', name: '疯狂侵蚀' })
    }
    return true
  }
  if (revealType === 'spawnUmordhoth') {
    if (state.locations.some(location => location.id === 'ritualSite')) {
      for (const enemy of state.enemies.filter(item => item.location === 'ritualSite').slice()) {
        const index = state.enemies.indexOf(enemy)
        if (index >= 0) state.enemies.splice(index, 1)
        if (enemy.engagedSeat != null) {
          const target = state.investigators[enemy.engagedSeat]
          if (target) target.engaged = (target.engaged || []).filter(id => id !== enemy.id)
        }
        if (api.isWeaknessCode(enemy.code)) state.investigators[enemy.bearerSeat].discard.push(enemy.code)
        else state.encounterDiscard.push(enemy.code)
        api.info(`♻️ 「${enemy.name}」因仪式地让位于乌默尔多斯而进入遭遇弃牌堆。`)
      }
    } else {
      api.place('ritualSite')
    }
    const boss = api.spawn('umordhoth', 'ritualSite')
    if (boss) api.info(`👹 古神「${boss.name}」降临于「仪式地」！`)
    const final = { ...ag, name: '地底噬魔', stage: '3b', face: 'back', doomThreshold: null, reveal: null,
      text: '目标 — 如果乌默尔多斯被击败，推进至结局 2。' }
    state.agendas = [final]
    state.agendaIndex = 0
    state.acts = [{ ...final, id: 'finalObjective', objective: { type: 'defeatEnemy', enemy: 'umordhoth' },
      reveal: { type: 'resolution2' } }]
    state.actIndex = 0
    api.autoEngageAll()
    return true
  }
  return false
}
