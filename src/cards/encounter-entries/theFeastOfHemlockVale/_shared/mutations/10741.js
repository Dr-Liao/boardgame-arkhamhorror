// 10741 骤然突变（Sudden Mutation）· 诡计 · 共享遭遇组 mutations（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/mutations（theThingInTheDepths / theLostSister 的
//   遭遇牌库把本组洗入）。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Attach to the nearest non-[[Elite]] enemy. If you cannot, search the encounter deck
//   and discard pile for a [[Mutated]] enemy and draw it.
//   Forced - When attached enemy is defeated: Discard cards from the top of the encounter deck until
//   an enemy is discarded and spawn it at this location.
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 诡计的 entryRevelation 条目通道，
//     src/engine/treachery-tokens.js#resolveTreacheryBody）。
//   · 「最近的非法术/非精英敌人」= _shared.js#entryDistance 的连接图 BFS；精英判定读 cards-data 特性；
//     同距由领队选择（api.choice）。
//   · 附属到敌人 = api.attachEncounterToEnemy（scenario-runtime.js；走 attachCardTo 的唯一写入口，
//     落在 enemy.attachments）。
//   · 「查找遭遇牌库和弃牌堆里的[[突变]]敌人并抽取」= api.drawEncounterByTrait('Mutated', seat)
//     （scenario-runtime.js：两堆都查、置于遭遇牌库顶后走统一抽牌管线）。
//   · 「附属敌人被击败后弃牌直到弃掉敌人并在本地点生成」= api.discardEncounterUntilSpawn
//     （scenario-runtime.js）——但该效果的触发时点（附属敌人被击败）在引擎里没有可读的附属窗口来源
//     （ability-rules.js#nonPlayerAbilitySources 只枚举在场敌人自身，被击败敌人的附属不在窗口来源里），
//     所以这次只落 flags 数据，note 披露为未接线。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '10741'
const NAME = '骤然突变'
const TRAIT = 'Mutated'

const isElite = enemy => enemy?.elite === true
  || (ALL_CARDS[enemy?.originalCode || enemy?.code]?.traits || []).some(trait => /^elite$/i.test(trait))

function nearestNonEliteEnemies(state, fromId) {
  const scored = (state.enemies || [])
    .filter(enemy => enemy && !enemy.defeated && !enemy.removedFromGame && enemy.location && !isElite(enemy))
    .map(enemy => ({ enemy, distance: entryDistance(state, fromId, enemy.location) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.enemy)
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    encounterGroup: 'mutations',
    quantity: 2,
    traits: ['Power', 'Colour'],
    attachToNearestNonEliteEnemy: true,
    fallbackDrawTraitEnemy: TRAIT,
    onAttachedDefeated: { discardUntilTrait: 'enemy', spawnHere: true, trait: TRAIT },
  },
  encounterResolve(state, inv, card, api) {
    void card
    if (!inv) return false
    const candidates = nearestNonEliteEnemies(state, inv.location)
    if (candidates.length) {
      const target = candidates.length === 1 ? candidates[0] : candidates.find(enemy => enemy.id === api.choice({
        kind: 'target', source: CODE, seat: inv.seat,
        prompt: `「${NAME}」：选择最近的非[[精英]]敌人（距离相同）。`,
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
      })) || candidates[0]
      api.attachEncounterToEnemy(CODE, target.id)
      api.info?.(`🧬 「${NAME}」附属到「${target.name}」。`)
      return false
    }
    const drawn = api.drawEncounterByTrait(TRAIT, inv.seat, { source: CODE })
    api.info?.(drawn
      ? `🧬 「${NAME}」：没有可附属的敌人，改为查找并抽取[[突变]]敌人（${drawn}）。`
      : `🧬 「${NAME}」：没有可附属的敌人，遭遇牌库里也没有[[突变]]敌人。`)
    return false
  },
  note: '显现自足实现（最近的非[[精英]]敌人 → 附属；否则按[[突变]]特性从遭遇牌库/弃牌堆查找并抽取）。'
    + '「附属敌人被击败时弃牌直到弃掉敌人并在此生成」的原语已存在（api.discardEncounterUntilSpawn），'
    + '但被击败敌人的附属不是能力窗口来源，触发时点无读点，本批只落 flags.onAttachedDefeated 数据。',
}
