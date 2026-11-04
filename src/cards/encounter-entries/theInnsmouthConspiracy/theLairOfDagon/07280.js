// 07280 第一誓约（The First Oath）· 幕 1 · 达贡密教巢穴 第七章
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人得到+1[per_investigator]生命值，失去冷漠，并且不能与之谈判。
//   [fast] 花费蓝色、红色、白色或黄色钥匙：弃掉每张附属到你所在地点的[[屏障]]卡牌。
//   目标 - 如果所有幸存的调查员都在宏伟入口且调查员“解锁了洞穴的入口”，推进。
//
// 印刷（English）：
//   Each [[Suspect]] enemy gets +1 [per_investigator] health, loses aloof, and cannot be
//   parleyed with.
//   [fast] Spend the blue, red, white, or yellow key: Discard each [[Obstacle]] card attached
//   to your location.
//   Objective - If each surviving investigator is at Grand Entryway and the investigators have
//   "unlocked the entrance to the caves," advance.
//
// 印刷（中文·背面）：
//   如果有[[嫌犯]]敌人在场上，将其从游戏中移除。
//   将除宏伟入口外的每个地点从游戏中移除（或如果其有胜利X且没有线索，将其加入胜利区），
//   弃掉这些地点的所有卡牌。
//   混洗放在一边的潮水通道地点，将其全部放置入场。
//   提升每个地点的淹没等级。
//   将放在一边的朔望和星潮合相卡牌，和遭遇弃牌堆一起混洗入遭遇牌库。
//
// 印刷（English·背面）：
//   If a [[Suspect]] enemy is in play, remove it from the game.
//   Remove each location other than Grand Entryway from the game (or add it to the victory
//   display instead if it has Victory X and no clues). Discard all cards at those locations.
//   Shuffle the set-aside Tidal Tunnel locations and place them all into play.
//   Increase the flood level of each location.
//   Shuffle the set-aside Syzygy and Tidal Alignment cards, along with the encounter discard
//   pile, into the encounter deck.
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07280.js
//
// 引擎读点：
//   · 正面「嫌犯 +1[每调查员]生命 / 失去冷漠 / 不能谈判」= 条目 `modifiers` 的场景行：
//     modifiers.js#entityModifierTotal（enemyHealth，幕/议程 scene 行）与 #entityRuleActive
//     （loses:aloof / cannot:parley，SCENE_ENTITY_RULES 允许 scene 行），条件用 hasTrait 收窄。
//   · [fast] 能力 = 幕实体上的 free 描述子：parley.js#parleyMovesFor(activeStageEntities)
//     → ability-exec.js#doEntityAbility → reveal.js#executeDescriptor；`range:'anywhere'` 是
//     非玩家实体能力的必需声明（否则 entityAbilityInRange 拒绝）；钥匙费 additionalKeyCost
//     在 key-cost.js，付费点 ability-rules.js#payAbilityCost；清屏障 =
//     api.scenario.detachEncounterAttachment（07299 是该章唯一的 [[屏障]]/Obstacle 附属）。
//   · 目标 = act-agenda.js#checkAct 读 `actRule.objective`（TIC 内容层没有 checkObjectives）。
//   · 背面 = content entry-rules.actReveal → 本文件 actRule.onReveal，api 是 scenarioRuntime：
//     removeEnemyFromGame / awardLocationVictory / removeLocationFromGame / mechanics.map.place /
//     mechanics.water.change / shuffleIntoEncounterDeck / shuffleDiscard。
//   · 「潮水通道」按印刷身份识别：unrevealedName(En)==='Tidal Tunnel'（07102/07103/07104/07290，
//     cards-data 的 backName）。落位取 chapter-data.theLairOfDagon.setup.act1BackMap.rawMatrix 的
//     2x2 格左上角相对宏伟入口的偏移（矩阵原点见下方 TIDAL_TUNNEL_OFFSETS 注释）；该章
//     map.configure({adjacency:'none'})，位置只影响桌面展示，连通靠 07283 的
//     locationRule.connectsToTrait:'Cave' 与印刷符号，因此近似落位不影响规则结算。
//     精确矩阵布置的数据解释器请求：
//     artifacts/migration/tic/p7/primitive-requests/w5-07280-act1-back-layout.json
//
// implemented: true

import { ALL_CARDS, hasTrait, originalOf } from '../../_shared.js'

const GRAND_ENTRYWAY = '07283'
const TIDAL_TUNNEL_NAME = 'Tidal Tunnel'
const TIDAL_TUNNEL_NAME_ZH = '潮水通道'
const SYZYGY = '07101' // 朔望
const TIDAL_ALIGNMENT = '07100' // 星潮合相

// 「每个[[嫌犯]]敌人」：实体必须在场且带 Suspect 特性（印刷特性或运行期授予都算）。
const suspect = { when: ({ state, entity }) => (state.enemies || []).includes(entity) && hasTrait(entity, 'Suspect') }

const isObstacle = attachment => hasTrait(ALL_CARDS[originalOf(attachment)], 'Obstacle')

const locationByCode = (state, code) =>
  state.locations.find(location => String(originalOf(location)) === code) || null

const obstacleAttachmentsAt = (state, locationId) => {
  const location = state.locations.find(candidate => candidate.id === locationId)
  return (location?.attachments || []).filter(isObstacle)
}

// act1BackMap.rawMatrix（8 行 x 6 列「2x2 格」展示矩阵；每个地点占 2x2 格）：
//   tidalTunnel1 左上(1,0)  tidalTunnel2 左上(3,0)
//   tidalTunnel3 左上(0,2)  tidalTunnel4 左上(4,2)
//   grandEntryway 左上(2,3)
//   tidalTunnel5 左上(0,4)  tidalTunnel6 左上(4,4)
//   tidalTunnel7 左上(1,6)
// 以宏伟入口为原点换算出的相对偏移（保持印刷相对方位；lair 槽位由 07281b 使用，这里不占用）。
const TIDAL_TUNNEL_OFFSETS = Object.freeze([
  { x: -1, y: -3 }, { x: 1, y: -3 }, { x: -2, y: -1 }, { x: 2, y: -1 },
  { x: -2, y: 1 }, { x: 2, y: 1 }, { x: -1, y: 3 },
])

function setAsideTidalTunnels(state) {
  const inPlay = new Set(state.locations.map(location => location.id))
  return Object.values(state.scenario.locations || {})
    .filter(definition => !inPlay.has(definition.id)
      && (definition.unrevealedNameEn === TIDAL_TUNNEL_NAME || definition.unrevealedName === TIDAL_TUNNEL_NAME_ZH))
    .map(definition => definition.id)
}

function removeLocationsOtherThanGrandEntryway(state, api) {
  const grand = locationByCode(state, GRAND_ENTRYWAY)
  for (const location of [...state.locations]) {
    if (location.id === grand?.id) continue
    // 「或如果其有胜利X且没有线索，改为加入胜利区」：胜利区入口在引擎 locations.js#awardLocationVictory。
    if (Number(location.victory || 0) > 0 && (location.clues || 0) === 0) api.awardLocationVictory(location.id)
    // 移出游戏会弃掉该地点的敌人（discardEnemyCard）与玩家地点附属（选项），并清理网格坐标。
    api.removeLocationFromGame(location.id, { discardPlayerAttachments: true })
  }
}

function placeAllTidalTunnels(state, api) {
  const grand = locationByCode(state, GRAND_ENTRYWAY)
  const anchor = grand ? api.mechanics.map.position(grand.id) : null
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    api.info?.('⚠️ 宏伟入口没有网格坐标，潮水通道无法按图示落位。')
    return []
  }
  const ordered = api.shuffle(setAsideTidalTunnels(state))
  const placed = []
  for (const [index, id] of ordered.entries()) {
    const offset = TIDAL_TUNNEL_OFFSETS[index]
    if (!offset) break
    if (api.mechanics.map.place(id, anchor.x + offset.x, anchor.y + offset.y)) placed.push(id)
  }
  if (placed.length < ordered.length) api.info?.(`⚠️ 潮水通道只放入 ${placed.length}/${ordered.length} 张。`)
  return placed
}

function increaseFloodEverywhere(state, api) {
  for (const location of [...state.locations]) {
    if (api.mechanics.water.canChange(location.id, 1)) api.mechanics.water.change(location.id, 1)
  }
}

function shuffleSetAsideAlignmentIntoEncounterDeck(state, api) {
  const aligned = []
  for (const code of [SYZYGY, TIDAL_ALIGNMENT]) while (api.takeFromSetAside(code)) aligned.push(code)
  if (aligned.length) api.shuffleIntoEncounterDeck(aligned, { shuffle: false })
  // 印刷：这些卡与「遭遇弃牌堆」一起洗回遭遇牌库（一次洗牌，随后清空弃牌堆）。
  api.shuffleDiscard()
}

export default {
  code: '07280', scope: 'act', implemented: true,
  modifiers: [
    { target: 'enemyHealth', amount: ({ state }) => state.numInvestigators, condition: suspect },
    { target: 'loses:aloof', condition: suspect },
    { target: 'cannot:parley', condition: suspect },
  ],
  actRule: {
    objective(state) {
      const grand = locationByCode(state, GRAND_ENTRYWAY)
      if (!grand) return false
      const alive = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      if (!alive.length) return false
      if (!alive.every(inv => inv.location === grand.id)) return false
      return (state.scenarioFlags?.remembered || []).includes('UnlockedTheEntranceToTheCaves')
    },
    onReveal(state, act, api) {
      const suspectInPlay = state.enemies.find(enemy => !enemy.defeated && !enemy.removedFromGame
        && hasTrait(enemy, 'Suspect'))
      if (suspectInPlay) api.removeEnemyFromGame(suspectInPlay)
      removeLocationsOtherThanGrandEntryway(state, api)
      placeAllTidalTunnels(state, api)
      increaseFloodEverywhere(state, api)
      shuffleSetAsideAlignmentIntoEncounterDeck(state, api)
      api.info?.('「第一誓约」背面：旧地点离场、潮水通道入场、全场涨水，朔望与星潮合相洗回遭遇牌库。')
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
