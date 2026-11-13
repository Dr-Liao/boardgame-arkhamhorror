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
// 读点：
//   · 「立刻进行一次行动」→ api.beginImmediateAction（performImmediateAction：选一次行动结算后恢复原座位与行动额度）。
//   · 「每轮最多一次」→ resolve 里用 api.gameFlag / api.setGameFlag 记本轮键（api 提供的调查员级记账）。
//   · 「你技能检定成功且超过难度 3 点」→ state.lastTestResult（B3 的结果契约，含 successBy）。
//   · Impulse Control（-1 费）→ customizationEffects.playCost（tsk-customizable 的费用修正读点）。
// approximation: ①「密谋或场景推进后」目前没有引擎记录（agenda/act 推进不带事后窗口），因此只实现
//   「检定成功超过 3 点」这条条件，见 primitive-requests/09061.json；②5 个 1 格的追加打出条件需要
//   逐条读取勾选状态，playCondition 的 predicate 拿不到 api，见同一份请求；③Sharpened Talent
//   用「本阶段 +2 技能值」的持续效果近似（卡面限定在那次行动内）。
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

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: 只实现「检定成功超过 3 点」的打出条件；幕/密谋推进条件与 5 个追加条件缺读点（primitive-requests/09061.json）。',
  customizationOptions: OPTIONS,
  // Impulse Control（3 格）：费用 -1（读点：tsk-customizable 的 playCost 修正 → modifiers.playCostDelta）。
  customizationEffects: {
    playCost (checked) {
      const count = (checked || []).filter(index => index === 6).length
      return count >= OPTIONS[6].checks ? -1 : 0
    },
  },
  playCondition: [
    {
      when: ({ state, inv }) => Number(state?.lastTestResult?.seat) === inv?.seat
        && Number(state?.lastTestResult?.successBy || 0) >= 3,
      message: '只能在你技能检定成功且超过难度 3 点后（或幕/密谋推进后）打出',
    },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：立刻进行一次行动，如同现在是你的回合（每轮一次）',
      resolve: ({ state, inv, api }) => {
        const roundKey = `honedInstinctUsed:${state.round}`
        if (api.gameFlag(inv.seat, roundKey)) {
          api.info('「敏锐直觉」：每轮最多只能打出一次。')
          return
        }
        api.setGameFlag(inv.seat, roundKey, true)
        const checked = api.tsk.customizable.checked(inv.seat, CODE)
        const fully = index => checked.filter(item => item === index).length >= OPTIONS[index].checks
        if (fully(5)) {
          api.addEffect({
            duration: 'endOfPhase', sourceCode: CODE, controllerSeat: inv.seat,
            label: '「敏锐直觉」：本次行动期间每项技能 +2（近似：本阶段）',
            modifiers: [{ target: 'skill:*', amount: 2 }],
          })
          api.info('🎯 「敏锐直觉」：Sharpened Talent 生效，本次行动期间每项技能 +2。')
        }
        if (fully(7)) {
          api.info('🎯 「敏锐直觉」：Force of Habit 生效，改为进行 2 次行动，然后移出游戏。')
          api.beginImmediateAction(inv.seat, { source: CODE })
          api.beginImmediateAction(inv.seat, { source: CODE })
          api.exileCard(CODE, { seat: inv.seat })
          return
        }
        api.beginImmediateAction(inv.seat, { source: CODE })
        api.info('🎯 「敏锐直觉」：立刻进行了一次行动。')
      },
    },
  ],
  modifiers: [],
}
