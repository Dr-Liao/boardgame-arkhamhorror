// 09061 敏锐直觉（Honed Instinct）· 游荡者（Rogue）事件 · 0 经验 · 定制。
//
// 卡面：定制。快速。只在达成下列条件之一后打出：
//       - 密谋或场景推进。
//       - 你技能检定成功且超过难度 3 点或更多。
//       立刻进行一次行动，如同现在是你的回合。（每轮最多一次。）
// 定制栏：5 个 1 格打出条件 / 2 格 Sharpened Talent / 3 格 Impulse Control /
//         5 格 Force of Habit（逐项见 resolve 与 customizationEffects）。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
import { ALL_CARDS } from '../cards-data.js'
import { customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'

const CODE = '09061'

const OPTIONS = [
  { name: 'Reflex Response', checks: 1, text: 'Add the following play condition: "- You take damage or horror."' },
  { name: 'Situational Awareness', checks: 1, text: 'Add the following play condition: "- A location enters play or is revealed."' },
  { name: 'Killer Instinct', checks: 1, text: 'Add the following play condition: "- An enemy engages you."' },
  { name: 'Gut Reaction', checks: 1, text: 'Add the following play condition: "- A treachery enters your threat area."' },
  { name: 'Muscle Memory', checks: 1, text: 'Add the following play condition: "- You play an asset."' },
  { name: 'Sharpened Talent', checks: 2, text: 'During the action granted by Honed Instinct, you get +2 to each of your skills.' },
  { name: 'Impulse Control', checks: 3, text: 'You may include up to three copies of Honed Instinct in your deck. Honed Instinct gets -1 cost.' },
  { name: 'Force of Habit', checks: 5, text: 'When you play Honed Instinct, you may take 2 actions instead of 1 (one at a time). Then, remove it from the game.' },
]

const checked = (state, seat, index) => customizationOptionFullyChecked(state, seat, CODE, index)
const ROUND_LIMIT = 'honedInstinctUsedRound'
const isPersonal = (inv, context) => context.seat === inv.seat
const qualified = ({ state, inv, context, windowId }) => {
  if (state.scenarioFlags?.[ROUND_LIMIT] === state.round) return false
  switch (context.when || windowId) {
    case 'actAdvanced':
    case 'agendaAdvanced': return true
    case 'skillTestSuccess': return isPersonal(inv, context) && context.successBy >= 3
    case 'damagePlacedOnSelf': return isPersonal(inv, context) && checked(state, inv.seat, 0)
      && (context.damage > 0 || context.horror > 0)
    case 'locationPlaced':
    case 'locationRevealed': return checked(state, inv.seat, 1)
    case 'enemyEngaged': return isPersonal(inv, context) && checked(state, inv.seat, 2)
    case 'threatEntered': return isPersonal(inv, context) && checked(state, inv.seat, 3)
      && ALL_CARDS[context.card?.originalCode || context.cardCode]?.type === 'treachery'
    case 'assetPlayed': return isPersonal(inv, context) && checked(state, inv.seat, 4)
    default: return false
  }
}

function grantedAction({ state, inv, api }) {
  const effect = checked(state, inv.seat, 5) && api.addEffect({
    duration: 'endOfAction', sourceCode: CODE, controllerSeat: inv.seat,
    label: '敏锐直觉：本次授予的行动期间每项技能 +2',
    modifiers: [{ target: 'skill:*', amount: 2 }],
  })
  try {
    return api.beginImmediateAction(inv.seat, { source: CODE })
  } finally {
    if (effect) api.consumeEffect(effect.id)
  }
}

export default {
  code: CODE,
  keepOnPlay: true,
  customizationOptions: OPTIONS,
  customizationEffects: {
    deckLimit: checks => checks.filter(index => index === 6).length >= OPTIONS[6].checks ? 3 : undefined,
    playCost: checks => checks.filter(index => index === 6).length >= OPTIONS[6].checks ? -1 : 0,
  },
  abilities: [
    {
      kind: 'played',
      fast: true,
      range: 'anywhere',
      trigger: ['actAdvanced', 'agendaAdvanced', 'skillTestSuccess', 'damagePlacedOnSelf',
        'locationPlaced', 'locationRevealed', 'enemyEngaged', 'threatEntered', 'assetPlayed'],
      label: '快速：在符合条件的窗口立刻进行一次行动，如同现在是你的回合（每轮一次）',
      criteria: [qualified],
      resolve: ({ state, inv, api }) => {
        api.setScenarioFlag(ROUND_LIMIT, state.round)
        const twoActions = checked(state, inv.seat, 7) && api.hasImmediateAction(inv.seat, { source: CODE })
          && api.choice({
            kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
            prompt: '是否改为立刻进行两次行动，然后移出敏锐直觉？',
            options: [{ id: 'skip', label: '进行一次行动' }, { id: 'act', label: '进行两次行动，然后移出游戏' }],
          }) === 'act'
        grantedAction({ state, inv, api })
        if (twoActions) {
          grantedAction({ state, inv, api })
          api.removeFromGameCards(CODE)
        } else {
          api.putInDiscard(inv.seat, CODE)
        }
      },
    },
  ],
  modifiers: [],
}
