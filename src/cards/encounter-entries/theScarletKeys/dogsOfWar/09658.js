// 09658 节点脉冲（Locus Pulse）· 诡计 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。印刷 2 份，[[巫术]] 特性，进遭遇牌库。
// 卡面（中）：显现 - 将节点脉冲附属到有钥匙节点的最近地点。该地点的每位调查员受到 1 点伤害和 1 点恐惧。
//   强制 - 如果附属的地点没有钥匙节点：弃掉节点脉冲。
//
// 读点：
//   · 附属到地点 = api.attachEncounterToLocation（location.attachments 的唯一写入口）；
//   · 「有钥匙节点的最近地点」= 本文件按钥匙节点实体/地点标记 + api.locationDistance 选择
//     （与 behavior/chaos 的 keyLocusLocations 同一口径）；
//   · 「每位调查员受到 1 点伤害和 1 点恐惧」= api.harm；
//   · 「附属地点没有钥匙节点时弃掉」= 章节 behavior 在钥匙节点被击败 / 轮末 / 阶段开始时检查并
//     api.detachLocationAttachment（引擎没有「地点附属的强制检查」窗口，见 09658.json）。
const CODE = '09658'
const KEY_LOCUS_CODES = Object.freeze(['09653a', '09653b'])
const LOCUS_SITE_TRAIT = 'Locus Site'

const codeOf = card => card?.originalCode || card?.code || card
const hasTrait = (card, trait) =>
  (card?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())

/** 场上所有「有钥匙节点」的地点（敌人/剧情支援实体 + 地点自己的标记）。 */
function keyLocusLocationIds(state) {
  const ids = []
  for (const enemy of state?.enemies || []) {
    if (enemy.defeated || enemy.removedFromGame) continue
    if (enemy.keyLocus === true || KEY_LOCUS_CODES.includes(String(codeOf(enemy)))) {
      if (enemy.location) ids.push(enemy.location)
    }
  }
  for (const asset of state?.storyAssets || []) {
    if (asset.keyLocus === true && asset.location) ids.push(asset.location)
  }
  for (const location of state?.locations || []) {
    if (location.keyLocus === true) ids.push(location.id)
  }
  return [...new Set(ids)]
}

function nearest(state, api, fromId, candidates) {
  if (!candidates.length) return null
  if (candidates.includes(fromId)) return fromId
  const distance = id => {
    const value = api?.locationDistance?.(fromId, [id])
    return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY
  }
  return [...candidates].sort((left, right) => distance(left) - distance(right)
    || String(left).localeCompare(String(right)))[0] || null
}

export default {
  code: CODE,
  name: '节点脉冲',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const origin = inv?.location || null
    const loci = keyLocusLocationIds(state)
    const sites = (state.locations || []).filter(location => hasTrait(location, LOCUS_SITE_TRAIT)).map(location => location.id)
    const target = nearest(state, api, origin, loci) || nearest(state, api, origin, sites) || origin
    if (!target) {
      api?.info?.('🌀 节点脉冲：场上没有可附属的地点。')
      return { placed: false }
    }
    const attachment = api?.attachEncounterToLocation?.(CODE, target, { originalCode: CODE })
    api?.info?.(`🌀 节点脉冲附属到「${api?.locationName?.(target) || target}」（有钥匙节点的最近地点）。`)
    const victims = (state.investigators || []).filter(other => other && !other.defeated && !other.resigned
      && other.location === target)
    for (const other of victims) {
      if (typeof api?.harm === 'function') api.harm(other.seat, { damage: 1, horror: 1 })
      else api?.damage?.(other.seat, 1)
    }
    api?.info?.(`🌀 「${api?.locationName?.(target) || target}」的 ${victims.length} 位调查员各受到 1 点伤害和 1 点恐惧。`)
    void card
    void attachment
    return { placed: true }
  },
  note: 'approximation: 附属用真实的地点附属（api.attachEncounterToLocation）；「附属地点没有钥匙节点时弃掉」'
    + '由章节 behavior 在钥匙节点被击败 / 轮末 / 阶段开始时检查并 detach（引擎没有地点附属的强制窗口）。'
    + '见 primitive-requests/09658.json。',
}
