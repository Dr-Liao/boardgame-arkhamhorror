// 07232 海湾浓雾（Fog on the Bay）· 密谋 1 · 雾中之光 第六章
//
// 印刷（中文）：
//   同一行的地点互相连接。
//   强制 - 在本密谋推进时：将上面所有的毁灭标记移动到下一个密谋。
//
// 印刷（English）：
//   Locations on the same row are connected to one another.
//   Forced - When this agenda advances: Move all doom on it to the next agenda.
//
// 印刷（中文·背面）：
//   生成放在一边的奥赛罗思·马什敌人，与调查员队长交战。将放在一边的蓝色钥匙放在奥赛罗思·马什上。
//   将每张放在一边的尽腥尽力混洗入遭遇牌库。
//   每位调查员失去其所有线索。
//   将放在一边的灯塔地下室地点放置入场，放在灯塔梯井正下方。
//   将场景直接推进到场景2a(不结算场景1b)。
//
// 印刷（English·背面）：
//   Spawn the set-aside Oceiros Marsh enemy engaged with the lead investigator. Place the
//   set-aside blue key on Oceiros Marsh.
//   Shuffle each set-aside copy of Worth His Salt into the encounter deck.
//   Each investigator loses all of their clues.
//   Place the set-aside Lighthouse Basement location into play directly below Lighthouse
//   Stairwell.
//   Advance the act deck directly to act 2a (do not resolve act 1b).
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07232.js
//
// 引擎读点：
//   · 正面「同行互连」由章节统一声明（content/late-setup.js#lateAfterDeckSetup 的
//     `map.configure({ adjacency:'row' })`，grid-map.js#connectGrid 的 row 策略），本卡不重复声明。
//   · agendaRule.onReveal ← content entry-rules.agendaReveal（advanceAgenda 推进到本密谋时调用）。
//   · 「毁灭移动到下一个密谋」：条目声明 agendaRule.doomToNextAgenda，act-agenda.js#advanceAgenda
//     在清毁灭前记录、换到新议程后放回（数据驱动读点，内容层不写卡号分支）。
//   · 「马什 + 蓝钥匙 + 尽腥尽力 + 灯塔地下室」与 07236b 是同一句印刷块，共用
//     _shared.js#bringMarshAndLighthouseBasement；本卡只声明「与队长交战」。
//   · 「将场景直接推进到 2a（不结算 1b）」：api.scenario.advanceActDirectly（act-agenda.js：
//     不调用 runActReveal，只做离场清理与下一张幕入场）。
//
// implemented: true

import { bringMarshAndLighthouseBasement } from '../../_shared.js'

export default {
  code: '07232', scope: 'agenda', implemented: true,
  agendaRule: {
    doomToNextAgenda: true,
    onReveal(state, agenda, api) {
      const leadSeat = Number(state.campaign.leadSeat) || 0
      bringMarshAndLighthouseBasement(state, api, { engagedSeat: leadSeat })
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned) continue
        api.loseClues(inv.seat, inv.clues)
      }
      api.info?.('「海湾浓雾」背面：马什与蓝钥匙就位、调查员失去所有线索、灯塔地下室入场，场景直接推进到 2a。')
      api.advanceActDirectly()
    },
  },
}
