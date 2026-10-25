// 05044 审判·XX（Judgement XX）· 议程（序章 05043 专属）。
//
// 印刷规则（中文）：
//   强制 - 在任何卡牌上放置了毁灭标记后：每位调查员必须受到 1 点伤害或 1 点恐惧
//          （如果场上有至少 5 个毁灭标记，改为受到 2 点伤害或 2 点恐惧）。
//   强制 - 在任何调查员被击败时，该调查员必须推进此密谋。在本密谋推进时，不要移除其上任何毁灭标记。
// 背面 1b：按击败原因把该调查员的命运记录到「失踪人口」旁（被看守人抓走 / 被幽灵夺走性命 /
//          消失在迷雾之中 / 被拉入幽灵国度），然后翻回 1a。
//
// 实现位置：
//   · 1a 的两条强制都由章节 behavior 结算（`doomPlaced` / `investigatorEliminated`）——
//     被击败者与击败来源是章节级上下文，单卡条目拿不到；
//   · 1b 的「推进→翻回 1a」由 behavior.investigatorEliminated 调 agenda-in-place-flip 原语
//     `api.flipAgendaInPlace('back')`（播报背面正文）→ 记录命运 → `('front')` 实现：
//     不推进 agendaIndex、不移除毁灭、不触发议程阈值/离场钩子；
//   · 本条目保留 agendaRule.onReveal 作为「引擎自行推进议程」时的兜底文案，
//     并声明 implemented: true（卡面两条强制均已有行为）。
//
// 一卡一文件：本卡规则只在这里声明；不 import 引擎/content。
export const JUDGEMENT_FATE_RECORDS = Object.freeze([
  'wasTakenByTheWatcher',
  'wasClaimedBySpecters',
  'disappearedIntoTheMist',
  'wasPulledIntoTheSpectralRealm',
])

export default {
  code: '05044',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    // 引擎因毁灭阈值/效果推进本议程时的兜底（正常流程不会发生：doomThreshold 被章节置为 null）。
    onReveal(state, agenda, api) {
      const records = (state.campaign && (state.campaign.records ||= {})) || {}
      for (const key of JUDGEMENT_FATE_RECORDS) if (!Array.isArray(records[key])) records[key] = []
      api?.info?.('📖 密谋 1b「审判·XX」：按该调查员被击败的原因记录其命运，然后翻回 1a；'
        + '本次推进不移除其上任何毁灭标记。')
      api?.info?.(`当前记录：被看守人抓走 ${records.wasTakenByTheWatcher.length} 人、`
        + `被幽灵夺走性命 ${records.wasClaimedBySpecters.length} 人、`
        + `消失在迷雾之中 ${records.disappearedIntoTheMist.length} 人、`
        + `被拉入幽灵国度 ${records.wasPulledIntoTheSpectralRealm.length} 人。`)
    },
  },
}
