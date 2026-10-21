// 诡镇奇谈：卡牌版 · 非玩家卡能力（Phase 3 · D1 内容通道）
//
// 这里写敌人 / 地点 / 幕与议程 / 剧情支援 / 威胁区遭遇卡的声明式行为。
// 与 src/cards/entries/<code>.js 是同一套描述子，只是条目的 `scope` 不是 'card'：
//   scope: 'enemy' | 'location' | 'act' | 'agenda' | 'storyAsset' | 'treachery'
//
// 为什么需要这个通道（重构路线 §5 D1）：
//   · 此前敌人与地点的能力只能写在 `content/campaigns/<campaign>/scenarios/<id>/behavior.js`
//     或 `encounter-rules.js` 的钩子里——同一张卡的规则在多个章节重复实现，
//     引擎里也留着 `enemy.code === '…'` 这样的分支；
//   · 现在这些能力写在卡号条目上：引擎按「场上实体」枚举（descriptorSources），
//     数值与布尔规则走 modifiers.js 的 entityModifierTotal / entityRuleActive。
//
// 可用的修正目标（modifiers.js 的 ENTITY_MODIFIER_TARGETS / ENTITY_RULE_TARGETS）：
//   enemyFight / enemyEvade / enemyHealth / locationShroud / locationClues
//   cannot:attack / cannot:beAttacked / cannot:beDefeated / cannot:beDamaged
//   cannot:opportunityAttack / ignore:revealText
//
// 修正的来源按「声明在谁身上」决定：敌人自己的条目总是生效；地点的条目作用于
// 「位于该地点的敌人」；当前幕/议程的条目作用于全场敌人。
// 条件与数值函数拿到的 ctx：{ state, source, entity, host, helpers }
//   entity = 被修正的实体（敌人/地点/…），source = 声明这条修正的卡，
//   helpers.remainingSanity(inv) / helpers.maxSanity(inv) 是引擎口径的读点。
//
// 约定：只写「这张卡自己的规则」。跨卡、跨章节的剧本流程仍然留在 scenario behavior；
// 有简化行为的条目必须写 simplified: true + note（见路线文档 §3 末条）。

import { hasTrait } from '../engine/matcher.js'
import { ALL_CARDS } from './cards-data.js'

// 胜利区的复仇点数（失落时代的「复仇」按卡面点数累计到胜利区）。
const victoryVengeance = state => (state?.victoryDisplay || [])
  .reduce((sum, card) => sum + Number(card.vengeance || 0), 0)

const actThreeIs = (state, value) => state?.scenarioFlags?.actThree === value

// 一个实体的印刷卡号（附属于别的卡时 originalCode 才是原卡号）。
const originalOf = entity => entity?.originalCode || entity?.code

// 风琴手远离最近调查员的移动（第 7 批从 aPhantomOfTruth/behavior.js 搬来）。
function moveOrganistAway(state, api) {
  const organist = state.enemies.find(enemy => ['03221', '03221b'].includes(enemy.code))
  if (!organist) return
  organist.engagedSeat = null
  const investigators = state.investigators
    .filter(inv => !inv.defeated && !inv.resigned)
    .map(inv => inv.location)
  const here = state.locations.find(location => location.id === organist.location)
  const candidates = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
  if (!candidates.length) return
  const scored = candidates.map(id => ({ id, score: api.locationDistance(id, investigators) }))
  const best = Math.max(...scored.map(item => item.score))
  const choices = scored.filter(item => item.score === best)
  const destination = choices.length === 1 ? choices[0].id : api.choose({
    kind: 'location', source: organist.id, seat: state.campaign.leadSeat,
    prompt: '选择风琴手远离最近调查员的移动地点。',
    options: choices.map(item => ({ id: item.id, label: api.locationName(item.id) })),
  })
  api.moveEnemy(organist, destination)
}

// 「不可言说的誓言」的钥匙选择 / 怪物暂存（第 7 批从章节 behavior 搬来）。
function chooseKeysInEntry(state, api, skills = ['combat', 'agility', 'intellect']) {
  const options = [
    ...skills.map(skill => ({ id: skill, label: `由一位调查员进行 [${skill}]（4）检定` })),
    { id: 'force', label: '强行夺走钥匙' },
  ]
  const answer = api.choose({
    kind: 'story', source: '03163', seat: state.campaign.leadSeat,
    prompt: '选择取得地下室钥匙的方式。', options,
  })
  if (answer === 'force') {
    state.scenarioFlags.tookKeysByForce = true
    state.scenarioFlags.keysFound = 1
    return
  }
  const candidates = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
  const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
    kind: 'target', source: `03163-${answer}`, seat: state.campaign.leadSeat,
    prompt: '选择进行检定的调查员。',
    options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
  }))
  api.test(seat, answer, 4, result => {
    if (result.success) {
      state.scenarioFlags.keysFound = 1
      return
    }
    chooseKeysInEntry(state, api, skills.filter(skill => skill !== answer))
  })
}

function stashRandomMonsterInEntry(state, api) {
  const monsters = state.scenarioZones.monsters || []
  if (!monsters.length) return null
  const code = monsters.splice(Math.floor(api.random() * monsters.length), 1)[0]
  if (state.agendaIndex === 2) {
    state.encounterDeck.push(code)
    api.shuffleEncounterDeck()
  } else {
    state.scenarioZones.underAct ||= []
    state.scenarioZones.underAct.push(code)
  }
  return code
}

function connectPassagewaysInEntry(state) {
  const inPlay = state.scenario.passagewayLocations.filter(id => state.locations.some(location => location.id === id))
  for (const location of state.locations.filter(candidate => inPlay.includes(candidate.id))) {
    location.connections = [...new Set([...location.connections, ...inPlay.filter(id => id !== location.id)])]
  }
}

// 「埃兹特里覆灭」的时间石室 / 古代遗物 / 预示者（第 7 批从章节 behavior 搬来）。
function doomLocation(state, code) {
  return state.locations.find(location => originalOf(location) === code)
}

function takeFromSetAsideInEntry(state, code) {
  const zones = (state.scenarioZones ||= {})
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

function takeControlOfRelicInEntry(state, api) {
  const chamber = doomLocation(state, '04068')
  const candidates = chamber
    ? state.investigators.filter(inv => !inv.defeated && !inv.resigned && inv.location === chamber.id)
    : []
  if (!candidates.length) {
    api.info?.('时间石室里没有调查员，古代遗物仍留在原地。')
    return null
  }
  const answer = candidates.length === 1 ? String(candidates[0].seat) : api.choose({
    kind: 'investigator', source: '04058', seat: state.campaign.leadSeat ?? 0,
    prompt: '选择位于时间石室、控制「古代遗物」的调查员。',
    options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  const seat = Number(answer)
  const owner = candidates.find(inv => inv.seat === seat) || candidates[0]
  const asset = (state.storyAssets || []).find(item => originalOf(item) === '04061')
  if (asset) state.storyAssets.splice(state.storyAssets.indexOf(asset), 1)
  if (!(owner.assets || []).some(item => originalOf(item) === '04061')) api.giveAsset?.(owner.seat, '04061')
  api.moveRelicOfAges?.({ seat: owner.seat })
  api.info?.(`🏺 ${owner.name} 控制了「古代遗物」。`)
  return owner
}

function chooseEntryOption(api, request, candidates, label = candidate => candidate.name || candidate.id) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  const key = candidate => String(candidate?.id ?? candidate?.seat ?? candidate?.code)
  const id = api.choose({ ...request, options: candidates.map(candidate => ({ id: key(candidate), label: label(candidate) })) })
  return candidates.find(candidate => key(candidate) === String(id)) || candidates[0]
}

function entryDistance(state, from, to) {  if (from === to) return 0
  const queue = [[from, 0]]
  const seen = new Set([from])
  for (const [id, steps] of queue) {
    if (id === to) return steps
    const location = state.locations.find(candidate => candidate.id === id)
    for (const next of location?.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Infinity
}

function formLocationLineInEntry(state, api) {  const entryway = doomLocation(state, '04060')
  const chamber = doomLocation(state, '04068')
  const others = state.locations
    .filter(location => location.id !== entryway?.id && location.id !== chamber?.id)
    .sort((left, right) => (left.doom || 0) - (right.doom || 0)
      || String(originalOf(left)).localeCompare(String(originalOf(right))))
  const order = [chamber, ...others, entryway].filter(Boolean)
  const flags = (state.scenarioFlags ||= {})
  flags.locationLine = order.map(location => location.id)
  flags.locationsInLine = true
  for (const [index, location] of order.entries()) {
    location.connections = [order[index - 1]?.id, order[index + 1]?.id].filter(Boolean)
    location.linePosition = index + 1
  }
  state.scenario.layout ||= {}
  state.scenario.layout.locations = Object.fromEntries(order.map((location, index) => [
    location.id, { x: index - (order.length - 1) / 2, y: 0 },
  ]))
  api.info?.(`🧱 遗迹排成一条线：${order.map(location => location.name).join(' → ')}。`)
  return order
}

function spawnHarbingerAtDoomInEntry(state, api) {
  const flags = (state.scenarioFlags ||= {})
  if (!state.locations.length) return null
  const most = Math.max(...state.locations.map(location => location.doom || 0))
  const candidates = state.locations.filter(location => (location.doom || 0) === most)
  const answer = candidates.length === 1 ? candidates[0].id : api.choose({
    kind: 'location', source: '04055', seat: state.campaign.leadSeat ?? 0,
    prompt: '选择毁灭标记最多、预示者生成的地点。',
    options: candidates.map(location => ({ id: location.id, label: `${location.name}（毁灭 ${location.doom || 0}）` })),
  })
  const locationId = (candidates.find(location => location.id === answer) || candidates[0]).id
  takeFromSetAsideInEntry(state, '04062')
  flags.harbingerSpawned = true
  const enemy = api.spawn('04062', locationId)
  const spawned = enemy || state.enemies.find(item => originalOf(item) === '04062') || null
  if (spawned) {
    if (!spawned.damageTaken && flags.harbingerDamage) spawned.damageTaken = flags.harbingerDamage
    spawned.resources = spawned.resources || 0
    spawned.tfaRetaliateWhileExhausted = true
  }
  return spawned
}

export const NON_PLAYER_ABILITY_ENTRIES = [
  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------
  // “狼人”德鲁（01137）：攻击时治愈他 1 点伤害。
  // 迁移自 enemies.js 的 `enemy.code === 'wolfManDrew'` 分支（REPORT.md §2.6 / 第 2 批）。
  // 非玩家条目的 code 用运行时实体 id（关卡定义里的 key），与既有 screechingByakhee 一致。
  {
    code: 'wolfManDrew',
    name: '“狼人”德鲁',
    scope: 'enemy',
    text: '强制 - 攻击时：治愈他 1 点伤害。',
    abilities: [{
      kind: 'forced', trigger: 'enemyAttack', silent: true,
      criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
      resolve: ({ api, source }) => api.healEnemy(source, 1),
    }],
  },
  // 年幼的深潜者（01181）：与它交战时受到 1 点恐惧。
  // 迁移自 enemies.js 的 `enemy.code === 'youngDeepOne'` 分支。
  {
    code: 'youngDeepOne',
    name: '年幼的深潜者',
    scope: 'enemy',
    text: '强制 - 与它交战时：受到 1 点恐惧。',
    abilities: [{
      kind: 'forced', trigger: 'enemyEngaged', silent: true,
      criteria: { when: ({ source, context, inv }) => source?.id === context?.enemy?.id && inv?.seat === context?.seat },
      resolve: ({ api, inv, source }) => {
        api.info(`😱 「${source.name}」交战强制：${inv.name} 受到 1 点恐惧。`)
        api.horror(inv.seat, 1)
      },
    }],
  },
  // 黑山羊眷族（01180）：被击败时，它所在地点的每位调查员受到 1 点恐惧。
  // 迁移自 enemies.js 的 `enemy.code === 'goatSpawn'` 分支；窗口在胜利区结算之前。
  {
    code: 'goatSpawn',
    name: '黑山羊眷族',
    scope: 'enemy',
    text: '强制 - 被击败时：它所在地点的每位调查员受到 1 点恐惧。',
    abilities: [{
      kind: 'forced', trigger: 'enemyDefeated', silent: true,
      criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
      resolve: ({ api, source }) => {
        for (const inv of api.investigatorsAt(source.location)) {
          api.info(`😱 「${source.name}」的临死反噬：${inv.name} 受到 1 点恐惧。`)
          api.horror(inv.seat, 1)
        }
      },
    }],
  },
  // 坚韧的黑山羊幼崽（01179）：回合结束时治愈它 2 点伤害。
  // 迁移自 turn.js 的 `enemy.code === 'relentlessDarkYoung'` 分支。
  {
    code: 'relentlessDarkYoung',
    name: '坚韧的黑山羊幼崽',
    scope: 'enemy',
    text: '强制 - 回合结束时：治愈它 2 点伤害。',
    abilities: [{
      kind: 'forced', trigger: 'enemyRoundEnd', silent: true,
      criteria: { when: ({ source, context }) => source?.id === context?.enemy?.id },
      resolve: ({ api, source }) => {
        api.healEnemy(source, 2)
        api.info(`💉 「${source.name}」治愈 2 点伤害。`)
      },
    }],
  },
  // -------------------------------------------------------------------------
  // 敌人卡面的特殊规则（原 card-rules.js 的 ENEMY_RULE_FLAGS，REPORT.md 第 3 批）
  // -------------------------------------------------------------------------
  // 猎手夜魇（01172 / huntingNightgaunt）：负面标记双倍结算。
  { code: '01172', name: '猎手夜魇', scope: 'enemy', text: '负面标记双倍结算。', enemyRule: { doubleNegative: true } },
  { code: 'huntingNightgaunt', name: '猎手夜魇', scope: 'enemy', text: '负面标记双倍结算。', enemyRule: { doubleNegative: true } },
  // 02094：用远程/枪械/法术武器攻击它时难度 -3。
  { code: '02094', name: '02094', scope: 'enemy', text: '用远程、枪械或法术武器攻击它时难度 -3。', enemyRule: { rangedAttackDifficultyReduction: 3 , prey: 'lowestIntellect'} },
  // 02182：与它交战期间不能移动。
  { code: '02182', name: '02182', scope: 'enemy', text: '与它交战期间不能移动。', enemyRule: { blocksMovementWhileEngaged: true } },
  // 02103：用近战武器攻击它时，武器被摧毁。
  { code: '02103', name: '02103', scope: 'enemy', text: '用近战武器攻击它时，武器被摧毁。', enemyRule: { destroysMeleeWeapon: true , prey: 'lowestWillpower'} },
  // 01177 / yithianObserver：攻击时随机弃 1 张手牌。
  { code: '01177', name: '伊斯观察者', scope: 'enemy', text: '攻击时随机弃 1 张手牌；无手牌则伤害与恐惧各 +1。', enemyRule: { discardRandomOnAttack: true } },
  { code: 'yithianObserver', name: '伊斯观察者', scope: 'enemy', text: '攻击时随机弃 1 张手牌；无手牌则伤害与恐惧各 +1。', enemyRule: { discardRandomOnAttack: true } },
  // 尖叫的拜亚基：与你交战时，若你剩余神智 ≤ 4，它的战斗/躲避 +1。
  // 迁移自 engine.js 的 `enemy.code === 'screechingByakhee'` 分支（Phase 3 D1）。
  {
    code: 'screechingByakhee',
    name: '尖叫的拜亚基',
    scope: 'enemy',
    text: '与你交战时，若你的剩余神智不超过 4，它的战斗与躲避 +1。',
    modifiers: [
      {
        target: 'enemyFight', amount: 1,
        condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
          && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
      },
      {
        target: 'enemyEvade', amount: 1,
        condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
          && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
      },
    ],
  },
  // 埃兹特里的守卫者（04086）：04048「搜索遗迹」时不能攻击也不能被攻击；
  // 04049「守备森严的遗迹」时战斗与躲避 +1。
  // 迁移自 theUntamedWilds 的 enemyCannotAttack / enemyCannotBeAttacked / enemyStatModifier。
  {
    code: '04086', implemented: true,
    name: '埃兹特里的守卫者',
    scope: 'enemy',
    text: '搜索遗迹时不能攻击也不能被攻击；守备森严的遗迹时战斗与躲避 +1。',
    enemyRule: { spawnAnyEmpty: true },
    modifiers: [
      { target: 'cannot:attack', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
      { target: 'cannot:beAttacked', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
      { target: 'enemyFight', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
      { target: 'enemyEvade', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
    ],
  },
  // 羽翼蛇族（04209b）：不能被击败，也不发动借机攻击。
  // 关卡定义里的实例字段（cannotBeDefeated/noOpportunityAttack）仍在；
  // 这里给出卡面声明，使同一张卡在别的章节生成时也遵守同一规则。
  {
    code: '04209b',
    name: '羽翼蛇族',
    scope: 'enemy',
    text: '不能被击败。不发动借机攻击。',
    modifiers: [
      { target: 'cannot:beDefeated' },
      { target: 'cannot:opportunityAttack' },
    ],
  },
  // 兄弟会教徒（04095）：它身上每有 1 个毁灭标记，战斗与躲避 +1。
  // 迁移自 theForgottenAge/encounter-rules.js 的 enemyStatModifier 分支。
  {
    code: '04095', implemented: true,
    name: '兄弟会教徒',
    scope: 'enemy',
    text: '它身上每有 1 个毁灭标记，它的战斗与躲避 +1。',
    modifiers: [
      { target: 'enemyFight', amount: ({ entity }) => entity.doom || 0 },
      { target: 'enemyEvade', amount: ({ entity }) => entity.doom || 0 },
    ],
  },
  // 蟑螂群（03103）：战斗值等于所在地点的帷幕（含帷幕修正）。
  // 迁移自 thePathToCarcosa/encounter-rules.js 的 enemyStatModifier 分支。
  {
    code: '03103', implemented: true,
    name: '蟑螂群',
    scope: 'enemy',
    text: '它的战斗值等于所在地点的帷幕（含帷幕修正）。',
    modifiers: [{
      target: 'enemyFight',
      amount: ({ state, entity }) => {
        const location = (state.locations || []).find(candidate => candidate.id === entity.location)
        return (location?.shroud || 0) + (location?.shroudMod || 0) - (entity.fight || 0)
      },
    }],
  },
  // 潜行的拜亚基（03222）：横置时战斗 -3。
  {
    code: '03222', implemented: true,
    name: '潜行的拜亚基',
    scope: 'enemy',
    text: '它横置时战斗 -3。',
    modifiers: [{
      target: 'enemyFight', amount: -3,
      condition: { when: ({ entity }) => entity.exhausted === true },
    }],
  },
  // 哈斯塔的傀儡（03096）：调查阶段，它的战斗值获得本轮累积的傀儡加值。
  {
    code: '03096', implemented: true,
    name: '哈斯塔的傀儡',
    scope: 'enemy',
    text: '调查阶段，它的战斗值获得本轮累积的加值。',
    modifiers: [{
      target: 'enemyFight',
      amount: ({ state, entity }) => (state.phase === 'investigation'
        ? (entity.puppetFightBonuses || [])
          .filter(bonus => bonus.investigationRound === state.round)
          .reduce((sum, bonus) => sum + bonus.amount, 0)
        : 0),
    }],
    enemyScript: {
      onEngage(state, enemy, inv, api) {
        const choice = api.choose({
          kind: 'encounter', source: '03096', seat: inv.seat,
          prompt: '哈斯塔的傀儡与你交战：选择承受1点恐惧，或令其本调查阶段战斗+3。',
          options: [{ id: 'horror', label: '承受1点恐惧' }, { id: 'fight', label: '本调查阶段战斗+3' }],
        })
        if (choice === 'horror') api.horror(inv.seat, 1)
        else {
          const investigationRound = ['enemy', 'upkeep'].includes(state.phase) ? state.round + 1 : state.round
          enemy.puppetFightBonuses ||= []
          enemy.puppetFightBonuses.push({ amount: 3, investigationRound })
        }
      },
    },
  },
  // -------------------------------------------------------------------------
  // 地点
  // -------------------------------------------------------------------------
  // 万蛇据点（04072）：此处的每个蛇族敌人战斗 +1。
  // 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 enemyStatModifier 分支。
  {
    code: '04072',
    name: '万蛇据点',
    scope: 'location',
    text: '此处的每个[[蛇族]]敌人战斗 +1。',
    modifiers: [{
      target: 'enemyFight', amount: 1,
      condition: { when: ({ entity }) => hasTrait(entity, 'Serpent') },
    }],
  },
  // 毒牙神庙（04074）：胜利区每有 1 点复仇点数，此处帷幕 +1。
  // 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 locationShroudModifier 分支。
  {
    code: '04074',
    name: '毒牙神庙',
    scope: 'location',
    text: '胜利区每有 1 点复仇点数，此处帷幕 +1。',
    modifiers: [{
      target: 'locationShroud',
      amount: ({ state }) => victoryVengeance(state),
    }],
  },
  // 墓地（01133）：进入后意志(3)检定，失败二选一「受到 2 点恐惧 / 移动到河岸城」。
  // 迁移自 movement.js 的 `loc.id === 'graveyard'` 分支（REPORT.md §2.1）。
  {
    code: '01133',
    name: '墓地',
    scope: 'location',
    text: '强制 - 你进入墓地后：意志（3）检定，失败须受到 2 点恐惧或移动到河岸城。',
    locationRule: {
      onEnter: {
        test: { skill: 'willpower', difficulty: 3 },
        failChoice: {
          prompt: '墓地检定失败：选择受到 2 点恐惧或移动到河岸城。',
          options: [
            { id: 'horror', label: '受到 2 点恐惧', log: '😱 「墓地」检定失败：{name} 受到 2 点恐惧。', effect: { type: 'takeHorror', amount: 2, silent: true } },
            { id: 'move', label: '移动到河岸城', requiresLocation: 'rivertown', effect: { type: 'moveInvestigator', destination: 'rivertown' } },
          ],
        },
      },
    },
  },
  // 扭曲的道路（01151）：离开时智力(3)检定，失败取消本次移动。
  // 迁移自 movement.js 的 `prevLoc.id === 'twistingPaths'` 分支（REPORT.md §2.1）。
  {
    code: '01151',
    name: '阿卡姆密林 · 扭曲的道路',
    scope: 'location',
    text: '强制 - 离开时：智力（3）检定，失败取消本次移动。',
    locationRule: {
      onLeave: { test: { skill: 'intellect', difficulty: 3 }, cancelMessage: '🌀 「扭曲的道路」：{name} 迷路了，移动被取消。' },
    },
  },
  // 仪式地（01156）：回合结束时线索补至调查员人数的 2 倍。
  {
    code: '01156',
    name: '仪式地',
    scope: 'location',
    text: '强制 - 回合结束时，若线索少于调查员人数的 2 倍，补至 2 倍。',
    locationRule: { onRoundEnd: { cluesPerInvestigator: 2 } },
  },
  // 假面猎手（01121b）：交战时不能发现或花费线索。
  {
    code: '01121b',
    name: '假面猎手',
    scope: 'enemy',
    text: '你与假面猎手交战时，不能发现或花费线索。',
    enemyRule: { blocksCluesWhileEngaged: true, blocksCluesMessage: '蒙面猎手' },
  },
  // 东城区（01132）：在此地打出盟友支援费用 -2。
  {
    code: '01132',
    name: '东城区',
    scope: 'location',
    text: '你位于东城区时，你打出每张盟友支援的费用 -2。',
    locationRule: { playDiscount: { cardType: 'asset', trait: 'ally', amount: 2 } },
  },
  // -------------------------------------------------------------------------
  // 诡计
  // -------------------------------------------------------------------------
  // 错误指示（01136）：没有线索时获得涌动。
  // 迁移自 treachery-tokens.js 的 `t.code === 'falseLead'` 分支；标记放条目，不写关卡定义（避免改 state 指纹）。
  {
    code: 'falseLead',
    name: '错误指示',
    scope: 'treachery',
    text: '显现 - 如果你没有线索，错误指示获得涌动。否则智力（4）检定，每低于难度 1 点，将你的 1 个线索放到所在地点。',
    surgeIfNoClues: true,
  },
  // 乘着黑暗之翼（01169?）：失败惩罚的 kind 在卡面数据里是卡名，这里映射成通用 kind。
  // 引擎的 applyPenalty 不再认识具体卡名。
  {
    code: 'onWingsOfDarkness',
    name: '乘着黑暗之翼',
    scope: 'treachery',
    text: '显现 - 敏捷（4）检定。失败受到 1 点伤害与 1 点恐惧，与每个非夜魇敌人解除交战，并被带到中心地点。',
    penaltyKind: 'damageHorrorDisengageAndMoveCentral',
  },
  // -------------------------------------------------------------------------
  // 卡号级规则（原 card-rules.js，REPORT.md 第 3 批）
  // -------------------------------------------------------------------------
  // 不洁之地（02088）：使调查员身上的盟友文本空白。
  { code: '02088', implemented: true, name: '不洁之地', scope: 'treachery', text: '你控制的所有盟友的文本被视为空白。', blanksTraits: ['ally'] },
  // 中毒（04102）：一张会进入牌组的威胁；战役补给可花 XP 移除。
  {
    code: '04102', implemented: true, name: '中毒', scope: 'treachery', text: '中毒弱点。', poisonThreat: true, treacheryRule: { permanent: true },
    encounterResolve(state, inv, card, api) {
      api.poison(inv.seat)
      return false
    },
  },
  // 死寂之夜（02043）：整理阶段手牌上限 -3。
  { code: '02043', name: '死寂之夜', scope: 'agenda', text: '整理阶段你的手牌上限 -3。', agendaHandSizePenalty: 3 },
  // 奥恩图书馆（02050）：在此调查额外花 1 行动。
  { code: '02050', name: '奥恩图书馆', scope: 'location', text: '在此地点调查额外花费 1 行动。', investigateExtraActions: 1 },
  // 忍气吞声（02089）：地点离场时按计数器把这张遭遇卡放回遭遇弃牌堆。
  { code: '02089', implemented: true, name: '忍气吞声', scope: 'treachery', text: '地点计数器型障碍。', locationCounter: 'sordidAndSilent' },
  // 珍品店（04142）：位于此处时打出遗物支援费用 -2。
  { code: '04142', name: '珍品店', scope: 'location', text: '位于此处时打出 [[遗物]] 支援的费用 -2。', relicDiscountLocation: true },
  // 另一个次元（02320）：地点被移出游戏时的默认去向。
  { code: '02320', name: '另一个次元', scope: 'location', text: '地点被移出游戏时的默认去向。', relocateDestination: true },
  // 彼端的世界（04318）：没有可生成地点时，翻探索牌库放一个地点。
  { code: '04318', name: '彼端的世界', scope: 'act', text: '敌人没有可生成地点时，翻探索牌库直到地点。', placesLocationForEmptySpawn: true },
  // 苍白面具下的男子（03059）：被击败时推进战役记录。
  { code: '03059', name: '苍白面具下的男子', scope: 'enemy', text: '被击败时记录「追逐陌生人」。', pallidMask: true },
  // 奥术屏障（02102）：地点计数器型障碍。引擎按 `locationBarrier.counter` 找规则，
  // 检定难度、取消/继续选项与「弃牌库顶 N 张」都由这张卡声明（REPORT.md §9 第 1 批）。
  {
    code: '02102', implemented: true,
    name: '奥术屏障',
    scope: 'treachery',
    text: '放置到当前地点。离开/进入带此障碍的地点时，意志(4)检定；失败可以取消移动，或弃掉牌库顶 5 张牌继续。',
    locationCounter: 'arcaneBarriers',
    locationBarrier: {
      counter: 'arcaneBarriers',
      label: '奥术屏障',
      test: { skill: 'willpower', difficulty: 4 },
      prompt: '奥术屏障：取消移动，或弃掉牌库顶 5 张牌继续移动。',
      options: [
        { id: 'cancel', label: '取消移动' },
        { id: 'mill', label: '弃掉 5 张牌继续移动', mill: 5 },
      ],
    },
  },
  // 第 7 批：从 content/campaigns/thePathToCarcosa/card-data.js 的三张表搬来的卡面规则。
  // 隐藏卡（03084a–d / 03186 / 03187 / 03340–03342）。
  { code: '03084a', implemented: true, scope: 'treachery', hiddenRule: { cannotCommitTypes: ['skill'], discard: { actions: 2 } } },
  { code: '03084b', implemented: true, scope: 'treachery', hiddenRule: { maxMovesPerTurn: 1, discard: { actions: 2 } } },
  { code: '03084c', implemented: true, scope: 'treachery', hiddenRule: { cannotTriggerFree: true, discard: { actions: 2 } } },
  { code: '03084d', implemented: true, scope: 'treachery', hiddenRule: { cannotPlayTypes: ['event'], discard: { actions: 2 } } },
  { code: '03186', scope: 'treachery', hiddenRule: { cannotFightTraits: ['Lunatic'] } },
  { code: '03187', scope: 'treachery', hiddenRule: { cannotTriggerLocationAbilities: true } },
  { code: '03340', scope: 'treachery', hiddenRule: { allowCommit: true, autoFailOnCommit: true, killAtHorrorOverSanityMultiplier: 2 } },
  { code: '03341', scope: 'treachery', hiddenRule: { killAtHorrorOverSanityMultiplier: 2, discard: { actions: 1, resources: 5 } } },
  { code: '03342', scope: 'treachery', hiddenRule: { killAtHorrorOverSanityMultiplier: 2, discard: { actions: 1, damageInvestigator: 2 } } },
  // 威胁区卡（03225 / 03226）。
  {
    code: '03225', implemented: true, scope: 'treachery', threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true },
    encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      let placed = false
      api.test(inv.seat, 'willpower', 5, result => {
        if (result.success) return
        api.threat(inv.seat, '03225', {
          resources: Math.max(1, result.difficulty - result.value),
          threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true },
        })
        placed = true
      })
      return placed
    },
  },
  {
    code: '03226', implemented: true, scope: 'treachery', threatEffect: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
    encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.threat(inv.seat, '03226', {
        threatEffect: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
      })
      return true
    },
  },
  // 敌人猎物规则（03086 / 03089 / 03099）。
  {
    code: '03086', implemented: true, scope: 'enemy', enemyRule: { prey: 'lowestSanity' },
    enemyScript: {
      onHunterMove(state, enemy, api) {
        let moved = 0
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        while (!active.some(inv => inv.location === enemy.location)) {
          const next = api.hunterStep(enemy)
          if (!next || next === enemy.location) break
          api.moveEnemy(enemy, next)
          moved++
        }
        if (moved > 1) enemy.skipAttackRound = state.round
        return true
      },
    },
  },
  {
    code: '03089', implemented: true, scope: 'enemy', enemyRule: { prey: 'mostHorror' },
    enemyScript: {
      onEvade(state, inv, enemy, result, api) {
        if (result?.success && result.value - result.difficulty <= 2) api.horror(inv.seat, 1)
      },
    },
  },
  {
    code: '03099', implemented: true, scope: 'enemy', enemyRule: { prey: 'mostClues' },
    enemyScript: {
      onAttackResolved(state, enemy, inv, api) {
        if (inv.clues < 1) return
        api.spendClues(inv.seat, 1)
        enemy.clues = (enemy.clues || 0) + 1
      },
      onDefeated(state, enemy, api) {
        if (!enemy.clues) return false
        const inv = state.investigators[enemy.defeatedBy]
        if (inv) api.gainClues(inv.seat, enemy.clues)
        enemy.clues = 0
        return false
      },
    },
  },
  // 第 7 批：从 content/campaigns/theForgottenAge/card-data.js 的两张表搬来的卡面规则。
  { code: '04052', scope: 'enemy', enemyRule: {"prey":"mostClues","parley":{"skill":"intellect","difficulty":4}} },
  { code: '04062', scope: 'enemy', enemyRule: {"healthPerInvestigator":10,"vengeance":5,"retaliateWhileExhausted":true} },
  { code: '04078', implemented: true, scope: 'enemy', enemyRule: {"prey":"poisoned","vengeance":1} },
  { code: '04079', implemented: true, scope: 'enemy', enemyRule: {"vengeance":2} },
  { code: '04084', implemented: true, scope: 'enemy', enemyRule: {"victory":1}, enemySpawnRule: { vengeanceThresholds: { retaliate: 1, hunter: 2, damageReduction: 3 } } },
  { code: '01170', implemented: true, scope: 'enemy', enemyRule: {"retaliate":true,"spawnAnyEmpty":true,"mythosEndDoom":1} },
  { code: '04259', scope: 'enemy', enemyRule: {"prey":"mostHand"} },
  { code: '04122b', scope: 'enemy', enemyRule: {"victory":1} },
  { code: '04130b', scope: 'enemy', enemyRule: {"victory":1} },
  { code: '04137b', scope: 'enemy', enemyRule: {"victory":1} },
  { code: '04186', scope: 'enemy', enemyRule: {"victory":2,"vengeance":2} },
  { code: '04187', scope: 'enemy', enemyRule: {"victory":1,"vengeance":1} },
  { code: '04219', scope: 'enemy', enemyRule: {"victory":1} },
  { code: '04220', scope: 'enemy', enemyRule: {"vengeance":2} },
  { code: '04296', scope: 'enemy', enemyRule: {"victory":5} },
  { code: '04337', scope: 'enemy', enemyRule: {"immobile":true} },
  { code: '04297', scope: 'enemy', enemyRule: {"vengeance":1} },
  { code: '04298', scope: 'enemy', enemyRule: {"victory":2} },
  {
    code: '04094', implemented: true, scope: 'treachery', treacheryRule: {"sideArea":true},
    encounterResolve(state, inv, card, api) {
      state.scenarioFlags ||= {}
      state.scenarioFlags.deepDark = Number(state.scenarioFlags.deepDark || 0) + 1
      state.scenarioFlags.deepDarkClaims = {}
      api.info?.('一片漆黑开始生效：每位调查员每轮从单个地点最多发现 1 个线索。')
      return true
    },
  },
  {
    code: '04089', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'escapeEntombed', label: '逃出墓穴', skills: ['agility', 'combat'], difficulty: 4, target: 'threat', skillLabels: { agility: '检定敏捷(4)逃出墓穴', combat: '检定战斗(4)逃出墓穴' } },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04089')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04089', { noMove: true, noDisengage: true })
      return true
    },
  },
  {
    code: '04097', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'discardWordsOfPower', label: '花 2 个行动弃掉力量真言', actions: 2, target: 'threat', noTest: true },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04097')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04097', { blockDoomEnemyDamage: true, blockCluesHere: true })
      return true
    },
  },
  {
    code: '04099', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04099')) {
        api.drawEncounter(inv.seat)
        return false
      }
      const poisoned = (inv.threat || []).some(item => originalOf(item) === '04102') || inv.poisoned === true
      api.threat(inv.seat, '04099', { blankItemAssets: true, forcedRoundEndDiscard: true })
      if (poisoned) api.drawEncounter(inv.seat)
      return true
    },
  },
  {
    code: '04077', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'endVoiceOfTheJungle', label: '检定意志(3)驱散丛林之声', skills: ['willpower'], difficulty: 3, target: 'threat' },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04077')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04077', { forcedEndTurnHorror: 1 })
      return true
    },
  },
  {
    code: '04085', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
    threatAction: { rule: 'endCurseOfYig', label: '检定意志(2+复仇)摆脱伊格的诅咒', skills: ['willpower'], difficulty: 2, target: 'threat', vengeance: true },
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '04085')) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.threat(inv.seat, '04085', {
        threatEffect: { statModifiers: { combat: -1 }, healthModifier: -1 },
        grantedTrait: 'Serpent',
      })
      inv.traits = [...new Set([...(inv.traits || []), 'Serpent'])]
      return true
    },
  },
  { code: '04189', scope: 'treachery', treacheryRule: {"threatArea":true} },
  { code: '04190', scope: 'treachery', treacheryRule: {"threatArea":true} },
  { code: '04214', scope: 'treachery', treacheryRule: {"threatArea":true} },
  { code: '04261', scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"noDrawAction":true},"surge":false} },
  {
    code: '01164', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"extraActionCost":["move","fight","evade"],"endTurnTest":{"skill":"willpower","difficulty":3}}},
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '01164')) { api.drawEncounter(inv.seat); return false }
      api.threat(inv.seat, '01164')
      return true
    },
  },
  {
    code: '01165', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"cannotPlay":["asset","event"],"roundEndDiscard":true}},
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(item => originalOf(item) === '01165')) { api.drawEncounter(inv.seat); return false }
      api.threat(inv.seat, '01165')
      return true
    },
  },
  // 第 7 批：从 content/campaigns/theDunwichLegacy/card-data.js 的逐卡分支搬来的规则。
  { code:"02092",scope:"treachery",threatEffect:{mods:{allSkills:-1}},implemented:true},
  { code:"02058",scope:"enemy",enemyRule:{healthPerPlayerBonus:3},enemyScript:{onPhaseStart(state,enemy){ enemy.exhausted=false }}},
  { code:"02323",scope:"enemy",enemyRule:{healthPerPlayerBonus:6}},
  { code:"02087",scope:"enemy",enemyRule:{prey:"fewestHand"}},
  { code:"02078",scope:"enemy",enemyRule:{prey:"highestIntellect"}},
  { code:"02104",scope:"enemy",enemyRule:{prey:"lowestAgility"}},
  { code:"02095",scope:"enemy",enemyRule:{prey:"lowestAgility"},enemySpawnRule:{spawnMode:"farthest"}},
  { code: '02086', scope: 'enemy', enemySpawnRule: { spawnMode: 'mostClues' } },
  { code: '02224', scope: 'enemy', enemySpawnRule: { spawnMode: 'empty' } },
  { code: '02183', scope: 'enemy', enemySpawnRule: { spawnMode: 'nextTrain' } },
  { code: '02294', scope: 'enemy', enemySpawnRule: { spawnMode: 'original', spawnFrom: '02282' } },
  { code: '02295', scope: 'enemy', enemySpawnRule: { spawnMode: 'nearestAltered' } },
  { code: '02329', scope: 'enemy', enemySpawnRule: { spawnMode: 'extradimensional' } },
  { code: '02330', scope: 'enemy', enemySpawnRule: { spawnMode: 'original', spawnFrom: '02320' } },
  // 第 7 批：课外活动（敦威治第一章）的幕/密谋/地点/敌人脚本从 behavior.js 搬来。
  {
    code: '02045', scope: 'act',
    actRule: { onReveal(state, act, api) { state.encounterDeck.push('02060'); api.shuffleDiscard() } },
  },
  {
    code: '02046', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.place('alchemyLabs')
        if (state.agendaIndex < 2 && !state.enemies.some(enemy => enemy.code === '02058')) api.spawn('02058', 'alchemyLabs')
        const done = state.campaign.scenarioResults?.some(result => result.scenarioId === 'theHouseAlwaysWins')
        if (done) {
          state.scenarioZones.underLocations ||= {}
          state.scenarioZones.underLocations.alchemyLabs = '02059'
        } else if (!state.scenarioZones.removed?.includes('02059')) {
          state.scenarioZones.removed ||= []
          state.scenarioZones.removed.push('02059')
          state.scenarioZones.concoctionClaimed = true
        }
      },
    },
  },
  { code: '02047', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r3') } } },
  {
    code: '02042', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          if (inv.discard.length >= 5) api.horror(inv.seat, inv.discard.length >= 10 ? 2 : 1)
        }
        const done = state.campaign.scenarioResults?.some(result => result.scenarioId === 'theHouseAlwaysWins')
        if (done) state.scenarioFlags.advanceDirectlyToAgenda = '02043'
      },
    },
  },
  {
    code: '02044', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.horror(inv.seat, 3)
        api.finish('r4')
      },
    },
  },
  {
    code: '02049', scope: 'location',
    locationRule: { onTurnEnd(state, loc, api, inv) { api.discardTop(inv.seat, inv.horror) } },
  },
  {
    code: '02053', scope: 'location',
    locationRule: { onTurnEnd(state, loc, api, inv) { api.discardTop(inv.seat, 1) } },
  },
  {
    code: '02056', scope: 'location',
    locationRule: {
      onTestFail(state, loc, api, inv, result) {
        if (result.skill === 'willpower') api.damage(inv.seat, 1)
      },
    },
  },
  // 第 7 批：俱乐部 Always Wins（敦威治第二章）的幕/密谋脚本。
  {
    code: '02066', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.place('darkenedHall')
        if (state.agendaIndex !== 0) return
        const code = api.discardUntilEnemy(state.currentSeat ?? state.campaign.leadSeat,
          def => (def.traits || []).some(trait => String(trait).toLowerCase() === 'criminal'))
        if (code) api.spawn(code, 'darkenedHall')
      },
    },
  },
  {
    code: '02067', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const university = state.campaign.scenarioResults?.some(result => result.scenarioId === 'extracurricularActivity')
        if (university) {
          api.storyAsset('02079', 'cloverClubBar')
          for (const pile of [state.encounterDeck, state.scenarioZones.clubAside || []]) {
            const index = pile.findIndex(code => ALL_CARDS[code]?.encounterCode === 'hideous_abominations'
              && ALL_CARDS[code]?.type === 'enemy')
            if (index < 0) continue
            api.spawn(pile.splice(index, 1)[0], 'cloverClubBar')
            break
          }
          state.acts.splice(2, 1)
        } else {
          api.storyAsset('02080', 'vipArea')
          state.acts.splice(3, 1)
        }
      },
    },
  },
  { code: '02068', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } },
  { code: '02069', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } },
  {
    code: '02063', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const enemy of state.enemies) {
          if (enemy.traits?.some(trait => trait.toLowerCase() === 'criminal')) enemy.aloof = false
        }
        api.shuffleDiscard()
        if (state.campaign.scenarioResults?.some(result => result.scenarioId === 'extracurricularActivity')) {
          state.scenarioFlags.advanceDirectlyToAgenda = '02064'
        }
      },
    },
  },
  {
    code: '02064', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const aside = state.scenarioZones.clubAside || []
        const candidates = aside.filter(code => ALL_CARDS[code]?.encounterCode === 'hideous_abominations'
          && ALL_CARDS[code]?.type === 'enemy')
        if (candidates.length) {
          const code = candidates[Math.floor(api.random() * candidates.length)]
          aside.splice(aside.indexOf(code), 1)
          api.spawn(code, 'cloverClubLounge')
        }
        state.encounterDeck.push(...aside.splice(0))
        api.shuffleDiscard()
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.location === 'laBellaLuna')) {
          inv.location = 'cloverClubLounge'
        }
        for (const enemy of state.enemies.filter(item => item.location === 'laBellaLuna')) enemy.location = 'cloverClubLounge'
        api.remove('laBellaLuna')
      },
    },
  },
  { code: '02065', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r4') } } },
  // 第 7 批：卡尔克萨第一章「谢幕」的幕/密谋脚本。
  {
    code: '03046', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const pool = [...state.scenarioFlags.lobbyDoorways, ...state.scenarioFlags.backstageDoorways]
        const id = pool.length ? pool[Math.min(pool.length - 1, Math.floor(api.random() * pool.length))] : null
        if (!id) throw new Error('没有可用于生成苍白面具下的男子的放在一边地点')
        for (const key of ['lobbyDoorways', 'backstageDoorways']) {
          const index = state.scenarioFlags[key].indexOf(id)
          if (index >= 0) state.scenarioFlags[key].splice(index, 1)
        }
        api.place(id)
        api.spawn('03059', id)
      },
    },
  },
  { code: '03048', scope: 'act', actRule: { onReveal(state) { state.scenarioFlags.hazardTests = {} } } },
  {
    code: '03044', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const victory = state.victoryDisplay.findIndex(card => (card.originalCode || card.code) === '03060')
        if (victory >= 0) state.victoryDisplay.splice(victory, 1)
        if (!state.enemies.some(enemy => enemy.code === '03060')) api.spawn('03060', 'theatre')
      },
    },
  },
  {
    code: '03045', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.horror(inv.seat, 100)
        if (state.status === 'playing') api.finish('noResolution')
      },
    },
  },
  // 第 7 批：卡尔克萨「苍白面具」的幕/密谋脚本。
  {
    code: '03243', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const tomb = state.locations.find(location => location.originalCode === '03257')
        if (!tomb) throw new Error('暗影坟墓尚未进入游戏')
        state.scenarioFlags.tombLocationId = tomb.id
        api.spawn('03059', tomb.id)
        const records = state.campaign.records ||= {}
        if (!(records.vipsSlain || []).includes('03067')) api.spawn('03067b', state.scenarioFlags.startLocationId)
      },
    },
  },
  {
    code: '03244', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const defeated = state.scenarioFlags.actTwoAdvancedWith === 'defeat'
        const records = state.campaign.records ||= {}
        const key = defeated ? 'conviction' : 'doubt'
        records[key] = Number(records[key] || 0) + 2
        const stranger = state.enemies.find(enemy => enemy.code === '03059')
        if (stranger) {
          state.enemies.splice(state.enemies.indexOf(stranger), 1)
          state.scenarioZones.removed.push('03059')
        }
        const nextCode = defeated ? '03245' : '03246'
        state.acts = [
          ...state.acts.slice(0, 2),
          structuredClone(state.scenario.acts.find(card => card.originalCode === nextCode)),
        ]
      },
    },
  },
  { code: '03245', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } },
  { code: '03246', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r2') } } },
  {
    code: '03241', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { api.spawn('03241b', state.scenarioFlags.startLocationId) } },
  },
  {
    code: '03242', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.trauma(inv.seat, 'physical', 1)
          api.defeat(inv, 'physical')
        }
      },
    },
  },
  // 第 7 批：卡尔科萨「真相幻影」的幕/密谋脚本。
  {
    code: '03204', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const code = act.originalCode
        const withClues = state.scenarioFlags.actOneAdvancedWith !== 'doom'
        const convictionRoute = code === '03205'
        const leadLocation = state.investigators[state.campaign.leadSeat]?.location
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const distances = state.locations.map(location => ({
          id: location.id,
          score: Math.min(...active.map(inv => api.locationDistance(location.id, [inv.location])).filter(value => value >= 0)),
        }))
        const maximum = Math.max(...distances.map(item => item.score))
        const farthest = distances.filter(item => item.score === maximum)
        const far = farthest.length === 1 ? farthest[0].id : api.choose({
          kind: 'location', source: code, seat: state.campaign.leadSeat,
          prompt: '选择离所有调查员最远的地点生成风琴手。',
          options: farthest.map(item => ({ id: item.id, label: api.locationName(item.id) })),
        })
        if (!withClues) for (const inv of active) api.horror(inv.seat, 2)
        if ((convictionRoute && withClues) || (!convictionRoute && !withClues)) {
          api.spawn(state.scenarioFlags.organistCode, far)
        } else {
          api.spawn(state.scenarioFlags.organistCode, leadLocation)
        }
      },
    },
  },
  {
    code: '03205', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const code = act.originalCode
        const withClues = state.scenarioFlags.actOneAdvancedWith !== 'doom'
        const convictionRoute = code === '03205'
        const leadLocation = state.investigators[state.campaign.leadSeat]?.location
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const distances = state.locations.map(location => ({
          id: location.id,
          score: Math.min(...active.map(inv => api.locationDistance(location.id, [inv.location])).filter(value => value >= 0)),
        }))
        const maximum = Math.max(...distances.map(item => item.score))
        const farthest = distances.filter(item => item.score === maximum)
        const far = farthest.length === 1 ? farthest[0].id : api.choose({
          kind: 'location', source: code, seat: state.campaign.leadSeat,
          prompt: '选择离所有调查员最远的地点生成风琴手。',
          options: farthest.map(item => ({ id: item.id, label: api.locationName(item.id) })),
        })
        if (!withClues) for (const inv of active) api.horror(inv.seat, 2)
        if ((convictionRoute && withClues) || (!convictionRoute && !withClues)) {
          api.spawn(state.scenarioFlags.organistCode, far)
        } else {
          api.spawn(state.scenarioFlags.organistCode, leadLocation)
        }
      },
    },
  },
  {
    code: '03206', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.finish(state.campaign.records?.youIntrudedOnASecretMeeting ? 'r2' : 'r1')
      },
    },
  },
  {
    code: '03207', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.finish(state.campaign.records?.youIntrudedOnASecretMeeting ? 'r2' : 'r1')
      },
    },
  },
  {
    code: '03201', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          for (const enemy of state.enemies.filter(candidate => candidate.engagedSeat === inv.seat)) enemy.engagedSeat = null
          const location = state.locations.find(candidate => candidate.id === inv.location)
          const choices = (location?.connections || []).filter(id => state.locations.some(candidate => candidate.id === id))
          if (!choices.length) continue
          const answer = api.choose({
            kind: 'location', source: agenda.originalCode, seat: inv.seat, canSkip: true,
            prompt: '拂晓：你可以移动到一个连接地点。',
            options: [{ id: 'skip', label: '留在原地' }, ...choices.map(id => ({ id, label: api.locationName(id) }))],
          })
          if (answer !== 'skip') api.moveInvestigator(inv.seat, answer)
        }
        moveOrganistAway(state, api)
      },
    },
  },
  {
    code: '03202', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          for (const enemy of state.enemies.filter(candidate => candidate.engagedSeat === inv.seat)) enemy.engagedSeat = null
          const location = state.locations.find(candidate => candidate.id === inv.location)
          const choices = (location?.connections || []).filter(id => state.locations.some(candidate => candidate.id === id))
          if (!choices.length) continue
          const answer = api.choose({
            kind: 'location', source: agenda.originalCode, seat: inv.seat, canSkip: true,
            prompt: '拂晓：你可以移动到一个连接地点。',
            options: [{ id: 'skip', label: '留在原地' }, ...choices.map(id => ({ id, label: api.locationName(id) }))],
          })
          if (answer !== 'skip') api.moveInvestigator(inv.seat, answer)
        }
        moveOrganistAway(state, api)
        const records = state.campaign.records || {}
        if (!(records.vipsSlain || []).includes('03066') && !state.enemies.some(enemy => enemy.code === '03066b')) {
          api.spawn('03066b', 'montparnasse')
        }
      },
    },
  },
  {
    code: '03203', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const records = state.campaign.records || {}
        if (Number(records.doubt || 0) >= Number(records.conviction || 0)) api.finish('r3')
        else api.advanceAct()
      },
    },
  },
  // 第 7 批：卡尔克萨「不可言说的誓言」的部分幕/密谋脚本。
  { code: '03165', scope: 'act', actRule: { onReveal(state, act, api) { api.spawn('03182b', 'danielsCell') } } },
  {
    code: '03167', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        api.finish(state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3')
      },
    },
  },
  {
    code: '03162', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, null)
        const resigned = state.investigators.some(inv => inv.resigned)
        api.finish(resigned ? (state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3') : 'r1')
      },
    },
  },
  {
    code: '03163', scope: 'act',
    actRule: { onReveal(state, act, api) { chooseKeysInEntry(state, api) } },
  },
  {
    code: '03164', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const atCell = state.investigators.filter(inv => !inv.defeated && !inv.resigned && inv.location === 'danielsCell')
        const seat = atCell.length === 1 ? atCell[0].seat : Number(api.choose({
          kind: 'storyAsset', source: '03182a', seat: state.campaign.leadSeat,
          prompt: '选择一位位于丹尼尔牢房的调查员控制丹尼尔。',
          options: atCell.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        api.giveAsset(seat, '03182a')
        state.encounterDeck.push(...state.scenarioZones.underAct.splice(0))
        api.shuffleDiscard()
      },
    },
  },
  {
    code: '03166', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const underAct = state.scenarioZones.underAct.splice(0)
        const discardedMonsters = state.encounterDiscard.filter(code =>
          state.scenario.enemies[code]?.traits?.includes('Monster')).length
        if (underAct.length + discardedMonsters >= 3) {
          state.encounterDeck.push(...underAct)
          api.shuffleDiscard()
          const index = state.encounterDeck.findLastIndex(code =>
            state.scenario.enemies[code]?.traits?.includes('Monster'))
          if (index >= 0) {
            const monster = state.encounterDeck.splice(index, 1)[0]
            const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
            const lowest = Math.min(...active.map(inv => inv.willpower))
            const candidates = active.filter(inv => inv.willpower === lowest)
            const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
              kind: 'target', source: '03166', seat: state.campaign.leadSeat,
              prompt: '选择一位意志最低的调查员抽取怪物。',
              options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
            }))
            api.spawn(monster, state.investigators[seat].location)
          }
        } else {
          state.encounterDeck.push(...underAct)
          api.shuffleDiscard()
        }
      },
    },
  },
  {
    code: '03160', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        state.encounterDeck.push(...state.scenarioZones.lunatics.splice(0))
        api.shuffleDiscard()
        stashRandomMonsterInEntry(state, api)
      },
    },
  },
  {
    code: '03161', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const monsters = state.scenarioZones.monsters
        if (monsters.length) {
          state.encounterDeck.push(monsters.splice(Math.floor(api.random() * monsters.length), 1)[0])
          api.shuffleEncounterDeck()
        }
        if (!(state.campaign.records.vipsSlain || []).includes('03065')) api.spawn('03065b', 'garden')
      },
    },
  },
  // 第 7 批：卡尔克萨「往事回声」的历史房间 + 幕/密谋脚本。
  { code: '03128', scope: 'location', historicalRoom: true },
  { code: '03129', scope: 'location', historicalRoom: true },
  { code: '03130', scope: 'location', historicalRoom: true },
  { code: '03132', scope: 'location', historicalRoom: true },
  { code: '03133', scope: 'location', historicalRoom: true },
  { code: '03134', scope: 'location', historicalRoom: true },
  { code: '03136', scope: 'location', historicalRoom: true },
  { code: '03137', scope: 'location', historicalRoom: true },
  { code: '03138', scope: 'location', historicalRoom: true },
  {
    code: '03124', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        for (const location of state.locations.filter(candidate => candidate.revealed
          && NON_PLAYER_ABILITY_ENTRIES.some(entry => entry.code === originalOf(candidate) && entry.historicalRoom))) {
          location.clues = Math.max(location.clues || 0, state.numInvestigators)
        }
      },
    },
  },
  {
    code: '03125', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        for (const location of state.locations.filter(candidate => candidate.revealed
          && NON_PLAYER_ABILITY_ENTRIES.some(entry => entry.code === originalOf(candidate) && entry.historicalRoom))) {
          location.clues = Math.max(location.clues || 0, state.numInvestigators)
        }
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        const seat = active.length === 1 ? active[0].seat : Number(api.choose({
          kind: 'storyAsset', source: '03141', seat: state.campaign.leadSeat,
          prompt: '选择一位调查员控制皮博迪先生。',
          options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        api.giveAsset(seat, '03141')
        api.place('hiddenLibrary')
        connectPassagewaysInEntry(state)
      },
    },
  },
  {
    code: '03126', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const answer = api.choose({
          kind: 'story', source: act.id, seat: state.campaign.leadSeat,
          prompt: '如何处置黑玛瑙扣环？',
          options: [{ id: 'r1', label: '拿走它' }, { id: 'r2', label: '留在原处' }],
        })
        api.finish(answer)
      },
    },
  },
  { code: '03121', scope: 'agenda', doomPerInvestigator: true, agendaRule: { onReveal(state, agenda, api) { api.shuffleDiscard() } } },
  {
    code: '03122', scope: 'agenda', doomPerInvestigator: true,
    agendaRule: {
      onReveal(state, agenda, api) {
        api.spawn('03140', 'entryHall')
        const records = state.campaign.records || {}
        if (!(records.vipsSlain || []).includes('03068')) api.spawn('03068b', 'entryHall')
      },
    },
  },
  { code: '03123', scope: 'agenda', doomPerInvestigator: true, agendaRule: { onReveal(state, agenda, api) { api.finish('r4') } } },
  // 第 7 批：卡尔克萨终章「暗淡的卡尔克萨」的幕/密谋脚本。
  {
    code: '03320', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        if (!state.enemies.some(enemy => enemy.code === '03059')) api.spawn('03059', 'palaceOfTheKing')
      },
    },
  },
  {
    code: '03321a', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const man = state.enemies.find(enemy => enemy.code === '03059')
        if (man) api.removeEnemyFromGame(man)
        if (!state.investigators.some(inv => inv.assets.some(asset => asset.code === '03321b'))) {
          api.giveAsset(state.campaign.leadSeat, '03321b', { cannotLeavePlay: true, sanityModifier: -2 })
        }
        api.spawn('03334', 'palaceOfTheKing')
      },
    },
  },
  {
    code: '03322a', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const man = state.enemies.find(enemy => enemy.code === '03059')
        if (man) api.removeEnemyFromGame(man)
        api.spawn('03332', 'palaceOfTheKing')
      },
    },
  },
  {
    code: '03323a', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const man = state.enemies.find(enemy => enemy.code === '03059')
        const location = man?.location || 'palaceOfTheKing'
        if (man) api.removeEnemyFromGame(man)
        api.spawn('03333', location)
      },
    },
  },
  {
    code: '03324', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const defeated = state.scenarioFlags.defeatedHastur
        api.finish(defeated === '03334' ? 'r1' : defeated === '03332' ? 'r2' : 'r3')
      },
    },
  },
  {
    code: '03318', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        if (!state.enemies.some(enemy => enemy.code === '03088')) api.spawn('03088', 'palaceOfTheKing')
        api.shuffleDiscard()
      },
    },
  },
  {
    code: '03319', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        const records = state.campaign.records || {}
        api.finish(Number(records.conviction || 0) >= Number(records.doubt || 0) ? 'r4' : 'r5')
      },
    },
  },
  { code: '02081', scope: 'treachery', implemented: true },
  { code: '02082', scope: 'treachery', implemented: true },
  { code: '02083', scope: 'treachery', implemented: true },
  { code: '02084', scope: 'treachery', implemented: true },
  { code: '02085', scope: 'treachery', implemented: true },
  { code: '02091', scope: 'treachery', implemented: true },
  { code: '02093', scope: 'treachery', implemented: true },
  { code: '02096', scope: 'treachery', implemented: true },
  { code: '02099', scope: 'treachery', implemented: true },
  { code: '02100', scope: 'treachery', implemented: true },
  { code: '02101', scope: 'treachery', implemented: true },
  { code: '01176', scope: 'treachery', implemented: true },
  {
    code: '03085', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      if (inv.horror >= 3) inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
      return false
    },
  },
  {
    code: '03087', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 6, result => {
        if (result.success) return
        const count = Math.max(0, result.difficulty - result.value)
        const revealed = state.encounterDeck.splice(Math.max(0, state.encounterDeck.length - count))
        const byakhee = revealed.find(candidate =>
          ALL_CARDS[originalOf(candidate)]?.traits?.includes('Byakhee'))
        if (byakhee) state.encounterDeck.push(byakhee)
        if (revealed.some(candidate => ALL_CARDS[originalOf(candidate)]?.traits?.includes('Omen'))) {
          api.horror(inv.seat, 1)
        }
        state.encounterDeck.push(...revealed.filter(candidate => candidate !== byakhee))
        api.shuffleEncounterDeck()
      })
      return true
    },
  },
  {
    code: '03090', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) return
        const deficit = Math.max(1, result.difficulty - result.value)
        const choice = api.choose({
          kind: 'encounter', source: '03090', seat: inv.seat,
          prompt: '黑星升起：选择在当前议程放置 1 毁灭，或承受等同失败差值的恐惧。',
          options: [{ id: 'doom', label: '在当前议程放置 1 毁灭' },
            { id: 'horror', label: `承受 ${deficit} 恐惧` }],
        })
        if (choice === 'doom') state.doom++
        else api.horror(inv.seat, deficit)
      })
      return false
    },
  },
  {
    code: '03091', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api, { location }) {
      location.doom = (location.doom || 0) + 2
      location.attachments ||= []
      location.attachments.push({
        id: `spires:${state.round}:${state.moveCount}:${location.attachments.length}`,
        code: '03091', originalCode: '03091',
      })
      return true
    },
  },
  {
    code: '03092', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const doom = state.doom + state.locations.reduce((sum, location) => sum + (location.doom || 0), 0)
        + state.enemies.reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
      if (!doom) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.test(inv.seat, 'willpower', doom, result => {
        if (!result.success) api.discardRandom(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '03094', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api, { location }) {
      location.attachments ||= []
      location.attachments.push({
        id: `torment:${state.round}:${state.moveCount}:${location.attachments.length}`,
        code: '03094', originalCode: '03094',
      })
      location.haunted = true
      return true
    },
  },
  {
    code: '03097', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const possessed = state.enemies.filter(enemy => enemy.traits?.includes('Possessed'))
      if (!possessed.length) {
        api.drawEncounter(inv.seat)
        return false
      }
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const enemy = possessed[0]
        enemy.exhausted = false
        api.moveEnemy(enemy, inv.location)
        api.engage(enemy, inv.seat)
        api.attack(enemy, inv)
      })
      return false
    },
  },
  {
    code: '03100', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      let moved = 0
      for (const enemy of state.enemies.filter(enemy => enemy.traits?.includes('Cultist'))) {
        const location = state.locations.find(candidate => candidate.id === enemy.location)
        if (location?.clues) {
          location.clues--
          enemy.clues = (enemy.clues || 0) + 1
          moved++
        }
      }
      state.scenarioFlags ||= {}
      state.scenarioFlags.kingsEdict = moved > 0
      if (!moved) api.drawEncounter(inv.seat)
      return false
    },
  },
  {
    code: '03101', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      state.fogMod = (state.fogMod || 0) + 1
      state.scenarioFlags ||= {}
      state.scenarioFlags.decayRound = state.round
      return true
    },
  },
  { code: '03102', scope: 'treachery', implemented: true },
  {
    code: '03104', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const stranger = state.enemies.some(enemy => originalOf(enemy) === '03059')
      api.test(inv.seat, 'willpower', stranger ? 4 : 2, result => {
        if (!result.success) (stranger ? api.directHorror : api.horror)(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '03105', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const stranger = state.enemies.find(enemy => originalOf(enemy) === '03059')
      if (stranger) {
        for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.attack(stranger, target)
        }
      } else {
        state.scenarioFlags ||= {}
        state.scenarioFlags.drawPallidMask = true
      }
      return false
    },
  },
  { code: '03224', scope: 'treachery', implemented: true },
  {
    code: '03260', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const amount = Math.max(0, result.difficulty - result.value)
        const recipients = [{ id: `inv:${inv.seat}`, kind: 'investigator', name: inv.name,
          capacity: Math.max(0, (inv.maxSanity || 0) - inv.horror), assigned: 0 },
        ...inv.assets.flatMap(asset => {
          const sanity = ALL_CARDS[asset.code]?.sanity || 0
          return sanity > (asset.horror || 0) ? [{ id: `asset:${asset.id}`, kind: 'asset',
            assetId: asset.id, name: ALL_CARDS[asset.code]?.nameZh || asset.code,
            capacity: sanity - (asset.horror || 0), assigned: 0 }] : []
        })]
        for (let point = 0; point < amount; point++) {
          const available = recipients.filter(recipient => recipient.assigned < recipient.capacity)
          if (!available.length) break
          const minimum = Math.min(...available.map(recipient => recipient.assigned))
          const even = available.filter(recipient => recipient.assigned === minimum)
          const picked = chooseEntryOption(api, {
            kind: 'horror', source: '03260', seat: inv.seat,
            prompt: `墙中之眼：分配第${point + 1}/${amount}点恐惧（必须尽量平均）。`,
          }, even, recipient => `${recipient.name}（已分配${recipient.assigned}）`)
          picked.assigned++
        }
        for (const recipient of recipients.filter(candidate => candidate.assigned)) {
          if (recipient.kind === 'investigator') api.horror(inv.seat, recipient.assigned)
          else api.horrorAsset(inv.seat, recipient.assetId, recipient.assigned)
        }
      })
      return false
    },
  },
  {
    code: '03261', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      if ((inv.threat || []).some(threat => originalOf(threat) === '03261')) return false
      api.threat(inv.seat, '03261')
      return true
    },
  },
  {
    code: '03262', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api, { location }) {
      location.attachments ||= []
      if (location.attachments.some(attachment =>
        originalOf(typeof attachment === 'string' ? { code: attachment } : attachment) === '03262')) {
        api.drawEncounter(inv.seat)
        return false
      }
      location.attachments.push({ id: `pit:${state.round}:${state.moveCount}`, code: '03262', originalCode: '03262' })
      location.shroudMod = (location.shroudMod || 0) + 1
      return true
    },
  },
  {
    code: '03302', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const deck = state.scenarioFlags?.agendaDecks?.a
      const amount = state.scenarioFlags?.openPath || state.actIndex >= 2
        ? 3 : Math.min(3, Number(deck?.index || 0) + 1)
      api.test(inv.seat, 'agility', 3, result => {
        if (result.success) return
        api.damage(inv.seat, amount)
        api.loseActions(inv.seat, amount)
      })
      return false
    },
  },
  {
    code: '03303', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const deck = state.scenarioFlags?.agendaDecks?.c
      const amount = state.scenarioFlags?.openPath || state.actIndex >= 2
        ? 3 : Math.min(3, Number(deck?.index || 0) + 1)
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        api.horror(inv.seat, amount)
        api.discardChosen(inv.seat, amount, '03303')
      })
      return false
    },
  },
  {
    code: '03337', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const sanity = Math.max(0, (inv.maxSanity || 0)
        + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
      api.test(inv.seat, 'willpower', Math.max(0, sanity - inv.horror) === 0 ? 5 : 3, result => {
        if (!result.success) api.damage(inv.seat, inv.horror > 2 * sanity ? 4 : 2)
      })
      return false
    },
  },
  { code: '03338', scope: 'treachery', implemented: true },
  {
    code: '03339', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
    encounterResolve(state, inv, card, api) {
      const sanity = Math.max(0, (inv.maxSanity || 0)
        + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
      if (inv.horror >= sanity) api.addDoom(2)
      return false
    },
  },
  {
    code: '03093', scope: 'enemy', implemented: true,
    enemyScript: {
      onDamageAllowed(state, enemy, source, seat) {
        if (source === 'encounter') return true
        const inv = state.investigators[seat]
        const sourceCard = inv?.assets.find(asset => asset.id === source)
        const list = (ALL_CARDS[originalOf(sourceCard)]?.traits || sourceCard?.traits || [])
          .map(trait => String(trait).toLowerCase())
        return list.some(trait => ['spell', 'relic'].includes(trait))
      },
    },
  },
  {
    code: '03095', scope: 'enemy', implemented: true,
    enemyScript: {
      onEngage(state, enemy, inv, api) {
        api.damage(inv.seat, 1)
        api.damageEnemy(enemy.id, 1, inv.seat, 'encounter')
      },
    },
  },
  {
    code: '03098', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback, seat, api) {
        const revealed = state.locations.filter(location => location.revealed)
        if (!revealed.length) return null
        const most = Math.max(...revealed.map(location => location.clues || 0))
        return chooseEntryOption(api, {
          kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
          prompt: '选择线索最多的已揭示地点生成狂徒。',
        }, revealed.filter(location => (location.clues || 0) === most))?.id || null
      },
      onSpawn(state, enemy, api) {
        const location = state.locations.find(candidate => candidate.id === enemy.location)
        if (location?.clues > 0) {
          location.clues--
          enemy.clues = (enemy.clues || 0) + 1
        }
      },
      onDefeated(state, enemy, api) {
        if (!enemy.clues) return false
        const inv = state.investigators[enemy.defeatedBy]
        if (inv) api.gainClues(inv.seat, enemy.clues)
        enemy.clues = 0
        return false
      },
    },
  },
  {
    code: '03258', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback, seat, api) {
        const origin = state.investigators[seat]?.location || fallback
        const unrevealed = state.locations.filter(location => !location.revealed)
        if (!unrevealed.length) return null
        const nearest = Math.min(...unrevealed.map(location => entryDistance(state, origin, location.id)))
        return chooseEntryOption(api, {
          kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
          prompt: '选择最近的未揭示地点生成地下墓穴讲师。',
        }, unrevealed.filter(location => entryDistance(state, origin, location.id) === nearest))?.id || null
      },
    },
  },
  {
    code: '03259', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback, seat, api) {
        const humanoids = state.enemies.filter(enemy => (ALL_CARDS[originalOf(enemy)]?.traits || enemy.traits || [])
          .map(trait => String(trait).toLowerCase()).includes('humanoid'))
        const target = chooseEntryOption(api, {
          kind: 'enemy', source: code, seat: seat ?? state.campaign.leadSeat,
          prompt: '选择弃掉的一名类人生物敌人。',
        }, humanoids)
        if (!target) return null
        const location = target.location
        api.discardEnemy(target)
        return location
      },
      onSpawnFailed(state, code, seat, api) {
        if (seat != null) api.drawEncounter(seat)
      },
    },
  },
  {
    code: '03335', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback) {
        return state.locations.some(location => location.id === 'depthsOfDemhe') ? 'depthsOfDemhe' : fallback
      },
      onLocationWillFlip(state, enemy, location, api) {
        if (enemy.exhausted) return
        const origin = state.locations.find(candidate => candidate.id === enemy.location)
        if (enemy.location === location.id || origin?.connections?.includes(location.id)) {
          for (const inv of state.investigators.filter(candidate => !candidate.defeated && !candidate.resigned
            && candidate.location === location.id)) api.attack(enemy, inv)
        }
      },
    },
  },
  {
    code: '03336', scope: 'enemy', implemented: true,
    enemyScript: {
      onSpawnLocation(state, code, fallback) {
        return state.locations.some(location => location.id === 'bleakPlains') ? 'bleakPlains' : fallback
      },
      onLocationFlipped(state, enemy, location, api) {
        if (!enemy.exhausted && enemy.engagedSeat == null && enemy.location !== location.id) {
          const next = api.stepToward(enemy.location, location.id)
          if (next) api.moveEnemy(enemy, next)
        }
      },
    },
  },
  {
    code: '01163', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - result.value)
        if (failedBy > 0) api.horror(inv.seat, failedBy)
      })
      return false
    },
  },
  {
    code: '01166', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.addDoom(1)
      api.info?.('🕯️ 远古恶魔：在当前密谋上放置 1 点毁灭。')
      return false
    },
  },
  {
    code: '01167', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 4, result => {
        if (result.success) return
        const assets = (inv.assets || []).filter(asset => !asset.isStoryAsset)
        if (!assets.length) { api.damage(inv.seat, 2); return }
        const answer = assets.length === 1 ? assets[0].id : api.choose({
          kind: 'asset', source: '01167', seat: inv.seat,
          prompt: '地窖寒风：选择并弃掉 1 个你控制的支援。',
          options: assets.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
        })
        api.discardAsset(inv.seat, (assets.find(asset => asset.id === answer) || assets[0]).id)
      })
      return false
    },
  },
  {
    code: '01168', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api, { location }) {
      if (!location) return false
      location.fog = (location.fog || 0) + 1
      location.fogCode = '01168'
      location.shroudMod = (location.shroudMod || 0) + 2
      api.info?.(`🌫️ 朦胧之雾附着于「${location.name}」：隐藏值 +2（共 ${location.fog} 张）。`)
      return true
    },
  },
  {
    code: '01171', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const cultists = state.enemies.filter(enemy => hasTrait(enemy, 'Cultist'))
      const target = [...cultists].sort((left, right) =>
        entryDistance(state, inv.location, left.location) - entryDistance(state, inv.location, right.location))[0]
      if (target) {
        target.doom = (target.doom || 0) + 2
        api.info?.(`🌑 「${target.name}」上放置 2 点毁灭（当前 ${target.doom}）。`)
        return false
      }
      const isCultist = code => {
        const data = ALL_CARDS[code]
        return data?.type === 'enemy' && (data.traits || []).some(trait => String(trait).toLowerCase() === 'cultist')
      }
      let found = null
      const fromDiscard = state.encounterDiscard.findIndex(isCultist)
      if (fromDiscard >= 0) found = state.encounterDiscard.splice(fromDiscard, 1)[0]
      else {
        const fromDeck = state.encounterDeck.findIndex(isCultist)
        if (fromDeck >= 0) found = state.encounterDeck.splice(fromDeck, 1)[0]
      }
      if (found) {
        for (let index = state.encounterDeck.length - 1; index > 0; index--) {
          const swap = Math.floor((api.random?.() ?? 0) * (index + 1))
          ;[state.encounterDeck[index], state.encounterDeck[swap]] = [state.encounterDeck[swap], state.encounterDeck[index]]
        }
        api.spawn(found, inv.location)
        api.info?.('🔍 神秘咏唱：从遭遇牌堆／弃牌堆找到了一个异教徒。')
      }
      return false
    },
  },
  {
    code: '01173', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 4, result => {
        if (result.success) return
        api.damage(inv.seat, 1)
        api.horror(inv.seat, 1)
        for (const enemy of state.enemies.filter(entry => entry.engagedSeat === inv.seat && !hasTrait(entry, 'Nightgaunt'))) {
          enemy.engagedSeat = null
          const engaged = state.investigators[inv.seat].engaged
          const index = engaged.indexOf(enemy.id)
          if (index >= 0) engaged.splice(index, 1)
        }
        const central = state.locations.find(entry => entry.central)
        if (central && central.id !== inv.location) api.moveInvestigator(inv.seat, central.id)
        else api.info?.('没有可退往的中心地点。')
      })
      return false
    },
  },
  { code: '01174', scope: 'treachery', implemented: true },
  { code: '01178', scope: 'treachery', implemented: true },
  {
    code: '04076', scope: 'treachery', implemented: true,
    threatAction: { rule: 'clearOvergrowth', label: '清除疯狂生长', skills: ['combat', 'intellect'], difficulty: 4, target: 'location', skillLabels: { combat: '检定战斗(4)清除疯狂生长', intellect: '检定智识(4)清除疯狂生长' } },
    encounterResolve(state, inv, card, api, { location }) {
      if (!location) return false
      if ((location.attachments || []).some(item => originalOf(item) === '04076')) {
        api.drawEncounter(inv.seat)
        return false
      }
      location.attachments ||= []
      location.attachments.push({ id: `overgrowth:${state.round}:${location.id}`, code: '04076', originalCode: '04076' })
      api.info?.('疯狂生长附属到此地点：此处不能探索。')
      return true
    },
  },
  {
    code: '04080', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'agility', 3, result => {
        if (result.success) return
        const allies = inv.assets.filter(asset => hasTrait(asset, 'Ally'))
        const options = [{ id: 'damage', label: '受到 1 点直接伤害（若未中毒则中毒）' }]
        if (allies.length) options.unshift({ id: 'ally', label: '对一个盟友支援造成 5 点伤害' })
        const answer = api.choose({
          kind: 'harm', source: '04080', seat: inv.seat,
          prompt: '毒蛇噬咬：选择承受 5 点盟友伤害，或 1 点直接伤害（并可能中毒）。',
          options,
        })
        if (answer === 'ally' && allies.length) {
          const allyId = api.choose({
            kind: 'asset', source: '04080', seat: inv.seat,
            prompt: '选择受到 5 点伤害的盟友支援。',
            options: allies.map(asset => ({ id: asset.id, label: ALL_CARDS[originalOf(asset)]?.nameZh || asset.name || asset.code })),
          })
          const target = allies.find(asset => asset.id === allyId) || allies[0]
          api.damageAsset(inv.seat, target.id, 5)
          return
        }
        api.directDamage(inv.seat, 1)
        const poisoned = (inv.threat || []).some(item => originalOf(item) === '04102') || inv.poisoned === true
        if (!poisoned) api.poison(inv.seat)
      })
      return false
    },
  },
  {
    code: '04081', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - result.value)
        for (let index = 0; index < failedBy; index++) api.horror(inv.seat, 1)
        if (!(inv.threat || []).some(item => originalOf(item) === '04081')) {
          api.threat(inv.seat, '04081', { forcedEndTurnDiscard: true })
        }
      })
      return false
    },
  },
  {
    code: '04082', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const answer = api.choose({
        kind: 'team', source: '04082', seat: inv.seat, peril: true,
        prompt: '补给短缺：全队选择一项。',
        options: [
          { id: 'resources', label: '每位调查员失去 2 资源' },
          { id: 'damage', label: '每位调查员受到 1 点伤害' },
          { id: 'asset', label: '每位调查员弃掉自己控制的一个支援' },
        ],
      })
      for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        if (answer === 'resources') target.resources = Math.max(0, (target.resources || 0) - 2)
        else if (answer === 'damage') api.damage(target.seat, 1)
        else if (target.assets.length) {
          const picked = api.choose({
            kind: 'asset', source: '04082', seat: target.seat,
            prompt: `${target.name}：选择弃掉自己控制的一个支援。`,
            options: target.assets.map(asset => ({ id: asset.id, label: ALL_CARDS[originalOf(asset)]?.nameZh || asset.name || asset.code })),
          })
          const chosen = target.assets.find(asset => asset.id === picked) || target.assets[0]
          api.discardAsset(target.seat, chosen.id)
        }
      }
      return false
    },
  },
  {
    code: '04087', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const harm = seat => {
        const target = state.investigators[seat]
        const allies = target.assets.filter(asset => hasTrait(asset, 'Ally')).length
        api.damage(seat, 1 + allies)
      }
      harm(inv.seat)
      for (const other of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        if (other.seat === inv.seat) continue
        const here = state.locations.find(location => location.id === other.location)
        if (hasTrait(here, 'Ancient')) harm(other.seat)
      }
      return false
    },
  },
  {
    code: '04088', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api, { location }) {
      api.test(inv.seat, 'agility', 2 + (location?.doom || 0), result => {
        if (!result.success) api.damage(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '04090', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) return
        const failedBy = Math.max(0, 3 - result.value)
        for (let index = 0; index < failedBy; index++) {
          if ((inv.actionsLeft || 0) <= 0) {
            api.horror(inv.seat, 1)
            continue
          }
          const answer = api.choose({
            kind: 'harm', source: '04090', seat: inv.seat,
            prompt: `时间裂缝：第 ${index + 1}/${failedBy} 点差额，选择失去 1 个行动或受到 1 点恐惧。`,
            options: [{ id: 'action', label: '失去 1 个行动' }, { id: 'horror', label: '受到 1 点恐惧' }],
          })
          if (answer === 'horror') api.horror(inv.seat, 1)
          else api.loseActions(inv.seat, 1)
        }
      })
      return false
    },
  },
  {
    code: '04091', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const candidates = inv.assets.filter(asset => !asset.isStoryAsset)
      if (candidates.length) {
        const picked = candidates.length === 1 ? candidates[0] : (candidates.find(asset =>
          asset.id === api.choose({
            kind: 'asset', source: '04091', seat: inv.seat,
            prompt: '困于时间：选择一张非剧情支援洗回牌库。',
            options: candidates.map(asset => ({ id: asset.id, label: asset.name || asset.id })),
          })) || candidates[0])
        const damage = picked.damage || 0
        const horror = picked.horror || 0
        api.shuffleAssetIntoDeck(inv.seat, picked.id)
        if (damage) api.directDamage(inv.seat, damage)
        if (horror) api.directHorror(inv.seat, horror)
        return false
      }
      api.discardChosen(inv.seat, 3, '04091')
      return false
    },
  },
  {
    code: '04092', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const alive = state.investigators.filter(item => !item.defeated && !item.resigned)
      const candidates = state.locations.filter(entry => alive.some(target => target.location === entry.id))
      if (!candidates.length) {
        state.doom = (state.doom || 0) + 1
        return false
      }
      const picked = candidates.length === 1 ? candidates[0] : (candidates.find(entry =>
        entry.id === api.choose({
          kind: 'location', source: '04092', seat: inv.seat, peril: true,
          prompt: '不祥之兆：选择放置 1 点毁灭的地点。',
          options: candidates.map(entry => ({ id: entry.id, label: entry.name })),
        })) || candidates[0])
      picked.doom = (picked.doom || 0) + 1
      for (const target of alive.filter(entry => entry.location === picked.id)) api.horror(target.seat, 1)
      return false
    },
  },
  {
    code: '04093', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api, { location }) {
      const answer = api.choose({
        kind: 'harm', source: '04093', seat: inv.seat, peril: true,
        prompt: '先祖恐惧：在你所在地点放置 1 点毁灭并弃掉本卡，或把本卡放进胜利区。',
        options: [{ id: 'doom', label: '在所在地点放置 1 点毁灭' }, { id: 'victory', label: '放进胜利区' }],
      })
      if (answer === 'victory') {
        state.victoryDisplay.push({ id: `ancestral-fear:${state.round}:${inv.seat}`,
          code: '04093', originalCode: '04093', victory: 0, vengeance: 1 })
        return false
      }
      if (location) location.doom = (location.doom || 0) + 1
      else state.doom = (state.doom || 0) + 1
      return false
    },
  },
  {
    code: '04096', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const cultists = state.enemies.filter(enemy => hasTrait(enemy, 'Cultist'))
      if (!cultists.length) {
        api.horror(inv.seat, 1)
        api.drawEncounter(inv.seat)
        return false
      }
      const target = [...cultists].sort((left, right) =>
        entryDistance(state, inv.location, left.location) - entryDistance(state, inv.location, right.location))[0]
      if (target) target.doom = (target.doom || 0) + 1
      api.test(inv.seat, 'willpower', target ? (target.fight || 0) : 3, result => {
        if (!result.success) api.horror(inv.seat, 2)
      })
      return false
    },
  },
  {
    code: '04100', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      const answer = api.choose({
        kind: 'harm', source: '04100', seat: inv.seat,
        prompt: '毒蛇召来：把放在一边的中毒弱点放入威胁区域，或抽取遭遇牌库顶 2 张。',
        options: [{ id: 'poison', label: '让一位调查员中毒' }, { id: 'cards', label: '抽出遭遇牌顶 2 张' }],
      })
      if (answer === 'poison') {
        const candidates = state.investigators.filter(item => !item.defeated && !item.resigned)
        const target = candidates.length === 1 ? candidates[0] : (candidates.find(item =>
          String(item.seat) === String(api.choose({
            kind: 'investigator', source: '04100', seat: inv.seat,
            prompt: '毒蛇召来：选择中毒的调查员。',
            options: candidates.map(item => ({ id: String(item.seat), label: item.name })),
          }))) || candidates[0])
        if (target) api.poison(target.seat)
      } else {
        api.drawEncounter(inv.seat)
        if (!inv.defeated && !inv.resigned) api.drawEncounter(inv.seat)
      }
      return false
    },
  },
  {
    code: '04101', scope: 'treachery', implemented: true,
    encounterResolve(state, inv, card, api) {
      for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        const poisoned = (target.threat || []).some(item => originalOf(item) === '04102') || target.poisoned === true
        if (poisoned) api.damage(target.seat, 1)
      }
      return false
    },
  },
  { code: '04083', scope: 'enemy', implemented: true, enemyStatRule: { fightBonusFromVengeance: true } },
  { code: '04098', scope: 'enemy', implemented: true, enemySpawnRule: { preyPoisoned: true } },
  { code: '01169', scope: 'enemy', enemySpawnRule: { doomOnSpawn: 1 } },
  { code: '02142', scope: 'treachery', implemented: true },
  { code: '02143', scope: 'treachery', implemented: true },
  { code: '02144', scope: 'treachery', implemented: true },
  { code: '02145', scope: 'treachery', implemented: true },
  { code: '02146', scope: 'treachery', implemented: true },
  { code: '02180', scope: 'treachery', implemented: true },
  { code: '02181', scope: 'treachery', implemented: true },
  { code: '02220', scope: 'treachery', implemented: true },
  { code: '02221', scope: 'treachery', implemented: true },
  { code: '02222', scope: 'treachery', implemented: true },
  { code: '02223', scope: 'treachery', implemented: true },
  { code: '02256', scope: 'treachery', implemented: true },
  { code: '02257', scope: 'treachery', implemented: true },
  { code: '02258', scope: 'treachery', implemented: true },
  { code: '02259', scope: 'treachery', implemented: true },
  { code: '02296', scope: 'treachery', implemented: true },
  { code: '02297', scope: 'treachery', implemented: true },
  { code: '02298', scope: 'treachery', implemented: true },
  { code: '02331', scope: 'treachery', implemented: true },
  { code: '02332', scope: 'treachery', implemented: true },
  { code: '02333', scope: 'treachery', implemented: true },
  // 第 7 批：失落时代「埃兹特里覆灭」的简单幕/密谋分支。
  {
    code: '04059', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        const relic = state.relicOfAges
        const bearer = relic?.seat != null ? state.investigators[relic.seat] : null
        api.finish(bearer?.resigned ? 'r1' : 'r3')
      },
    },
  },
  {
    code: '04056', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, 'both')
      },
    },
  },
  {
    code: '04057', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        takeFromSetAsideInEntry(state, '04068')
        const deck = [...(state.explorationDeck || []), 'chamberOfTime']
        if (typeof api.shuffle === 'function') {
          state.explorationDeck = api.shuffle(deck)
        } else {
          const copy = [...deck]
          for (let index = copy.length - 1; index > 0; index--) {
            const target = Math.floor((api.random?.() ?? 0) * (index + 1))
            ;[copy[index], copy[target]] = [copy[target], copy[index]]
          }
          state.explorationDeck = copy
        }
        api.info?.('🧭 「时间石室」洗入探索牌库。')
        const hasChalk = state.investigators
          .filter(inv => !inv.defeated && !inv.resigned)
          .some(inv => api.hasSupply?.(inv.seat, 'chalk'))
        if (hasChalk) {
          api.info?.('✏️ 有人带着粉笔，你们抄下了雕文：本场景移出游戏。')
        } else {
          state.victoryDisplay.push({
            id: 'act:04057', code: '04057', originalCode: '04057',
            victory: 0, vengeance: 1, name: act.name,
          })
          api.info?.('📜 没有粉笔：本场景放进胜利区，并获得复仇 1。')
        }
      },
    },
  },
  {
    code: '04058', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        takeControlOfRelicInEntry(state, api)
        formLocationLineInEntry(state, api)
      },
    },
  },
  {
    code: '04055', scope: 'agenda',
    agendaRule: { onReveal(state, agenda, api) { spawnHarbingerAtDoomInEntry(state, api) } },
  },
  // 第 7 批：失落时代「久远腹地（上）」的简单幕/密谋分支。
  {
    code: '04209', scope: 'act',
    actRule: {
      onReveal(state, act, api) {
        if (!state.enemies.some(enemy => originalOf(enemy) === '04209b')) {
          api.spawn('04209b', 'mouthOfKnyan')
          api.info?.('羽翼蛇族出现在昆扬之口，但它不能被击败。')
        }
      },
    },
  },
  { code: '04210', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } },
  {
    code: '04208', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.resign(inv.seat)
      },
    },
  },
  {
    code: '04207', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        api.shuffleDiscard()
        const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
        if (!active.length) return
        const answer = active.length === 1 ? String(active[0].seat)
          : (typeof api.choose === 'function'
            ? api.choose({
              kind: 'investigator', source: '04207', seat: state.campaign?.leadSeat ?? active[0].seat,
              prompt: '选择一位调查员担任瞭望员。',
              options: active.map(inv => ({ id: String(inv.seat), label: inv.name })),
            })
            : String(active[0].seat))
        const lookout = active.find(inv => String(inv.seat) === String(answer)) || active[0]
        if (api.checkSupplies?.(lookout.seat, 'binoculars')) {
          api.info?.(`${lookout.name} 带着双筒望远镜，避开了逼近的生物。`)
          return
        }
        const enemyCode = api.discardUntilEnemy?.(lookout.seat, () => true)
        if (!enemyCode) {
          api.info?.('遭遇牌库中没有弃出敌人。')
          return
        }
        api.spawn(enemyCode, lookout.location)
        api.info?.(`${lookout.name} 没有双筒望远镜：遭遇到「${api.cardName?.(enemyCode) || enemyCode}」。`)
      },
    },
  },
  // 第 7 批：失落时代「久远腹地（下）」的简单幕/密谋分支。
  {
    code: '04212', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          api.trauma(inv.seat, 'physical', 1)
          api.defeat(inv, null)
        }
      },
    },
  },
  // 第 7 批：卡尔克萨「最后的国王」密谋脚本。
  {
    code: '03062', scope: 'agenda',
    agendaRule: {
      onReveal(state, agenda, api) {
        if (!state.storyAssets?.length) return
        const fewest = Math.min(...state.storyAssets.map(asset => asset.clues || 0))
        const candidates = state.storyAssets.filter(asset => (asset.clues || 0) === fewest)
        const target = candidates.length === 1 ? candidates[0] : candidates.find(asset =>
          (asset.id || asset.code) === api.choose({
            kind: 'target', source: '03062', seat: state.campaign.leadSeat ?? 0,
            prompt: '选择黛安娜·迪瓦恩出现的旁人。',
            options: candidates.map(asset => ({ id: asset.id || asset.code, label: asset.name || asset.id || asset.code })),
          }))
        if (target) api.spawn('03081', target.location)
        api.shuffleDiscard()
      },
    },
  },
  { code: '03063', scope: 'agenda', agendaRule: { onReveal(state, agenda, api) { api.finish('r3') } } },
  // 第 8 批：古代遗物的剧情角色（引擎不再写死 04061）。
  { code: '04061', scope: 'storyAsset', storyRole: 'relicOfAges' },
  // 第 7 批：失落时代地点的复仇点「视同胜利区」条件。
  { code: '04066', scope: 'location', vengeanceWhile: 'enemyHere' },
  { code: '04287', scope: 'location', vengeanceWhile: 'noClues' },
  { code: '04288', scope: 'location', vengeanceWhile: 'investigatorHere' },
]

// 审计/调试：这张卡是不是由本文件声明的非玩家能力卡。
export const NON_PLAYER_ABILITY_CODES = new Set(NON_PLAYER_ABILITY_ENTRIES.map(entry => entry.code))

// 供内容层复用的读点（避免在 behavior.js 里再写一遍「复仇点数」）。
export { originalOf, victoryVengeance }
