// 07337 深海恐惧症（Thalassophobia）· 诡计 · 暗潮之下 第八章
//
// 印刷（中文）：
//   显现 - 如果没有调查员在淹没的地点，深海恐惧症获得涌动。
//          否则，每位在部分淹没地点的调查员受到1点恐惧，每位在完全淹没地点的调查员受到
//          1点不能防止的直接恐惧。
//
// 印刷（English）：
//   Revelation - If no investigators are at flooded locations, Thalassophobia gains surge.
//   Otherwise, each investigator at a partially flooded location takes 1 horror, and each
//   investigator at a fully flooded location takes 1 direct horror that cannot be prevented.
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07337.js
//
// 引擎读点：
//   · encounterResolve ← treachery-tokens.js#resolveTreachery 的条目显现通道（entryRevelation）；
//     返回 { gainSurge: true } 走引擎既有涌动抽取（encounter.js#drawEncounter 的唯一读点）。
//   · floodLevel 读 flood.js（0 未淹没 / 1 部分 / 2 完全）；直接恐惧走 api.directHorror
//     （enemies.js#applyHarm 的 direct 分支：不分配给支援卡）。本作没有「防止恐惧」的引擎层，
//     「不能防止」在当前卡池无可取消路径（全库仅本卡印此句），以直接恐惧为最接近的已接线口径。
//
// implemented: true

import { floodLevel } from '../../_shared.js'

export default {
  code: '07337', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const flooded = state.investigators.filter(other =>
      !other.defeated && !other.resigned && floodLevel(state, other.location) >= 1)
    if (!flooded.length) return { gainSurge: true }
    for (const other of flooded) {
      if (floodLevel(state, other.location) >= 2) api.directHorror(other.seat, 1)
      else api.horror(other.seat, 1)
    }
    return false
  },
}
