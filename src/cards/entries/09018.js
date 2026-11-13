// 09018 查理·凯恩（Charlie Kane）· 中立 · 政客
// 卡面：
//   你有 3 个额外的盟友槽位。
//   [fast] 在你进行的一次技能检定期间，横置你控制的一名 [[盟友]] 支援：
//     本次检定获得 +1 技能值；该盟友每有一个与本次检定技能相匹配的图标，再 +1。
//   [elder_sign] 效果：+3。重整你控制的一名 [[盟友]] 支援。
//
// 读点（卡面 → 引擎读点）：
//   · 额外盟友槽：条目 `investigator.extraSlots.ally = 3` →
//     src/engine/tsk-investigator-support.js#extraInvestigatorSlots → src/engine/assets.js#canEquip。
//   · 检定期 [fast]：P1-6 修正。原实现写在 `investigator.freeAction` 上，但检定窗口
//     （src/engine/encounter.js#playerWindow → test.beforeCommit / test.afterCommit）只枚举
//     「场上支援 / 调查员条目的 abilities 描述子」，不枚举 investigator.freeAction（那是
//     legalMoves 的普通行动窗口读点，见 src/engine/moves.js:358-376），因此原能力永远不可达。
//     改为 `kind:'free'` 描述子 + trigger ['test.beforeCommit','test.afterCommit'] +
//     duringOwnSkillTest（读点 ability-rules.js#descriptorUsable 按 timingWindow/duringOwnSkillTest
//     过滤，encounter.js#doFreeDescriptor 执行），与 09099「便携万能工具」同一套检定期 fast 读点。
//   · +1 技能值 + 每个匹配图标再 +1：api.addPendingTestBonus（tests.js 在 ST.2/ST.3 统一并入，
//     与 api.addTestValue 不同，不会被检定值的重算覆盖）；图标数来自 api.cardIcons（cards-data icons）。
//   · 横置盟友：api.exhaust（只写实例 exhausted；09019 邦妮「横置后」窗口需要引擎在 api.exhaust
//     也派发 assetExhausted，已列给主进程）。
//   · 旧印 +3：条目 elderSign.resolve 返回 delta 3（turn-flow.js#elderSignEffect 只读这个返回值）；
//     `investigator.elderSign.bonus` 同步为 3（combat-odds.js#elderSignDelta 的 AI 预估读点）。
//     旧印「重整你所在地点的盟友」当前只枚举本人控制的支援（`inv.assets`）：他人控制的同地点盟友
//     需要跨座位支援目标读点，保留近似并在 note 里披露。
import { ALL_CARDS } from '../../cards/cards-data.js'

const isAlly = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')
const readyAllies = inv => (inv.assets || []).filter(asset => !asset.exhausted && isAlly(asset.code))
const exhaustedAllies = inv => (inv.assets || []).filter(asset => asset.exhausted && isAlly(asset.code))

export default {
  code: '09018',
  note: 'approximation: 旧印「重整你所在地点的一名盟友支援」只枚举本人控制的支援（跨座位目标读点缺失）',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 3 },
    extraSlots: { ally: 3 },
  },
  elderSign: {
    id: '09018-eldersign',
    label: '查理旧印：+3；重整你控制的一名盟友支援',
    resolve: ({ inv, api }) => {
      const allies = exhaustedAllies(inv)
      if (allies.length) {
        const target = allies.length === 1 ? allies[0] : allies[Number(api.choice({
          kind: 'target', source: '09018', seat: inv.seat, prompt: '选择要重整的盟友支援。',
          options: allies.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (target) api.ready(target)
      }
      return { delta: 3 }
    },
  },
  abilities: [
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '技能检定期间横置一名盟友：本次检定 +1，该盟友每个匹配的技能图标再 +1',
      cost: { action: false },
      criteria: [({ inv }) => readyAllies(inv).length > 0],
      resolve: ({ state, inv, api }) => {
        const allies = readyAllies(inv)
        if (!allies.length) return
        const target = allies.length === 1 ? allies[0] : allies[Number(api.choice({
          kind: 'target', source: '09018', seat: inv.seat, prompt: '选择要横置的盟友支援。',
          options: allies.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (!target) return
        api.exhaust(target)
        const skills = [].concat(state.skillTest?.skill || [])
        const icons = api.cardIcons(target.code) || {}
        const matched = Object.entries(icons).reduce((sum, [icon, count]) =>
          (icon === 'wild' || skills.includes(icon) ? sum + (Number(count) || 0) : sum), 0)
        const bonus = 1 + matched
        api.addPendingTestBonus(bonus)
        api.info(`🫱 查理横置「${api.cardName(target.code)}」：本次技能检定 +${bonus} 技能值。`)
      },
    },
  ],
  modifiers: [],
}
