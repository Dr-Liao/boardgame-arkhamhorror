// 「集结」幕 1/2 的揭示效果（第 5 批从 src/engine/reveal.js 搬出）。
// 数据里的 reveal.type 保持不变，因此 state 指纹与旧存档都不受影响。
export function actReveal(state, act, api, revealType) {
  if (revealType === 'openHallway') {
    for (const id of ['hallway', 'cellar', 'attic', 'parlor']) api.place(id)
    for (const enemy of state.enemies.filter(item => item.location === 'study')) api.discardEnemy(enemy)
    for (const inv of state.investigators) {
      if (!inv.defeated && !inv.resigned) inv.location = 'hallway'
    }
    api.reveal('hallway')
    api.remove('study')
    api.info('🚪 书房的地板上出现一道暗门！所有人进入「走廊」，书房被移出游戏。')
    return true
  }
  if (revealType === 'revealParlor') {
    api.place('parlor')
    api.reveal('parlor')
    api.storyAsset('01117', 'parlor')
    const boss = api.spawn('ghoulPriest', 'hallway')
    if (boss) api.info(`👹 首领「${boss.name}」出现在「走廊」！`)
    return true
  }
  if (revealType === 'resolutionChoice') {
    const resolution = api.choose({
      kind: 'story', source: act.id, seat: api.decideSeat(), prompt: '决定房屋的命运。',
      options: [{ id: 'r1', label: '烧毁房屋' }, { id: 'r2', label: '保留房屋' }],
    })
    api.finish(resolution)
    return true
  }
  return false
}

// 「集结」密谋 1–3 的揭示效果（第 5 批从 src/engine/phases.js 的 runAgendaReveal 搬出）。
export function agendaReveal(state, ag, api, revealType) {
  if (revealType === 'agenda1Reveal') {
    const leadSeat = state.campaign?.leadSeat
    const lead = [leadSeat, ...state.investigators.map(inv => inv.seat)]
      .filter(Number.isInteger)
      .map(seat => state.investigators[seat])
      .find(inv => inv && !inv.defeated && !inv.resigned)
    if (!lead) return true
    const options = [{ id: 'discard', label: '每位调查员随机弃掉 1 张手牌' },
      { id: 'horror', label: '队长受到 2 点恐惧' }]
    const answer = api.choose({
      kind: 'agenda', source: ag.id, seat: api.decideSeat(),
      prompt: '到底发生了什么？！队长必须选择一项。', options,
    })
    if (answer === 'discard') {
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned || !inv.hand.length) continue
        api.info(`🎲 ${inv.name} 随机弃掉 1 张手牌。`)
        api.discardRandom(inv.seat, 1)
      }
    } else {
      api.info(`😱 ${lead.name} 作为队长受到 2 点恐惧（密谋 1 揭示）。`)
      api.horror(lead.seat, 2)
    }
    return true
  }
  if (revealType === 'agenda2Reveal') {
    if (state.encounterDiscard.length) {
      state.encounterDeck = api.shuffle([...state.encounterDeck, ...state.encounterDiscard])
      state.encounterDiscard = []
    }
    const lead = state.investigators[state.campaign?.leadSeat]
    const ghoul = api.discardUntilEnemyTrait('ghoul')
    if (ghoul && lead) {
      const enemy = api.spawnEngaged(ghoul, lead.location, lead.seat)
      if (enemy) api.info(`👹 密谋 2 揭示：「${enemy.name}」被引出，与 ${lead.name} 交战！`)
    } else {
      api.info('密谋 2 揭示：遭遇牌库中没有食尸鬼敌人。')
    }
    return true
  }
  if (revealType === 'agenda3Reveal') {
    if (state.actIndex <= 1) {
      api.info('☠️ 食尸鬼们破墙而出！调查队被团团包围，无处可逃……')
      api.defeatAll()
      api.finish('r3')
    } else {
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned) continue
        inv.defeated = true
        inv.defeatCause = 'damage'
        api.defeat(inv, 'damage')
      }
      api.info('🏃 你们在食尸鬼涌出前逃出了房子，但未撤退的调查员被击败。')
      api.finish('noResolution')
    }
    return true
  }
  return false
}

// 「集结」密谋的强制效果（第 5 批从 reveal.js 的 runAgendaForced 搬出）。
export function agendaForced(state, when, api, forcedType) {
  if (forcedType === 'ghoulsMoveToParlor') {
    for (const enemy of state.enemies) {
      if (enemy.engagedSeat != null) continue
      if (!(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'ghoul')) continue
      const dest = api.stepToward(enemy.location, 'parlor')
      if (dest && dest !== enemy.location) {
        const previous = enemy.location
        api.moveEnemy(enemy, dest)
        api.info(`「${enemy.name}」向客厅移动（${api.locName(previous)} → ${api.locName(dest)}）。`)
      }
    }
    api.autoEngageAll()
    return true
  }
  if (forcedType === 'doomPerGhoulAtParlorHallway') {
    const ghouls = state.enemies.filter(enemy => ['parlor', 'hallway'].includes(enemy.location)
      && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'ghoul')).length
    if (ghouls > 0) {
      api.info(`🌑 密谋 3 强制：走廊/客厅有 ${ghouls} 个食尸鬼，放置 ${ghouls} 点毁灭。`)
      api.addDoom(ghouls)
    }
    return true
  }
  return false
}
