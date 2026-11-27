// 08508 岩石峭壁（Rocky Crags） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：强制 - 在一张诡计附属到岩石峭壁时：该诡计获得涌动（每阶段仅限一次）。背面：进入本地点的额外费用（共同花费 1[per_investigator] 线索）。庇护 3。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

export default {
  code: '08508', scope: 'location', implemented: true,
  flags: { shelter: 3, campCandidate: true, entryGroupCluesPerInvestigator: 1 },
  locationRule: { surgeAttachedTreachery: true },
}


