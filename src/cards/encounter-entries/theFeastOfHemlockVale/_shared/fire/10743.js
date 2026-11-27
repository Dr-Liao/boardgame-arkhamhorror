// 10743 “着火了！”（Fire!）· 诡计 · 共享遭遇组 fire（印刷 5 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/fire（theLongestNight / hemlockHouse / fateOfTheVale
//   都把本组放进放一边区或遭遇牌库）。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Attach Fire! to the nearest location with no copy of Fire! attached (connected to a
//   location with Fire! attached, if able).
//   [action]: Test [agility] (4). If you succeed, discard Fire!
//   Forced - At the end of the round: Each card with health at this location takes 1 direct damage.
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 诡计的 entryRevelation 条目通道，
//     src/engine/treachery-tokens.js#resolveTreacheryBody）。
//   · 「最近且没有附属“着火了！”的地点（如可能，与已附属的地点连接）」= _shared.js#entryDistance 的
//     连接图 BFS；先筛「与已附属地点相连」的候选，没有才退回全部合法地点；同距由领队选择（api.choice）。
//   · 附属 = api.attachToLocation（src/engine/location-attachments.js#attachLocationCard 唯一写入口）。
//   · [action] 检定敏捷(4) 成功弃掉本卡 = treacheryRule.attachmentAbilities（读点：parley.js#
//     parleyMovesFor 的 locationAttachment 枚举 → ability-exec.js#doEntityAbility → executeDescriptor；
//     与 07299 石障同一写法）。弃卡 = api.scenario.detachEncounterAttachmentById（按 id 摘除，跨克隆稳定）。
//   · 轮末强制能力同时结算附属地点里有生命值的调查员、支援与敌人。
import { ALL_CARDS, entryDistance, originalOf } from '../../../_shared.js'

const CODE = '10743'
const NAME = '“着火了！”'
const SKILL = 'agility'
const DIFFICULTY = 4

const hasFire = location =>
  (location.attachments || []).some(attachment => String(originalOf(attachment)) === CODE)

const hasHealth = card => Number.isFinite(card.health ?? ALL_CARDS[originalOf(card)]?.health)

function burnLocation({ state, source, api }) {
  const location = state.locations.find(place => place.attachments?.some(card => card.id === source.id))
  if (!location) return
  const investigators = state.investigators.filter(inv => !inv.defeated && !inv.resigned && inv.location === location.id)
  const assets = investigators.flatMap(inv => inv.assets.filter(hasHealth).map(asset => ({ seat: inv.seat, id: asset.id })))
  const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === location.id
    && api.enemyHealth(enemy) != null)
  const uncontrolled = (state.storyAssets || []).filter(asset => asset.location === location.id && hasHealth(asset))
  const origin = { type: 'encounter', code: CODE }
  for (const { seat, id } of assets) api.scenario.damageAsset(seat, id, 1, { direct: true })
  for (const enemy of enemies) api.damageEnemy(enemy, 1, null, origin)
  for (const asset of uncontrolled) api.scenario.damageUncontrolledStoryAsset(asset.id, 1)
  for (const inv of investigators) api.directDamage(inv.seat, 1)
}

// 「没有附属“着火了！”的地点」；优先与某个已附属地点相连的候选（印刷的 if able）。
function nearestEligibleLocations(state, fromId) {
  const all = (state.locations || []).filter(location => !hasFire(location))
  const firesWithLocation = (state.locations || []).filter(location => hasFire(location))
  const connectedToFire = new Set()
  for (const location of firesWithLocation) {
    for (const next of location.connections || []) connectedToFire.add(next)
  }
  const preferred = all.filter(location => connectedToFire.has(location.id))
  const pool = preferred.length ? preferred : all
  const scored = pool
    .map(location => ({ location, distance: entryDistance(state, fromId, location.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.location)
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    encounterGroup: 'fire',
    quantity: 5,
    traits: ['Hazard'],
    attachToNearestWithoutCopy: true,
    preferConnectedToCopy: true,
    roundEndDirectDamage: { amount: 1, target: 'cardsWithHealthAtLocation' },
    escapeTest: { skill: SKILL, difficulty: DIFFICULTY },
  },
  encounterResolve(state, inv, card, api) {
    void card
    const candidates = nearestEligibleLocations(state, inv.location)
    if (!candidates.length) {
      api.info?.(`「${NAME}」：没有可附属的地点，弃掉。`)
      return false
    }
    const chosen = candidates.length === 1 ? candidates[0] : candidates.find(location => location.id === api.choice({
      kind: 'location', source: CODE, seat: inv.seat,
      prompt: `「${NAME}」：选择最近且没有附属“着火了！”的地点。`,
      options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
    })) || candidates[0]
    api.attachToLocation(chosen.id, {
      code: CODE, originalCode: CODE, id: `${CODE}:${chosen.id}`,
    })
    api.info?.(`🔥 「${NAME}」附属到「${chosen.name || chosen.id}」。`)
    return { placed: true }
  },
  treacheryRule: {
    attachmentAbilities: [{
      kind: 'action',
      actionKind: 'activate',
      label: '检定敏捷(4)：成功弃掉“着火了！”',
      resolve: ({ inv, source, api }) => {
        api.test(inv.seat, SKILL, DIFFICULTY, {
          source: { type: 'treachery', code: CODE, name: source?.name, ability: true },
          resolve: result => {
            if (!result?.success) {
              api.info?.(`❌ ${inv.name} 没能扑灭「${NAME}」。`)
              return
            }
            api.scenario.detachEncounterAttachmentById(source?.id)
            api.info?.(`🧯 ${inv.name} 扑灭「${NAME}」并弃掉它。`)
          },
        })
      },
    }],
  },
  abilities: [{
    kind: 'forced',
    trigger: 'roundEnds',
    silent: true,
    label: '轮末：附属地点每张有生命值的卡牌受到 1 点直接伤害',
    resolve: burnLocation,
  }],
}
