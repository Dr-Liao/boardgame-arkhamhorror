// 09101 饱经风霜 · 定制特性按投入该技能牌的座位读取。
import { customizationChoiceValues, customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'
import { ALL_CARDS } from '../cards-data.js'

const SOURCE = '09101'
const NEMESIS = 2
const MYTHOS_HARDENED = 3
const ALWAYS_PREPARED = 4
const ENCOUNTER_TYPES = new Set(['enemy', 'treachery', 'location', 'act', 'agenda', 'scenario', 'story', 'enemy_location'])
const normalizeTrait = trait => trait.trim().toLowerCase()
const unlocked = (state, seat, index) => customizationOptionFullyChecked(state, seat, SOURCE, index)

function matchingTraits(state, seat, traits = []) {
  const actual = new Set(traits.map(normalizeTrait))
  const selected = customizationChoiceValues(state, seat, SOURCE)
  // 已开局的旧存档在下一次局外准备时补录原先没有存储的两项特性。
  return (selected.length ? selected : ['monster', 'humanoid']).filter(trait => actual.has(normalizeTrait(trait))).length
}

function testSubject(state, test) {
  if (!test) return null
  const { source, target } = test
  const enemyId = target?.kind === 'enemy' ? target.id : source?.enemyId ?? (source?.type === 'enemy' ? source.id : null)
  const enemy = enemyId == null ? null : state.enemies.find(item => item.id === enemyId)
  if (enemy) {
    const cards = ALL_CARDS[enemy.originalCode || enemy.code]
    return { type: 'enemy', id: enemy.id, name: enemy.name, traits: [...(enemy.traits || []), ...(cards?.traits || [])] }
  }

  const locationId = target?.kind === 'location' ? target.id : source?.locationId
  const location = locationId == null ? null : state.locations.find(item => item.id === locationId)
  const code = location?.originalCode || location?.code || source?.code
  const currentTreachery = state._treacheryResolving
  const definition = ALL_CARDS[code] || ALL_CARDS[state.scenario?.treacheries?.[code]?.originalCode]
  if (ENCOUNTER_TYPES.has(definition?.type)) return definition
  return ALL_CARDS[currentTreachery] || ALL_CARDS[state.scenario?.treacheries?.[currentTreachery]?.originalCode] || null
}

function resolveSuccess({ state, inv, source, test, api }) {
  const subject = testSubject(state, test)
  if (!subject || !matchingTraits(state, inv.seat, subject.traits)) return
  const nemesis = subject.type === 'enemy' && subject.id && unlocked(state, inv.seat, NEMESIS)
  const mythosHardened = subject.type === 'treachery' && unlocked(state, inv.seat, MYTHOS_HARDENED)
  if (!nemesis && !mythosHardened) return
  const label = nemesis ? `附属到「${subject.name}」` : '将饱经风霜和该诡计加入胜利区'
  const answer = api.choice({ kind: 'skillEffect', source: SOURCE, seat: test.seat, canSkip: true,
    prompt: `饱经风霜：是否${label}？`, options: [{ id: 'skip', label: '跳过' }, { id: 'apply', label }] })
  if (answer !== 'apply') return
  if (nemesis) api.attachCommittedSkillToEnemy(source, subject.id)
  else api.captureTreacheryWithSkill(source, { skillInVictory: true })
}

export default {
  code: SOURCE,
  customizationChoices: { kind: 'encounterTrait', base: 2, options: { 0: 1, 1: 1 } },
  enemyAttachmentTestDifficulty: -1,
  customizationOptions: [
    { name: 'Specialist', checks: 1, text: 'Choose another trait: _____' },
    { name: 'Specialist', checks: 2, text: 'Choose another trait: _____' },
    { name: 'Nemesis', checks: 3, text: 'If this is a skill test on or against an enemy with a chosen trait and the test is successful, you may attach Grizzled to that enemy. Reduce the difficulty of tests on or against the attached enemy by 1.' },
    { name: 'Mythos-Hardened', checks: 4, text: 'If this skill test is on a treachery with a chosen trait and the test is successful, you may add both Grizzled and that treachery to the victory display.' },
    { name: 'Always Prepared', checks: 5, text: 'After you draw an encounter card with a chosen trait, return one copy of Grizzled from your discard pile to your hand. (Max once per round.)' },
  ],
  abilities: [
    {
      kind: 'commit',
      label: '对遭遇卡的检定：每个匹配的所选特性获得双百搭图标',
      skill: {
        iconBonus: ({ state, inv, test }) => matchingTraits(state, inv.seat, testSubject(state, test)?.traits) * 2,
        onSuccessResolve: resolveSuccess,
      },
    },
    {
      kind: 'reaction', trigger: 'encounterDrawn', fromDiscard: true,
      limit: { scope: 'perRound', owner: 'group' },
      label: '时刻准备：从弃牌堆将一张饱经风霜返回手牌',
      criteria: [({ state, inv, context, helpers }) => context.seat === inv.seat
        && unlocked(state, inv.seat, ALWAYS_PREPARED)
        && matchingTraits(state, inv.seat, helpers.cardTraits(context.cardCode)) > 0],
      resolve: ({ inv, api }) => api.moveCard({ from: 'discard', to: 'hand', code: SOURCE }, { seat: inv.seat }),
    },
  ],
  modifiers: [],
}
