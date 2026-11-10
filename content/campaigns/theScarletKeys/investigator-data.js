// 八循环《绯红密钥》调查员构筑期数据（纯数据，P5）。
//
// 六位调查员：09001 卡森 / 09004 文森特 / 09008 基玛尼 / 09011 阿米娜 / 09015 达雷尔 / 09018 查理。
// 印刷卡面数据（deckOptions / deckRequirements / 数值）在 cards-data 里；本文件只放
// **引擎/构筑期需要的补充规则**，与参考实现 lib/Card/Arkham/*.hs 的 deckbuilding 口径一致：
//   · 次级职阶（Secondary Class / Class Choice）：卡面 `faction_select` 表示可选范围，
//     构筑时必须选定其中 N 个职阶；本文件给出 N 与范围，判定在 web/deck-rules.js 与
//     src/deck/deckbuilding.js 的通用逻辑里完成（数据驱动，不按调查员名写死）；
//   · 额外经验：基玛尼开局多 5 点（打印卡面背面）。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

export const TSK_INVESTIGATOR_CODES = Object.freeze(['09001', '09004', '09008', '09011', '09015', '09018'])

// 次级职阶选择：卡面印刷的 `faction_select` 选项组 → 需要选定的职阶数量。
// 判定读点：web/deck-rules.js#factionSelectErrors（服务端与浏览器共用）与
// src/deck/deckbuilding.js#factionSelectPlan（自动构筑先定职阶再选牌）。
export const TSK_CLASS_CHOICES = Object.freeze({
  '09001': Object.freeze({ factions: Object.freeze(['seeker', 'mystic', 'survivor']), count: 1, label: '次级职阶' }),
  '09018': Object.freeze({
    factions: Object.freeze(['guardian', 'seeker', 'rogue', 'mystic', 'survivor']), count: 2, label: '双副职阶',
  }),
})

// 构筑期额外经验（基玛尼：卡背 “You have 5 additional experience”）。
export const TSK_BONUS_XP = Object.freeze({ '09008': 5 })

// 开局必须带入的专属依赖（buildDeck 的签名卡校验之外，P5 审计用同一份口径）：
// 文森特的 09006《术后恢复》按人数额外放场外，达雷尔的 09016《达雷尔的柯达相机》开局在场。
export const TSK_SETUP = Object.freeze({
  '09004': Object.freeze({ setAsideSignature: Object.freeze({ code: '09006', perInvestigator: true }) }),
  '09015': Object.freeze({ startsWith: Object.freeze(['09016']) }),
})

export const TSK_SIGNATURE_CODES = Object.freeze(TSK_INVESTIGATOR_CODES
  .flatMap(code => ALL_CARDS[code]?.deckRequirements?.signatureCards || [])
  .sort())

export function tskInvestigatorBuildRules(code) {
  const key = String(code)
  const classChoice = TSK_CLASS_CHOICES[key] || null
  const setup = TSK_SETUP[key] || null
  const bonusXp = TSK_BONUS_XP[key] || 0
  if (!classChoice && !setup && !bonusXp) return null
  return Object.freeze({ code: key, classChoice, setup, bonusXp })
}

export function tskSignatureCodesFor(code) {
  return [...(ALL_CARDS[String(code)]?.deckRequirements?.signatureCards || [])]
}
