const trials = {
  boardingHouse: { checks: [['willpower', 3], ['agility', 2], ['combat', 1]], reward: 'draw', record: 'theInvestigatorsFoundGas' },
  theCommons: { checks: [['intellect', 3], ['combat', 2], ['agility', 1]], reward: 'resources', record: 'theInvestigatorsFoundTheosTruck' },
  theOldMill: { checks: [['agility', 8]], reward: 'healDamage', record: 'theSamplesWereFound' },
  theAtwoodHouse: { checks: [['willpower', 8]], reward: 'healHorror', record: 'theSurveyNotesWereRecovered' },
}
const rewards = {
  draw: (api, seat) => api.drawCards(seat, 3),
  resources: (api, seat) => api.gainResources(seat, 5),
  healDamage: (api, seat) => api.healDamage(seat, 2),
  healHorror: (api, seat) => api.healHorror(seat, 2),
}
const skillNames = { willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷' }
const clueAlternative = new Set(['healDamage', 'healHorror'])

export function escapeLocationAction(state, inv) {
  const trial = trials[inv.location]
  if (!trial) return null
  const location = state.locations.find(item => item.id === inv.location)
  return location?.revealed ? {
    action: 'scenarioAction', rule: 'fateEscapeLocation', actions: 1,
    label: trial.checks.map(([skill, difficulty]) => `${skillNames[skill]} (${difficulty})`).join(' → '),
  } : null
}

export function performEscapeLocationAction(state, inv, api) {
  const trial = trials[inv.location]
  if (!escapeLocationAction(state, inv) || !api.test) return false
  const seat = inv.seat
  const clueCost = 2 * state.numInvestigators
  const complete = () => {
    rewards[trial.reward](api, seat)
    state.campaign.records[trial.record] = true
    api.info?.(`战役记录：${trial.record}。`)
  }
  const tryTest = index => {
    const [skill, difficulty] = trial.checks[index]
    api.test(seat, skill, difficulty, result => {
      if (!result.success) {
        if (!clueAlternative.has(trial.reward) || inv.clues < clueCost) return
        const answer = api.choose({ kind: 'choice', seat, source: inv.location,
          prompt: `花费 ${clueCost} 个线索改为检定成功？`,
          options: [{ id: 'pay', label: '支付线索' }, { id: 'skip', label: '保留线索' }],
        })
        if (answer !== 'pay') return
        api.spendClues(seat, clueCost)
      }
      if (index + 1 < trial.checks.length) tryTest(index + 1)
      else complete()
    })
  }
  tryTest(0)
  return true
}

export function clearEscapeRoad(state, inv, enemy, result, api) {
  if (inv.location !== 'theCrossroads' || !enemy.traits?.includes('Shattered') || !result?.success
    || (result.successBy ?? (result.value - result.difficulty)) < 3 || state.campaign.records.theRoadIsClear) return false
  const answer = api.choose({ kind: 'choice', seat: inv.seat, source: 'theCrossroads',
    prompt: '要将「道路畅通」记入战役记录吗？',
    options: [{ id: 'record', label: '记录道路畅通' }, { id: 'skip', label: '跳过' }],
  })
  if (answer !== 'record') return false
  state.campaign.records.theRoadIsClear = true
  return true
}
