// 02217 西布伦·沃特雷
// 卡面：你得到 +1[willpower]。
// 卡面：[reaction] 你在诡计卡牌上的 [willpower] 检定成功后，横置西布伦·沃特雷：抽取 1 张卡牌。
//
// 一张卡一个文件：这张卡的常驻修正在这里维护；战役层的反应窗口仍在
// content/campaigns/theDunwichLegacy/later-behaviors.js 的 afterTest 里（尚未条目化）。
// 第 7 批：内容层 statModifier 的 +1 表与此处重复，已删除内容层副本。

import { skillModifier } from './_shared.js'

export default {
  code: '02217',
  assetRule: { cancelEncounterReaction: true },
  // 第 124 轮：原 card-rules.js 的 02217 兜底码改由条目声明。
  explicitReactionPrompt: true,
  scenarioPlayable: true,
  modifiers: [
    skillModifier('willpower', 1),
  ],
}
