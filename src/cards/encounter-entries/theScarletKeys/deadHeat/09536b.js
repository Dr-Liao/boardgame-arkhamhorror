// 09536b 后果
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：比较「后果」上获救的平民数量与提示卡上被杀害的平民数量。
// （注：仍在地点上的平民既不算获救，也不算被杀害。）
// - 获救 > 被杀：每位调查员获得 2 点奖励经验；获救 > 被杀的两倍：再获得 2 点奖励经验。
// - 被杀 > 获救：每位调查员承受 1 点精神创伤；被杀 > 获救的两倍：再承受 1 点精神创伤。
// - 平局：无事发生。
//
// 一张卡一个文件：behavior.resolution 的 aftermathOutcome 读取 aftermath / compareRescuedAndSlain
// 计算奖励经验与精神创伤（结局钩子统一发放）。
export default {
  code: '09536b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    aftermath: true,
    compareRescuedAndSlain: true,
    xpPerTier: 2,
    traumaPerTier: 1,
  },
}
