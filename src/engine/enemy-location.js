import { connectGrid, gridPosition, relocateGridCells } from './grid-map.js'
import { assertFields, integer, mechanicState } from './mechanic-state.js'
import { replacePrintedLocationFace } from './location-face.js'

const enemyStats = ['fight', 'evade', 'health', 'damage', 'horror']
const faceKeys = ['code', 'name', 'nameEn', 'shroud', 'traits']
const enemyKeys = [...enemyStats, 'victory', 'retaliate', 'alert', 'elite']

function validateEnemyFace(face) {
  assertFields(face, [...faceKeys, ...enemyKeys])
  for (const key of enemyStats) integer(face[key], key === 'health' ? 1 : 0)
  if (face.victory != null) integer(face.victory)
  for (const key of ['retaliate', 'alert', 'elite']) {
    if (face[key] != null && typeof face[key] !== 'boolean') throw new TypeError('无效敌人地点关键词')
  }
}

function printedFace(location) {
  return { code: location.originalCode || location.code || location.id, name: location.name, shroud: location.shroud,
    traits: [...(location.traits || [])], ...(location.nameEn != null ? { nameEn: location.nameEn } : {}) }
}

export function turnLocationIntoEnemy(state, id, face, { ready = false } = {}) {
  if (typeof ready !== 'boolean') throw new TypeError('无效敌人地点重整选项')
  const location = state.locations.find(item => item.id === id)
  if (!location?.revealed || location.enemyLocationFace || state.enemies.some(enemy => enemy.id === id)) return false
  if ((location.sealCount || 0) > 0) return false
  validateEnemyFace(face)
  const { fight, evade, health, damage, horror, victory, retaliate, alert, elite, ...locationFace } = face
  const previous = printedFace(location)
  if (!replacePrintedLocationFace(location, locationFace)) return false
  location.enemyLocationFace = previous
  const enemy = { id, code: face.code, originalCode: face.code, name: face.name, traits: [...face.traits], location: id,
    enemyLocation: true, fight, evade, health, damage, horror, victory: victory ?? 0, retaliate: retaliate === true,
    alert: alert === true, elite: elite === true, massive: true, immobile: true, engagedSeat: null,
    exhausted: !ready && (location.enemyLocationCondition?.exhausted ?? false), damageTaken: location.enemyLocationCondition?.damageTaken ?? 0 }
  if (location.enemyLocationCondition) delete location.enemyLocationCondition
  state.enemies.push(enemy)
  return enemy
}

export function restoreEnemyLocation(state, id, { ready = false } = {}) {
  if (typeof ready !== 'boolean') throw new TypeError('无效敌人地点重整选项')
  const location = state.locations.find(item => item.id === id)
  const index = state.enemies.findIndex(enemy => enemy.id === id && enemy.enemyLocation)
  if (!location?.enemyLocationFace || index < 0 || (location.sealCount || 0) > 0) return false
  const enemy = state.enemies[index]
  if (enemy.attachments?.length) (location.attachments ||= []).push(...enemy.attachments)
  location.enemyLocationCondition = { exhausted: !ready && enemy.exhausted, damageTaken: enemy.damageTaken }
  replacePrintedLocationFace(location, location.enemyLocationFace)
  delete location.enemyLocationFace
  state.enemies.splice(index, 1)
  return location
}

export function changeLocationSeals(state, id, delta) {
  if (!Number.isSafeInteger(delta)) throw new TypeError('无效地点封印数量')
  const location = state.locations.find(item => item.id === id)
  if (!location || (location.sealCount || 0) + delta < 0) return false
  return location.sealCount = (location.sealCount || 0) + delta
}

function collapsePlan(state, id, choose) {
  const origin = gridPosition(state, id)
  const location = state.locations.find(item => item.id === id)
  const cells = Object.entries(mechanicState(state)?.grid || {}).filter(([other, cell]) => other !== id && !cell.isolated)
  const above = origin && !origin.isolated ? cells.filter(([, cell]) => cell.x === origin.x && cell.y > origin.y)
    .sort(([, a], [, b]) => a.y - b.y) : []
  const adjacent = origin && !origin.isolated
    ? cells.filter(([, cell]) => Math.abs(cell.x - origin.x) + Math.abs(cell.y - origin.y) === 1).map(([other]) => other)
    : (location.connections || []).filter(other => state.locations.some(item => item.id === other))
  const investigators = state.investigators.filter(inv => inv.location === id && !inv.defeated && !inv.resigned)
  const enemies = state.enemies.filter(enemy => enemy.location === id && enemy.id !== id)
  const assets = (state.storyAssets || []).filter(card => card.location === id)
  const occupants = investigators.length + enemies.length + assets.length
  let destination = above[0]?.[0] || adjacent[0]
  if (!above.length && occupants && adjacent.length > 1) {
    destination = choose(adjacent)
    if (!adjacent.includes(destination)) throw new RangeError('无效坍塌安置地点')
  }
  const moved = above.map(([other, cell]) => ({ id: other, x: cell.x, y: cell.y - 1 }))
  const shift = origin?.x === 0 && !origin.isolated && !cells.some(([, cell]) => cell.x === 0)
  if (shift) moved.push(...cells.filter(([, cell]) => cell.x === -1).map(([other, cell]) => ({ id: other, x: 0, y: cell.y })))
  return { destination, investigators, enemies, assets, moved }
}

export function removeEnemyLocation(state, id, { choose, remove, discardEnemy, noDestination }) {
  const location = state.locations.find(item => item.id === id)
  if (!location?.enemyLocationFace) return false
  const plan = collapsePlan(state, id, choose)
  // Collapse places every occupant together. Movement restrictions and move windows do not apply.
  if (plan.destination) {
    const occupants = [...plan.investigators, ...plan.enemies, ...plan.assets]
    for (const item of occupants) item.location = plan.destination
  } else {
    for (const inv of plan.investigators) noDestination(inv)
    for (const enemy of plan.enemies) discardEnemy(enemy)
    if (plan.assets.length) state.storyAssets = state.storyAssets.filter(item => !plan.assets.includes(item))
  }
  for (const loc of state.locations) loc.connections = loc.connections?.filter(other => other !== id) || []
  for (const item of (state.playerLocationAttachments || []).filter(card => card.location === id)) {
    state.investigators[item.ownerSeat]?.discard.push(item.code)
    state.playerLocationAttachments.splice(state.playerLocationAttachments.indexOf(item), 1)
  }
  remove(id)
  if (plan.moved.length) relocateGridCells(state, plan.moved)
  else connectGrid(state)
  return true
}

export function validateEnemyLocations(state) {
  for (const location of state.locations || []) {
    if (location.sealCount != null) integer(location.sealCount)
    if (location.enemyLocationCondition) {
      const condition = assertFields(location.enemyLocationCondition, ['exhausted', 'damageTaken'])
      integer(condition.damageTaken)
      if (typeof condition.exhausted !== 'boolean' || location.enemyLocationFace) throw new TypeError('无效休眠敌人地点')
    }
    if (!location.enemyLocationFace) continue
    const face = assertFields(location.enemyLocationFace, faceKeys)
    integer(face.shroud)
    if (!face.code || !face.name || !Array.isArray(face.traits)) throw new TypeError('无效敌人地点备用面')
    const matches = state.enemies.filter(enemy => enemy.id === location.id)
    if (matches.length !== 1 || !matches[0].enemyLocation) throw new TypeError('敌人地点的身份不唯一')
  }
  for (const enemy of (state.enemies || []).filter(item => item.enemyLocation)) {
    if (!enemy.immobile || !enemy.massive || enemy.engagedSeat != null || enemy.location !== enemy.id
      || !state.locations.some(location => location.id === enemy.id && location.enemyLocationFace && location.code === enemy.code)) {
      throw new TypeError('敌人地点缺少对应地点')
    }
    for (const field of [...enemyStats, 'damageTaken']) integer(enemy[field], field === 'health' ? 1 : 0)
  }
}
