// P7 TDC 11688 黏土恐怖 / 星之眷族被动修饰的读点。
// 内容声明（story asset 条目）：
//   storyAssetRule: { enemyOverride: { trait: 'Star Spawn', lose: ['patrol', 'prey'], gain: ['hunter'], prey: 'controller' } }
// 语义：当该受控剧情资产在场时，匹配特性的敌人按声明改写关键词/猎物：
//   · gain → turn.js#enemyHasHunter 等关键词判定；
//   · lose → turn.js 的巡逻结算跳过、prey 覆盖使印刷猎物失效；
//   · prey:'controller' → card-ops.js#preyTarget 返回控制者的座位。
import { ALL_CARDS } from '../cards/cards-data.js'
import { registeredEntry } from './ability.js'

const lower = value => String(value || '').toLowerCase()

function traitsOf(enemy) {
  const def = ALL_CARDS[enemy?.originalCode || enemy?.code]
  return (enemy?.traits || def?.traits || []).map(lower)
}

function inPlayStoryAssets(state) {
  const rows = []
  for (const inv of state.investigators || []) {
    for (const asset of inv.assets || []) rows.push({ asset, controllerSeat: inv.seat })
  }
  for (const asset of state.storyAssets || []) {
    rows.push({ asset, controllerSeat: Number.isInteger(asset.holderSeat) ? asset.holderSeat
      : (Number.isInteger(asset.ownerSeat) ? asset.ownerSeat : null) })
  }
  return rows
}

export function storyAssetEnemyOverride(state, enemy) {
  if (!enemy) return null
  const traits = traitsOf(enemy)
  for (const row of inPlayStoryAssets(state)) {
    const rule = registeredEntry(row.asset?.code || row.asset?.originalCode)?.storyAssetRule?.enemyOverride
    if (!rule) continue
    if (!traits.includes(lower(rule.trait))) continue
    return { rule, asset: row.asset, controllerSeat: row.controllerSeat }
  }
  return null
}

export function storyAssetEnemyGainsKeyword(state, enemy, keyword) {
  const override = storyAssetEnemyOverride(state, enemy)
  return Boolean(override?.rule?.gain?.some(item => lower(item) === lower(keyword)))
}

export function storyAssetEnemyLosesKeyword(state, enemy, keyword) {
  const override = storyAssetEnemyOverride(state, enemy)
  return Boolean(override?.rule?.lose?.some(item => lower(item) === lower(keyword)))
}

// P7 TDC 11638 伊克雷希特碎片：「每轮你可以忽略第一次由[[星之眷族]]/[[深潜者]]敌人对你发起的攻击」。
// 返回可用的声明行（每张受控剧情资产每轮只提供一次），由 enemies.js#enemyAttack 询问玩家后消费。
export function ignoredEnemyAttackOffer(state, enemy, inv) {
  const traits = traitsOf(enemy)
  for (const row of inPlayStoryAssets(state)) {
    const rule = registeredEntry(row.asset?.code || row.asset?.originalCode)?.storyAssetRule?.ignoreFirstAttack
    if (!rule) continue
    if (Array.isArray(rule.traits) && rule.traits.length
      && !rule.traits.some(trait => traits.includes(lower(trait)))) continue
    if (Number.isInteger(row.controllerSeat) && inv && row.controllerSeat !== inv.seat) continue
    if (row.asset.ignoredAttackRound === state.round) continue
    return { asset: row.asset, rule, controllerSeat: row.controllerSeat }
  }
  return null
}

export function markIgnoredEnemyAttack(offer, state) {
  if (offer?.asset) offer.asset.ignoredAttackRound = state.round
}

// P7 TDC 11568 玛莉亚·里维拉：「当[[异教徒]]敌人所在位置将放置伤害时，改为放在玛莉亚身上」。
// 返回可承接伤害的受控剧情资产（控制器必须在敌人所在地点），由 enemies.js#damageEnemy 改道。
export function storyAssetEnemyDamageRedirect(state, enemy) {
  const traits = traitsOf(enemy)
  for (const row of inPlayStoryAssets(state)) {
    const rule = registeredEntry(row.asset?.code || row.asset?.originalCode)?.storyAssetRule?.redirectEnemyDamage
    if (!rule) continue
    if (Array.isArray(rule.traits) && rule.traits.length
      && !rule.traits.some(trait => traits.includes(lower(trait)))) continue
    const controller = Number.isInteger(row.controllerSeat)
      ? state.investigators?.[row.controllerSeat] : null
    if (!controller || controller.defeated || controller.resigned) continue
    if (enemy?.location != null && controller.location !== enemy.location) continue
    return { asset: row.asset, controllerSeat: row.controllerSeat, rule }
  }
  return null
}

export { traitsOf as storyAssetEnemyTraits }
