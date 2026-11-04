// 07233 不变如海（Unchanging as the Sea）· 密谋 2 · TIC 第六章《雾中之光》
//
// 印刷（中文·正面）：
//   同一行的地点互相连接。
//   强制 - 在有调查员被俘时：推进本密谋。
//   强制 - 在本密谋推进时：将上面所有的毁灭标记移动到下一个密谋。
//
// 印刷（English·正面）：
//   Locations on the same row are connected to one another.
//   Forced - When an investigator is captured: Advance this agenda.
//   Forced - When this agenda advances: Move all doom on it to the next agenda.
//
// 印刷（中文·背面 / 深潜者所擒）：
//   每位调查员被俘。将其所有钥匙放在拘禁室。如果奥赛罗思·马什在场上，将其放在一边，位于场外。
//   将每张放在一边的惨遭俘虏混洗入遭遇牌库。
//   揭示灯塔地下室。将沉没岩洞(深层)放置入场，放在沉没岩洞(浅层)正下方；将沉没岩洞(底层)
//   放置入场，放在沉没岩洞(深层)正下方。然后，将放在一边的潮水通道地点随机放置入场，直到每一行
//   都有正好4个地点(除灯光室的一行外)。(见剧本手册上的图示。)
//   直接推进到场景3a(不结算场景2b)。
//
// 印刷（English·背面 / Seized by Deep Ones）：
//   Each investigator is captured. Place each of their keys on Holding Cells. If Oceiros Marsh is
//   in play, set him aside, out of play. Shuffle each set-aside copy of Taken Captive into the
//   encounter deck.
//   Reveal the Lighthouse Basement. Put Sunken Grotto (Lower Depths) into play directly below
//   Sunken Grotto (Upper Depths) and Sunken Grotto (Final Depths) into play directly below Sunken
//   Grotto (Lower Depths). Then, put random set-aside Tidal Tunnel locations into play until there
//   are exactly 4 locations on each row, except for the row with the Lantern Room. (See Campaign
//   Guide for diagram.)
//   Advance the act directly to act 3a (do not resolve act 2b).
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07233.js
//
// 引擎读点：
//   · 正面「同行互连」由章节统一声明（content/late-setup.js 的 map.configure({adjacency:'row'})，
//     grid-map.js#connectGrid 的 row 策略），本卡不重复声明。
//   · 正面「推进时把毁灭移到下个密谋」= agendaRule.doomToNextAgenda（act-agenda.js#advanceAgenda
//     在 clearDoomInPlay 前记录、agendaIndex++ 后放回；与 07232 同一读点）。
//   · 正面「有调查员被俘时推进本密谋」= agendaRule.onCaptured：capture.js#captureSeat 结算完
//     被俘状态后读**当前议程条目**的 onCaptured 并调用（batch 批量俘获抑制递归，见背面）。
//     采用引擎直接分派而不是 content 的 scenarioBehavior.events，是为了不再给 TIC 内容层加钩子
//     （与 w6 设计 §1.4 的偏差已写入 w7 报告）。
//   · 背面「每位调查员被俘」= api.capture(seat,{batch:true,keysTo:'destination'})：批量俘获
//     不触发本议程自己的 onCaptured；'destination' = 拘禁室（剧情卡 07252 翻面入场，见 07252.js）。
//   · 背面「马什放在一边」= api.setEnemyAside（scenario-runtime 既有出口：解除交战、移出敌人区、
//     进 state.setAsideEnemies；之后 07234b 从场外区域重新生成马什，效果等价）。
//   · 背面「沉没岩洞扩张 + 洗入惨遭俘虏」= _shared.js#expandSunkenGrotto（与 07237b 共用同一句
//     印刷块，只实现一次）。
//   · 背面「直接推进到场景 3a（不结算 2b）」= api.advanceActDirectly 逐张推进到 07238
//     （act-agenda.js：不调用 runActReveal，因此不结算 07237b）。
//
// implemented: true

import { expandSunkenGrotto, originalOf } from '../../_shared.js'

const MARSH = '07253'
const TARGET_ACT = '07238' // 场景 3a：深海信徒

// 直接推进到场景 3a：从当前幕逐张调用 advanceActDirectly（不结算任何幕背面），
// 直到当前幕是 07238；已在 3a 或更后时不动作（幂等，防重复结算）。
function advanceActToThirdAct(state, api) {
  const target = (state.acts || []).findIndex(act => String(originalOf(act)) === TARGET_ACT)
  if (target < 0) return false
  let guard = 0
  while (state.actIndex < target && guard++ < 6 && state.status === 'playing') {
    if (!api.advanceActDirectly()) break
  }
  return String(originalOf(state.acts?.[state.actIndex])) === TARGET_ACT
}

export default {
  code: '07233', scope: 'agenda', implemented: true,
  agendaRule: {
    doomToNextAgenda: true,
    // 强制：有调查员被俘时推进本密谋（capture.js 在被俘结算完成后分派当前议程条目）。
    onCaptured(state, agenda, api) {
      if (state.status !== 'playing') return
      api.advanceAgenda()
    },
    // 背面（深潜者所擒）：全员被俘 + 马什放在一边 + 扩张地图 + 洗入惨遭俘虏 + 直接推进 3a。
    onReveal(state, agenda, api) {
      // 1) 每位调查员被俘；钥匙放拘禁室。batch:true 抑制「被俘→推进本议程」的递归。
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned) continue
        api.capture(inv.seat, { batch: true, keysTo: 'destination', source: '07233' })
      }
      // 2) 马什在场上 → 放在一边，位于场外。
      const marsh = (state.enemies || []).find(enemy => !enemy.defeated && !enemy.removedFromGame
        && String(originalOf(enemy)) === MARSH)
      if (marsh) {
        api.setEnemyAside(marsh)
        api.info?.('「奥赛罗思·马什」被放在一边，位于场外。')
      }
      // 3) 揭示灯塔地下室 + 铺深层/底层 + 补潮水通道到每行 4 个 + 洗入惨遭俘虏（与 07237b 共用）。
      const expansion = expandSunkenGrotto(state, api)
      if (!expansion.upper) api.info?.('⚠️ 沉没岩洞（浅层）不在场，扩张结算不完整。')
      // 4) 直接推进到场景 3a（不结算场景 2b）。
      if (!advanceActToThirdAct(state, api)) api.info?.('⚠️ 未能直接推进到场景 3a，请检查场景牌库。')
      api.info?.('🌊 「深潜者所擒」：每位调查员被俘、马什被放在一边、深度地图展开，场景直接推进到 3a。')
    },
  },
}
