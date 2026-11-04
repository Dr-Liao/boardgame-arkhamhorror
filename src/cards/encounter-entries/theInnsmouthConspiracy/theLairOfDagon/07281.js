// 07281 第二誓约（The Second Oath）· 幕 2 · 达贡密教巢穴 第七章
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人得到+1[per_investigator]生命值，失去冷漠，并且不能与之谈判。
//   [fast] 花费蓝色、红色、白色或黄色钥匙：弃掉每张附属到你所在地点的[[屏障]]卡牌。
//   目标 - 如果有调查员“解锁了最终深渊”，推进。
//
// 印刷（English）：
//   Each [[Suspect]] enemy gets +1 [per_investigator] health, loses aloof, and cannot be
//   parleyed with.
//   [fast] Spend the blue, red, white, or yellow key: Discard each [[Obstacle]] card attached
//   to your location.
//   Objective - If an investigator has "unlocked the final depths," advance.
//
// 印刷（中文·背面）：
//   将放在一边的达贡巢穴地点放置入场，完全淹没。
//   将放在一边的达贡敌人放置入场，放在达贡巢穴，（深入沉睡）面朝上。
//   检查当前密谋。
//   - 如果是密谋1a，在混乱袋中加入10个[curse]标记。
//   - 如果是密谋2a，在混乱袋中加入5个[curse]标记。
//
// 印刷（English·背面）：
//   Put the set-aside Lair of Dagon location into play, fully flooded.
//   Put the set-aside Dagon enemy into play at the Lair of Dagon, (Deep in Slumber) side up.
//   Check the current agenda:
//   - If it is agenda 1a, add 10 [curse] tokens to the chaos bag.
//   - If it is agenda 2a, add 5 [curse] tokens to the chaos bag.
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07281.js
//
// 引擎读点：
//   · 正面实体规则 / [fast] 清屏障：与 07280 同一句印刷模板，逐条读点见 07280.js
//     （modifiers scene 行 + parleyMovesFor/doEntityAbility + additionalKeyCost）。
//     同句模板的共享工厂请求：
//     artifacts/migration/tic/p7/primitive-requests/w5-07280-oath-shared-rules.json
//   · 目标 = act-agenda.js#checkAct 读 `actRule.objective`；「解锁最终深渊」由 07290 的
//     locationRule 行动写 `state.scenarioFlags.remembered`（07290.js#abilities[0]）。
//   · 背面 = content entry-rules.actReveal → 本文件 actRule.onReveal（api 是 scenarioRuntime）：
//     mechanics.map.place / mechanics.water.set / takeFromSetAside / spawn /
//     mechanics.chaosTokens.add（混沌袋诅咒池上限 10 由 chaos-token-pool.js#addPoolTokens 处理）。
//   · 「达贡巢穴」= 07291（setAsideLocations）；位置取 act1BackMap.rawMatrix 的 lairOfDagon 槽：
//     左上格 (3,6) 相对宏伟入口左上格 (2,3) = (+1,+3)。该章 map adjacency='none'，位置只影响
//     展示；07291 的印刷符号（diamond↔circle）与 07290 自动相连，功能不受影响。
//     精确矩阵布置的数据解释器请求：
//     artifacts/migration/tic/p7/primitive-requests/w5-07280-act1-back-layout.json
//   · 达贡 07292a 与 07292b 是同一物理双面卡的两个卡号（cards-data linkedToCode）：
//     setup 把沉睡面卡号 '07292a' 放进 setAside，因此直接 spawn 即（深入沉睡）面。
//
// implemented: true

import { ALL_CARDS, hasTrait, originalOf } from '../../_shared.js'

const GRAND_ENTRYWAY = '07283'
const LAIR_OF_DAGON = '07291'
const DAGON_SLUMBERING = '07292a'
// act1BackMap.rawMatrix：lairOfDagon 左上格 (3,6)、grandEntryway 左上格 (2,3) → 相对偏移。
const LAIR_OFFSET = Object.freeze({ x: 1, y: 3 })
// 背面诅咒数量按当前密谋次序（act2Back.curseByCurrentAgendaStep：1a→10、2a→5、3a→0）。
const CURSE_BY_AGENDA_STEP = Object.freeze({ 1: 10, 2: 5, 3: 0 })

const suspect = { when: ({ state, entity }) => (state.enemies || []).includes(entity) && hasTrait(entity, 'Suspect') }

const isObstacle = attachment => hasTrait(ALL_CARDS[originalOf(attachment)], 'Obstacle')

const locationByCode = (state, code) =>
  state.locations.find(location => String(originalOf(location)) === code) || null

const obstacleAttachmentsAt = (state, locationId) => {
  const location = state.locations.find(candidate => candidate.id === locationId)
  return (location?.attachments || []).filter(isObstacle)
}

// 把放在一边的达贡巢穴放到宏伟入口下方印刷位置（lair 槽）。
function placeLairOfDagon(state, api) {
  const existing = locationByCode(state, LAIR_OF_DAGON)
  if (existing) return existing
  const definition = Object.values(state.scenario.locations || {})
    .find(candidate => String(originalOf(candidate)) === LAIR_OF_DAGON)
  if (!definition) return null
  const grand = locationByCode(state, GRAND_ENTRYWAY)
  const anchor = grand ? api.mechanics.map.position(grand.id) : null
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    api.info?.('⚠️ 宏伟入口没有网格坐标，达贡巢穴无法按图示落位。')
    return null
  }
  api.mechanics.map.place(definition.id, anchor.x + LAIR_OFFSET.x, anchor.y + LAIR_OFFSET.y)
  return locationByCode(state, LAIR_OF_DAGON)
}

export default {
  code: '07281', scope: 'act', implemented: true,
  modifiers: [
    { target: 'enemyHealth', amount: ({ state }) => state.numInvestigators, condition: suspect },
    { target: 'loses:aloof', condition: suspect },
    { target: 'cannot:parley', condition: suspect },
  ],
  actRule: {
    objective(state) {
      return (state.scenarioFlags?.remembered || []).includes('UnlockedTheFinalDepths')
    },
    onReveal(state, act, api) {
      const lair = placeLairOfDagon(state, api)
      if (lair) {
        // 印刷：完全淹没入场（忽略普通涨水上限，直接设为 2）。
        api.mechanics.water.set(lair.id, 2)
        if (api.takeFromSetAside(DAGON_SLUMBERING)) api.spawn(DAGON_SLUMBERING, lair.id)
      } else {
        api.info?.('⚠️ 达贡巢穴不在场，达贡敌人仍放在一边。')
      }
      const curses = CURSE_BY_AGENDA_STEP[state.agendaIndex + 1] || 0
      if (curses) api.mechanics.chaosTokens.add('curse', curses)
      api.info?.(`「第二誓约」背面：达贡巢穴完全淹没、达贡（深入沉睡）入场，加入 ${curses} 个诅咒标记。`)
    },
  },
  abilities: [{
    kind: 'free', actionKind: 'activate', range: 'anywhere',
    label: '花费蓝色、红色、白色或黄色钥匙：弃掉你所在地点的每张[[屏障]]卡牌',
    additionalKeyCost: { colors: ['blue', 'red', 'white', 'yellow'], scope: 'self' },
    criteria: ({ state, inv }) => obstacleAttachmentsAt(state, inv.location).length > 0,
    resolve: ({ state, inv, api }) => {
      const obstacles = obstacleAttachmentsAt(state, inv.location)
      for (const attachment of obstacles) api.scenario.detachEncounterAttachment(attachment)
      if (obstacles.length) api.info?.(`🪨 弃掉所在地点的 ${obstacles.length} 张[[屏障]]。`)
    },
  }],
}
