// 07232 海湾浓雾（Fog on the Bay）· 密谋 1 · 雾中之光 第六章
//
// 印刷要点：
//   · 正面：同一行的地点互相连接（章节 late-setup 已 map.configure({adjacency:'row'})，
//     对整章持续生效，本卡不重复声明连接规则）。
//   · 强制 - 在本密谋推进时：将上面所有的毁灭标记移动到下一个密谋。
//   · 背面（推进时）：生成放在一边的奥赛罗思·马什，与调查员队长交战；把放在一边的蓝色钥匙
//     放在其上；把每张放在一边的「尽腥尽力」洗入遭遇牌库；每位调查员失去其所有线索；
//     将放在一边的灯塔地下室放到灯塔梯井正下方；将场景直接推进到场景 2a（不结算场景 1b）。
//
// 引擎读点：
//   · agendaRule.onReveal ← content entry-rules.agendaReveal（advanceAgenda 推进到本密谋时调用）。
//   · 「毁灭移动到下一个密谋」：条目声明 agendaRule.doomToNextAgenda，act-agenda.js#advanceAgenda
//     在清毁灭前记录、换到新议程后放回（数据驱动读点，内容层不写卡号分支）。
//   · 「马什 + 蓝钥匙 + 尽腥尽力 + 灯塔地下室」与 07236b 是同一句印刷块，共用
//     _shared.js#bringMarshAndLighthouseBasement；本卡只声明「与队长交战」。
//   · 「将场景直接推进到 2a（不结算 1b）」：api.scenario.advanceActDirectly（act-agenda.js：
//     不调用 runActReveal，只做离场清理与下一张幕入场）。

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
