// 09081 号令真言（Power Word）· 秘术师事件 · 0 经验 · 定制。
// 卡面：定制。快速。只能在你回合期间打出。附属到你所在地点的非[[精英]]敌人。
//       [action] 如果所附属敌人在你的地点：谈判。对该敌人下命令（每个命令每轮仅限一次）——
//       - “去。”该敌人朝你选择的方向移动一次。- “蹲下。”该敌人横置。
//       定制命令：Betray / Mercy / Confess / Distract（见 customizationOptions）。
//
import { customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'
import { ownTurn } from '../../engine/matcher.js'

const CUSTOM_CHECKS = Object.freeze([
  { name: 'Betray', checks: 1, text: "Add the command: \"- 'Betray.' Deal 1 damage to any enemy at this enemy's location with an equal or lower fight value than this enemy.\"" },
  { name: 'Mercy', checks: 1, text: "Add the command: \"- 'Mercy.' An investigator at this enemy's location heals damage or horror equal to this enemy's respective damage/horror value.\"" },
  { name: 'Confess', checks: 1, text: "Add the command: \"- 'Confess.' Discover 1 clue at this enemy's location if its health is equal to or higher than its location's shroud.\"" },
  { name: 'Distract', checks: 1, text: "Add the command: \"- 'Distract.' Automatically evade any enemy at this enemy's location with an equal or lower evade value than this enemy.\"" },
  { name: 'Greater Control', checks: 2, text: 'Power Word gains "[fast]: Return Power Word to your hand."' },
  { name: 'Bonded', checks: 3, text: 'You may activate the parley ability on Power Word from up to one location away from the attached enemy.' },
  { name: 'Tonguetwister', checks: 3, text: 'When you parley with Power Word, you may give up to two different commands.' },
  { name: 'Thrice Spoken', checks: 3, text: 'You may include three copies of Power Word in your deck. When you give a command using one copy, also give that command to each other enemy with one of your copies of Power Word attached.' },
])

const code = '09081'
const labels = { go: '去', cower: '蹲下', betray: '叛变', mercy: '开恩', confess: '坦白', distract: '引开' }
const unlock = (state, inv, index) => customizationOptionFullyChecked(state, inv.seat, code, index)
const hostOf = (state, source) => state.enemies.find(enemy => enemy.id === source.hostEnemyId
  || enemy.attachments?.includes(source))
const memoryKey = (source, command) => `powerWord:${source.id}:${command}`
const inRange = (state, inv, enemy) => enemy.location === inv.location || (unlock(state, inv, 5)
  && state.locations.find(location => location.id === inv.location)?.connections?.includes(enemy.location))

function candidateCommands(state, inv, enemy, api = null) {
  const loc = state.locations.find(item => item.id === enemy.location)
  const residents = state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.location === enemy.location)
  const local = state.enemies.filter(item => !item.defeated && item.location === enemy.location)
  const fight = item => api ? api.enemyFight(item, inv.seat) : item.fight
  const evade = item => api ? api.enemyEvade(item, inv.seat) : item.evade
  const shroud = api ? api.locationShroud(enemy.location, inv.seat) : loc?.shroud
  const health = api ? api.enemyHealth(enemy) : enemy.health
  const out = new Map()
  const add = (command, targets) => { if (targets.length) out.set(command, targets) }
  add('go', (loc?.connections || []).filter(id => api ? api.canMoveEnemyTo(enemy, id)
    : !enemy.immobile && state.locations.some(destination => destination.id === id && !destination.barricade)))
  if (!enemy.exhausted) add('cower', [enemy])
  if (unlock(state, inv, 0)) add('betray',
    local.filter(item => Number.isFinite(fight(item)) && fight(item) <= fight(enemy)
      && (!api || api.canDamageEnemy(item, inv.seat, { code }))))
  if (unlock(state, inv, 1)) add('mercy', residents.flatMap(owner => [
    ...(enemy.damage > 0 && owner.damage > 0 ? [{ owner, kind: 'damage', amount: enemy.damage }] : []),
    ...(enemy.horror > 0 && owner.horror > 0 ? [{ owner, kind: 'horror', amount: enemy.horror }] : []),
  ]))
  if (unlock(state, inv, 2) && Number.isFinite(health) && health >= shroud && loc?.clues > 0
    && (!api || api.canDiscoverClueAt(inv.seat, enemy.location))) add('confess', [loc])
  if (unlock(state, inv, 3)) add('distract',
    local.filter(item => Number.isFinite(evade(item)) && evade(item) <= evade(enemy)
      && (!api || api.canAutoEvade(item, inv.seat))))
  return out
}

function commandsFor(state, inv, source, api) {
  const words = [{ source, enemy: hostOf(state, source) }]
  if (unlock(state, inv, 7)) {
    for (const host of state.enemies) {
      for (const word of host.attachments || []) {
        if (word.id !== source.id && word.code === code && word.ownerSeat === inv.seat) words.push({ source: word, enemy: host })
      }
    }
  }
  const result = new Map()
  for (const word of words.filter(item => item.enemy)) {
    for (const [command, targets] of candidateCommands(state, inv, word.enemy, api)) {
      if (state.scenarioFlags?.[memoryKey(word.source, command)] === state.round) continue
      if (word.source.id === source.id) result.set(command, [])
      if (result.has(command)) result.get(command).push({ ...word, targets })
    }
  }
  return result
}

const pick = (inv, api, prompt, options) => options.length === 1 ? options[0].id
  : api.choice({ kind: 'target', source: code, seat: inv.seat, prompt, options })

function resolveCommand(inv, api, enemy, command, targets) {
  if (command === 'go') {
    const id = pick(inv, api, '选择敌人移动到哪个地点。',
      targets.map(id => ({ id, label: api.locationName(id) })))
    api.moveEnemy(enemy, id, { cause: 'effect' })
  } else if (command === 'cower') api.exhaustEnemy(enemy)
  else if (command === 'confess') api.discoverClue(inv.seat, 1, enemy.location)
  else if (command === 'mercy') {
    const id = pick(inv, api, '选择接受治疗的调查员及类型。', targets.map(({ owner, kind, amount }, index) => ({
      id: String(index), label: `${owner.name} 治疗 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}`,
    })))
    const target = targets[Number(id)]
    if (target?.kind === 'damage') api.healDamage(target.owner.seat, target.amount)
    else if (target?.kind === 'horror') api.healHorror(target.owner.seat, target.amount)
  } else {
    const id = pick(inv, api, '选择命令影响的敌人。', targets.map(target => ({ id: target.id, label: target.name })))
    const target = targets.find(item => item.id === id)
    if (command === 'betray') api.damageEnemy(target, 1, inv.seat, { code })
    else api.autoEvadeEnemy(target)
  }
}

function parley({ state, inv, source, api }) {
  const issued = new Set()
  const maximum = unlock(state, inv, 6) ? 2 : 1
  for (let count = 0; count < maximum; count++) {
    const commands = commandsFor(state, inv, source, api)
    const options = [...commands.keys()].filter(command => !issued.has(command))
      .map(command => ({ id: command, label: labels[command] }))
    if (!options.length) break
    if (count > 0) options.unshift({ id: 'done', label: '不下达第二条命令' })
    const command = pick(inv, api, '选择一条命令。', options)
    if (!commands.has(command)) break
    issued.add(command)
    const words = commands.get(command).slice()
    while (words.length) {
      const id = pick(inv, api, '选择先接受命令的敌人。', words.map(word => ({ id: word.source.id, label: word.enemy.name })))
      const index = words.findIndex(word => word.source.id === id)
      if (index < 0) break
      const [word] = words.splice(index, 1)
      const targets = candidateCommands(state, inv, word.enemy, api).get(command)
      if (!targets?.length) continue
      api.setScenarioFlag(memoryKey(word.source, command), state.round)
      resolveCommand(inv, api, word.enemy, command, targets)
    }
  }
}

export default {
  code,
  fast: true,
  attachTo: { kind: 'enemy', nonElite: true, atOwnLocation: true },
  assetRule: { enemyAttachmentActions: true },
  customizationOptions: CUSTOM_CHECKS,
  playCondition: [ownTurn()],
  customizationEffects: {
    deckLimit: checks => checks.filter(index => index === 7).length >= CUSTOM_CHECKS[7].checks ? 3 : undefined,
  },
  abilities: [
    {
      kind: 'action', actionKind: 'parley', range: 'anywhere',
      label: '谈判：命令所附属的敌人，每种命令每轮一次',
      cost: { action: true },
      criteria: [({ state, inv, source }) => {
        const host = source.ownerSeat === inv.seat ? hostOf(state, source) : null
        return Boolean(host && inRange(state, inv, host)
          && commandsFor(state, inv, source).size > 0)
      }],
      resolve: parley,
    },
    {
      kind: 'free', actionKind: 'activate', range: 'anywhere',
      label: '深层控制：把号令真言返回手牌',
      criteria: [({ state, inv, source }) => source.ownerSeat === inv.seat && unlock(state, inv, 4)],
      resolve: ({ source, api }) => api.movePlayerAttachment(source, 'hand'),
    },
  ],
  modifiers: [],
}
