import { registeredEntry } from '../../../../../src/engine/ability.js'

const codeOf = card => card.originalCode || card.code

export function ruinedLocationEnemyEntry(state, enemy, api) {
  const location = state.locations.find(item => item.id === enemy.location)
  const rule = location?.revealed && registeredEntry(codeOf(location))?.flags?.enemyEntryReaction
  if (!rule || !api.choose) return
  const matches = rule.enemyCode ? codeOf(enemy) === rule.enemyCode
    : enemy.traits?.some(trait => trait.replace(/\s/g, '') === rule.trait.replace(/\s/g, ''))
  if (!matches) return
  for (const inv of state.investigators) {
    if (inv.defeated || inv.resigned || inv.location !== location.id || !state.enemies.includes(enemy)) continue
    const ask = (prompt, options) => api.choose({ kind: 'choice', seat: inv.seat, source: location.id, prompt,
      options: [{ id: 'skip', label: '跳过' }, ...options], canSkip: true })
    if (rule.effect === 'autoEvade' && inv.resources >= rule.resourceCost && (!enemy.exhausted || enemy.engagedSeat != null)) {
      if (ask('支付资源自动躲避进入市中心的星之眷族？', [{ id: 'evade', label: `支付 ${rule.resourceCost} 资源` }]) !== 'evade') continue
      api.spendResources(inv.seat, rule.resourceCost)
      api.evadeEnemy(enemy, { seat: inv.seat })
    }
    if (rule.effect !== 'damagePerClue') continue
    const flags = state.scenarioFlags ||= {}
    const limit = `ruinedEntry:${location.id}`
    const source = { code: codeOf(location) }
    const targets = () => state.enemies.filter(item => item.location === location.id && api.canDamageEnemy(item, inv.seat, source))
    const max = Math.min(inv.clues || 0, rule.maxClues)
    const oncePerGame = rule.groupLimit === 'perGame'
    if ((oncePerGame && flags[limit]) || max < 1) continue
    const count = Number(ask('选择放在圣玛丽医院的个人线索数量', Array.from({ length: max }, (_, index) => ({
      id: String(index + 1), label: `放置 ${index + 1} 个线索`,
    }))))
    if (!count) continue
    const moved = api.loseClues(inv.seat, count)
    if (!moved) continue
    if (oncePerGame) flags[limit] = true
    api.addCluesToLocation(location.id, moved)
    for (let index = 0; index < moved; index++) {
      const options = targets().map(item => ({ id: item.id, label: item.name }))
      if (!options.length) break
      const target = options.length === 1 ? options[0].id : api.choose({ kind: 'enemy', seat: inv.seat,
        source: location.id, prompt: '选择承受 1 点伤害的敌人', options })
      api.damageEnemy(target, 1, inv.seat, source)
    }
  }
}
