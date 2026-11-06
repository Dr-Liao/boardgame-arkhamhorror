import { registeredEntry } from './ability.js'
import { ALL_CARDS } from '../cards/cards-data.js'

export function assetTextBlankedExceptForced(asset) {
  return asset?.attachments?.some(card => registeredEntry(card.originalCode || card.code)
    ?.treacheryRule?.blankHostExceptForced) === true
}

// 「文本框视为空白」的内容层整类规则（与逐张宿主的 blankHostExceptForced 不同，这里没有强制例外）：
//   · 04099 毒蛇灾厄：显现时在威胁区实例上写 `blankItemAssets` —— 你的每个非弱点[[道具]]支援文本空白；
//   · 02088 被诅咒的地点等：条目的 `blanksTraits` —— 某类特征（例如 ally）的支援文本空白。
// 读点必须共用这一份判定：stats.assetEffect（旧 DSL 能力/修正，清空整张卡）、
// modifiers.sourceBlanked（被动与声明式修正）、ability-rules.descriptorUsable（能力层描述子：
// legalMoves / 反应窗口 / 玩家窗口的唯一枚举来源）。只做前两处会让被空白化的支援仍能发动能力
// （06013 门之匣 + 04099 实机复现：旧 DSL 已被清空，描述子却还在玩家窗口里开选项）。
export function assetTextBlanked(asset, inv) {
  const traits = ALL_CARDS[asset?.code]?.traits || []
  if (!traits.length) return false
  const threat = inv?.threat || []
  if (threat.some(item => item.blankItemAssets) && traits.includes('Item')) return true
  const blankedTraits = threat.flatMap(item => registeredEntry(item.originalCode || item.code)?.blanksTraits || [])
  return blankedTraits.length > 0
    && traits.some(trait => blankedTraits.includes(String(trait).toLowerCase()))
}
