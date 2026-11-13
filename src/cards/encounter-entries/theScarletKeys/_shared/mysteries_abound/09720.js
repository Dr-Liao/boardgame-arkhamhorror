// 09720 结社代表（Coterie Envoy） · 敌人 · mysteries_abound
// 归属：战役共用 · theScarletKeys/_shared/mysteriesAbound。
// 卡面：冷漠。巡逻（有隐匿迷你卡牌，而无结社代表的最近地点）。
//   结社代表处于重整状态时，其所在地点的隐匿迷你卡牌不能通过玩家卡牌效果揭露。(FAQ v2.3)
//   [reaction] 你击败结社代表后：查看场上任意一张隐匿迷你卡牌的已揭示面。
//   Aloof. Patrol (nearest location with a concealed mini-card and no Coterie Envoy).
//   While Coterie Envoy is ready, concealed mini-cards at its location cannot be exposed via player
//   card effects. [reaction] After you defeat Coterie Envoy: Look at the revealed side of any
//   concealed mini-card in play.
// 读点：
//   · 冷漠/数值由章节遭遇定义（content/campaigns/theScarletKeys/card-data.js#encounterDefinitions
//     解析印刷关键词）提供，条目只写行为；
//   · 巡逻：目标不是固定地点/trait，引擎 tsk-coterie 的 patrolTargetLocation 只支持 named/trait，
//     因此本条目的「动态巡逻目标」在敌人阶段开始窗口（turn.js#enemyPhase 的 enemyPhaseBegins）自行
//     计算「最近且有隐匿迷你卡、且该地点没有结社代表的」地点，再用 api.stepToward + api.moveEnemy 走一步；
//   · 隐匿迷你卡读数走 api.mechanics.tsk.concealed.miniCards()（只读投影，未揭露不泄露身份）；
//   · 击败后的「查看已揭示面」= api.privateInfo（私有信息，不向全桌投影）；
//   · 「重整时该地点的隐匿迷你卡不能被玩家卡牌效果揭露」需要揭露（Expose）读点，
//     引擎当前没有该读点，见 artifacts/migration/tsk/primitive-requests/09720.json。
import { entryDistance } from '../../../_shared.js'

const CODE = '09720'

// 只读：容器不存在时返回空数组（读点不初始化状态）。
const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

// 「有隐匿迷你卡、且没有结社代表」的地点（迷你卡可能位于阴影左/中/右位置，仍归属该地点）。
function patrolCandidates(state) {
  const withMini = new Set(miniCardsIn(state).map(card => card.locationId))
  return state.locations.filter(location => withMini.has(location.id)
    && !state.enemies.some(enemy => (enemy.originalCode || enemy.code) === CODE && enemy.location === location.id))
}

export default {
  code: CODE, scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseBegins', silent: true,
    label: '巡逻：向最近的有隐匿迷你卡牌且无结社代表的地点移动一步',
    criteria: ({ state, source }) => state.enemies.includes(source) && source.exhausted !== true,
    resolve: ({ state, source, api }) => {
      const candidates = patrolCandidates(state)
        .filter(location => location.id !== source.location)
        .map(location => ({ location, distance: entryDistance(state, source.location, location.id) }))
        .filter(item => Number.isFinite(item.distance))
      if (!candidates.length) return
      const nearest = Math.min(...candidates.map(item => item.distance))
      const targets = candidates.filter(item => item.distance === nearest).map(item => item.location)
      const target = targets.length === 1 ? targets[0].id : api.choose({
        kind: 'location', source: CODE, seat: api.scenario.decideSeat(),
        prompt: '结社代表巡逻：选择等距的巡逻目标地点。',
        options: targets.map(location => ({ id: location.id, label: location.name || location.id })),
      })
      const step = api.scenario.stepToward(source.location, target)
      if (!step || step === source.location) return
      api.moveEnemy(source, step)
      api.info?.(`🚶 「${source.name}」巡逻至「${api.locationName(step)}」。`)
    },
  }, {
    kind: 'reaction', trigger: 'defeatEnemy',
    label: '击败结社代表后：查看场上任意一张隐匿迷你卡牌的已揭示面',
    criteria: ({ state, source, context }) => context?.enemy?.id === source.id && miniCardsIn(state).length > 0,
    resolve: ({ inv, api }) => {
      const cards = api.mechanics.tsk.concealed.miniCards()
      if (!cards.length) return
      const chosen = cards.length === 1 ? cards[0] : cards.find(card => card.id === api.choose({
        kind: 'card', source: CODE, seat: inv.seat,
        prompt: '结社代表：查看一张隐匿迷你卡的已揭示面（不揭露）。',
        options: cards.map((card, index) => ({ id: card.id, label: `隐匿迷你卡 ${index + 1}（${card.locationId}）` })),
      }))
      if (!chosen) return
      api.privateInfo(inv.seat, `🔍 结社代表让你看清了一张隐匿迷你卡：${chosen.decoy ? '诱饵' : `真身 ${chosen.kind}`}。`)
    },
  }],
  note: 'approximation: 巡逻改用 enemyPhaseBegins 动态算点（引擎 patrol 原语只支持 named/trait 目标）。'
    + '缺读点：「重整时本地点的隐匿迷你卡不能被玩家卡牌效果揭露」需要揭露（Expose）读点；'
    + '「查看已揭示面」只写私有信息日志（tsk-concealed 的 known 标记没有写入口）。'
    + '请求见 primitive-requests/09720.json。',
}
