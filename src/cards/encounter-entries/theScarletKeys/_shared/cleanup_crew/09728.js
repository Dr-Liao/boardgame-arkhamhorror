// 09728 溜之大吉（Swift Retreat） · 诡计 · cleanup_crew
// 归属：战役共用 · theScarletKeys/_shared/cleanupCrew。
// 卡面：显现 - 如果场上没有 [[结社]] 敌人，溜之大吉获得涌动。否则，找到最近的 [[结社]] 敌人并检定
//   [agility](3)。如果你检定失败，该敌人攻击你。如果你检定失败且该敌人不在阴影中，结算其隐匿关键词（如可能）。
//   Revelation - If there are no [[Coterie]] enemies in play, Swift Retreat gains surge. Otherwise,
//   find the nearest [[Coterie]] enemy and test [agility] (3). If you fail, that enemy attacks you.
//   If you fail and that enemy is not in the shadows, resolve its concealed keyword (if able).
// 读点：
//   · 特性判定 = _shared.js 的 hasTrait（大小写无关；印刷特性 [[结社]] = Coterie）；
//   · 「最近的敌人」= _shared.js 的 entryDistance（与引擎 locationDistance 同口径的最短路步数）；
//   · 「获得涌动」= 返回 { gainSurge: true }；
//   · 检定 = api.test；攻击 = api.attack；
//   · 「结算其隐匿关键词」需要「生成/分配迷你卡」的共享入口（spawn→shadows、X×人数诱饵分配），
//     引擎只提供 tsk-concealed 的底层 place/distribute 原语，没有关键词解析器，见 primitive-requests/09728.json。
import { hasTrait, entryDistance } from '../../../_shared.js'

const CODE = '09728'
const DIFFICULTY = 3

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
// 迷你卡 kind 只允许字母开头（tsk-concealed 的 KIND_PATTERN），敌人真身统一记作 enemy<卡号>。
const miniKindOf = code => `enemy${code}`
const inShadows = (state, code) => miniCardsIn(state).some(card => !card.decoy && (card.code != null ? card.code === code : card.kind === miniKindOf(code)))

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const coterie = state.enemies.filter(enemy => hasTrait(enemy, 'Coterie'))
    if (!coterie.length) {
      api.info?.('「溜之大吉」：场上没有[[结社]]敌人，获得涌动。')
      return { gainSurge: true }
    }
    const scored = coterie.map(enemy => ({ enemy, distance: entryDistance(state, inv.location, enemy.location) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) {
      api.info?.('「溜之大吉」：没有可到达的[[结社]]敌人，获得涌动。')
      return { gainSurge: true }
    }
    const nearest = Math.min(...scored.map(item => item.distance))
    const candidates = scored.filter(item => item.distance === nearest).map(item => item.enemy)
    const target = candidates.length === 1 ? candidates[0] : candidates.find(enemy => enemy.id === api.choose({
      kind: 'enemy', source: CODE, seat: inv.seat,
      prompt: '溜之大吉：选择最近的[[结社]]敌人（距离相同）。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
    })) || candidates[0]
    api.test(inv.seat, 'agility', DIFFICULTY, result => {
      if (result.success) {
        api.info?.(`💨 ${inv.name} 甩开了「${target.name}」。`)
        return
      }
      api.attack(target, inv)
      const code = target.originalCode || target.code
      if (inShadows(state, code)) return
      api.info?.(`💨 「${target.name}」不在阴影中，应结算它的隐匿关键词（当前没有共享解析入口）。`)
    })
    return false
  },
  note: 'approximation: 「失败且该敌人不在阴影中 → 结算其隐匿关键词」没有共享解析器（引擎只有 tsk-concealed 的'
    + 'place/distribute 底层原语，spawn→shadows 与「X×人数诱饵分配」属章节/共享层入口），'
    + '条目只在日志中披露该分支；请求见 primitive-requests/09728.json。',
}
