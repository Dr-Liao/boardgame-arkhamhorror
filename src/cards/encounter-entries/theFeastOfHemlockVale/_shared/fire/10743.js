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
//   · 「轮末：本地每张有生命值的卡牌受到 1 点直接伤害」：引擎对地点附属没有轮末窗口来源
//     （phases.js#upkeepPhase 的轮末只枚举 agenda.attachments / agendaAside，ability-rules.js 的窗口来源
//     不枚举 location.attachments），因此只落 flags.roundEndDirectDamage 数据，note 披露为未接线。
import { entryDistance, originalOf } from '../../../_shared.js'

const CODE = '10743'
const NAME = '“着火了！”'
const SKILL = 'agility'
const DIFFICULTY = 4

const hasFire = location =>
  (location.attachments || []).some(attachment => String(originalOf(attachment)) === CODE)

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
  note: '显现（附属到最近且没有同卡附属的地点，优先与已附属地点相连）与 [action] 敏捷(4) 摆脱自足实现'
    + '（附属行动走 treacheryRule.attachmentAbilities 这条既有的地点附属行动管线）。'
    + '「轮末本地每张有生命值的卡牌受到 1 点直接伤害」没有地点附属的轮末窗口来源，本批只落 flags 数据。',
}
