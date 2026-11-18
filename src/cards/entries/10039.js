// 10039 转瞬为神（Evanescent Ascension）· 晨星 · 守卫者支援 · 法术槽 · 独一无二 ·
// 绑定（奇迹祝愿）
// 卡面：
//   绑定（奇迹祝愿）。如果转瞬为神没有祝愿，将其放在一旁，位于场外。
//   [reaction] 在你地点的调查员技能检定将要失败时，花费 1 祝愿并横置转瞬为神：
//   结算该调查员的 [elder_sign] 效果（本次检定期间揭示的所有其他标记也要结算）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自卡面数据 `bondedTo` / `bondedCards`（src/engine/bonded.js），条目不需要额外字段；
//     「放在一旁，位于场外」= 收回场外绑定集合 api.bonded.return(seat, '10038')
//     （bonded.js#returnToSet：扫描手牌/牌库/弃牌堆/场上/威胁区，把副本收进场外集合）。
//   · 祝愿 = 本卡实例上的 uses（usesType 'wishes'）；「没有祝愿 → 放在一旁」是条目级
//     onUsesEmptied（唯一读点 src/engine/uses.js#resolveEmptyUses，由 spendUses / setAssetUses /
//     描述子结算收尾触发）。10038 的「放置至多 X 个资源作为祝愿」应当用 api.addUses 写入同一个 uses。
//   · 「花费 1 祝愿」= 描述子 cost.uses；「横置」= cost.exhaust（ability-rules.js#payAbilityCost）。
//   · 「技能检定将要失败时」= 窗口 testWouldFail（tests.js 在标记揭示、成功判定前开窗，
//     context = { when, seat, location, skill, difficulty, testValue }）。该窗口是 interrupt 语义：
//     反应结算时把 `context.testBonus` 并入本次检定值（tests.js 的 `if (context.testBonus)`）。
//   · 旧印数值 = 调查员条目的 `investigator.elderSign` 数据（entries/_shared.js#investigatorSign
//     是同一份数据的惰性读点），与引擎 turn-flow.js#elderSignEffect / combat-odds.js#elderSignDelta 同源。
//
// approximation（simplified）：
//   能力面没有「按调查员结算其 [elder_sign] 效果」的入口——turn-flow.js#elderSignEffect 只在揭示到
//   旧印标记时由引擎内部调用，没有 api 包装。本条目按旧印的**数值修正**（+N，含 perClueAtLocation
//   这类数据形式）并入本次检定；旧印附带的文字效果（抽牌/移动/额外行动）不会结算。
//   见 artifacts/migration/fhv/primitive-requests/10039.json。
import { investigatorSign } from './_shared.js'

const CODE = '10039'
const PARENT = '10038' // 奇迹祝愿（绑定主卡）

// 旧印的数值修正（数据形式与引擎 elderSignDelta 同源）。
function elderSignDelta(state, inv) {
  const sign = investigatorSign(inv.code)
  const bonus = Number(sign.bonus)
  const base = Number.isFinite(bonus) ? bonus : 1
  const kind = sign.kind
  if (!kind || kind === 'static') return base
  if (kind === 'perClueAtLocation') {
    const here = (state.locations || []).find(location => location.id === inv.location)
    return base * (Number(here?.clues) || 0)
  }
  // 其它形式（每本书 / 每点恐惧 / 温迪的护身符……）只能取印刷基数，文字效果见文件头的 approximation。
  return base
}

export default {
  code: CODE,
  name: '转瞬为神',
  uses: 0,
  usesType: 'wishes',
  simplified: true,
  note: 'approximation: 「结算该调查员的 [elder_sign] 效果」缺少能力面读点，按 investigator.elderSign 的数值修正并入本次检定（旧印附带的文字效果不结算）；见 primitive-requests/10039.json。',
  onUsesEmptied: ({ inv, api }) => {
    const returned = api.bonded.return(inv.seat, PARENT)
    api.info(returned.length
      ? `✨ 「转瞬为神」没有祝愿：放在一旁，位于场外（${returned.length} 张收回场外集合）。`
      : '✨ 「转瞬为神」没有祝愿：已放在一旁，位于场外。')
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testWouldFail',
      id: 'evanescentAscensionElderSign',
      label: '花费 1 祝愿并横置：结算该调查员的旧印效果（技能值 +N）',
      cost: { uses: 1, exhaust: true },
      criteria: [({ state, inv, source, context }) => {
        if (!source) return false
        const tester = state.investigators?.[context?.seat]
        return Boolean(tester) && !tester.defeated && !tester.resigned && tester.location === inv.location
      }],
      resolve: ({ state, inv, context, api }) => {
        const tester = state.investigators[context.seat]
        const delta = elderSignDelta(state, tester)
        if (delta) context.testBonus = (context.testBonus || 0) + delta
        api.info(`✨ 「转瞬为神」：${tester.name} 结算旧印效果（本次检定技能值 +${delta}）。`)
      },
    },
  ],
  modifiers: [],
}
