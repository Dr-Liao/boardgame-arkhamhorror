// 七循环《地球边缘》（Edge of the Earth）关键词与规则书身份（P3，纯数据模块）。
//
// 口径见 docs/edgeOfTheEarth/README.md §5 与 audit/eote-mechanism-scan.json：
//   · 38 个关键词 = P1 机制扫描里 type=keyword 的全部机制，顺序与 id 与扫描账本一致；
//   · cardCodes 语料 = 卡名 + 正文 + 背面正文（与扫描器一致）。08549《致命幻景》与 08663/08671
//     的卡名本身带有关键词（Fatal Mirage / The Great Seal / The Seal Weakens），只用 text+backText
//     会漏 3 张；P3-B 的卡文直达匹配同样必须覆盖卡名；
//   · kind：token（frost / 封印标记）、trait（[[Expedition]]/[[Eidolon]]/[[Ancient One]]/[[Possessed]]/
//     [[Hazard]]/[[Broken]]/[[Unbroken]]/Titanic 等以特性或标记呈现的口径）、其余为 keyword；
//   · primitives = 该关键词机制在 P1 扫描里的 candidatePrimitives（原语事实源是 audit/eote-primitive-plan.json）；
//   · 本文件只登记身份与规则入口，不实现行为；关键词引擎行为由 P2 原语与 P3 规则层共同验收。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CYCLE_CODES } from './shared.js'

// [id, zh, ruleId, kind, patterns, primitives]；cardCodes 由同一语料复算，避免手写漂移。
const definitions = [
  ["hunter", "猎手", "hunter", "keyword", ["\\bHunter\\b"], ["core.enemy"]],
  ["aloof", "冷漠", "aloof", "keyword", ["\\bAloof\\b"], ["core.enemy"]],
  ["massive", "庞大", "massive", "keyword", ["\\bMassive\\b"], ["core.enemy"]],
  ["retaliate", "反击", "retaliate", "keyword", ["\\bRetaliate\\b"], ["core.enemy"]],
  ["alert", "警戒", "alert", "keyword", ["\\bAlert\\b"], ["core.enemy"]],
  ["surge", "涌动", "surge", "keyword", ["\\bSurge\\b"], ["core.encounter"]],
  ["peril", "险境", "peril", "keyword", ["\\bPeril\\b"], ["core.encounter"]],
  ["hidden", "隐藏", "hidden", "keyword", ["\\bHidden\\b"], ["core.encounter"]],
  ["victory", "胜利点", "victory", "keyword", ["\\bVictory\\b"], ["core.effects"]],
  ["objective", "目标", "eoteObjective", "keyword", ["\\bObjective\\b"], ["core.effects"]],
  ["prey", "猎物", "prey", "keyword", ["\\bPrey\\b"], ["core.enemy"]],
  ["spawn", "生成", "spawn", "keyword", ["\\bSpawn\\b"], ["core.enemy"]],
  ["parley", "谈判", "parley", "keyword", ["\\bParley\\b"], ["core.effects", "interaction.choices"]],
  ["resign", "撤退", "eoteResign", "keyword", ["\\bResign\\b"], ["core.effects"]],
  ["fast", "快速", "fast", "keyword", ["\\bFast\\b"], ["core.effects", "core.actionHistory"]],
  ["permanent", "永久", "permanent", "keyword", ["\\bPermanent\\b"], ["core.deck"]],
  ["exceptional", "卓越", "upgrade", "keyword", ["\\bExceptional\\b"], ["core.deck"]],
  ["elite", "精英", "elite", "keyword", ["\\bElite\\b"], ["keyword.elite", "core.enemy"]],
  ["revelation", "显现", "revelation", "keyword", ["\\bRevelation\\b"], ["core.encounter"]],
  ["mirage", "幻景", "eoteMirage", "keyword", ["\\bMirage\\b"], ["keyword.mirage", "scenario.mirageVersions"]],
  ["shelter", "庇护值", "eoteShelter", "keyword", ["\\bShelter\\b"], ["keyword.shelter", "location.shelter"]],
  ["partner", "伙伴", "eotePartners", "keyword", ["\\bPartner\\b"], ["keyword.partner", "campaign.partner", "campaign.memorials"]],
  ["resolute", "坚毅", "eoteResolute", "keyword", ["\\bResolute\\b"], ["keyword.resolute", "campaign.partner"]],
  ["seal", "封印", "eoteSeals", "keyword", ["\\bSeal(?:ed)?\\b", "\\[seal_[a-e]\\]"], ["keyword.seal", "campaign.seals"]],
  ["sealTokens", "封印标记", "eoteSealTokens", "token", ["\\[seal_[a-e]\\]"], ["keyword.seal", "campaign.seals"]],
  ["level", "高度", "eoteLevel", "keyword", ["\\bLevel\\b"], ["keyword.level", "location.vertical"]],
  ["key", "钥匙", "eoteKeys", "keyword", ["\\bKey\\b"], ["keyword.key", "scenario.keys"]],
  ["tekelili", "忒咳哩-哩", "eoteTekeli", "keyword", ["Tekeli-li|Tekelili|Tekeli-Li"], ["scenario.tekeliDeck", "interaction.tekeliShuffle"]],
  ["expedition", "探险", "eoteExpedition", "trait", ["\\[\\[Expedition\\]\\]", "\\bExpedition\\b"], ["keyword.expedition", "campaign.supplies"]],
  ["frost", "寒霜标记", "eoteFrost", "token", ["\\[frost\\]"], ["chaos.frost"]],
  ["supplies", "物资", "eoteSupplies", "keyword", ["\\bSupplies?\\b"], ["campaign.supplies"]],
  ["titanic", "巨大", "eoteTitanic", "trait", ["\\bTitanic\\b"], ["core.enemy"]],
  ["hazard", "危险", "eoteHazard", "trait", ["\\[\\[Hazard\\]\\]|\\bHazard\\b"], ["content.traits"]],
  ["broken", "破功", "eoteBroken", "trait", ["\\[\\[Broken\\]\\]|\\bBroken\\b"], ["content.traits", "investigator.discipline"]],
  ["unbroken", "运功", "eoteBroken", "trait", ["\\[\\[Unbroken\\]\\]|\\bUnbroken\\b"], ["content.traits", "investigator.discipline"]],
  ["eidolon", "幻灵", "eoteEidolon", "trait", ["\\[\\[Eidolon\\]\\]|\\bEidolon\\b"], ["content.traits"]],
  ["ancientOne", "古神", "eoteAncientOne", "trait", ["\\[\\[Ancient One\\]\\]|Ancient One"], ["content.traits"]],
  ["possessed", "附身", "eotePossessed", "trait", ["\\[\\[Possessed\\]\\]|\\bPossessed\\b"], ["content.traits"]],
]
export const EOTE_KEYWORDS = Object.freeze(definitions.map(([id, zh, ruleId, kind, patterns, primitives]) => Object.freeze({
  id, zh, ruleId, patterns, primitives, kind,
  cardCodes: CYCLE_CODES.filter(code => patterns.some(pattern => new RegExp(pattern, 'i').test([ALL_CARDS[code].name || '', ALL_CARDS[code].text || '', ALL_CARDS[code].backText || ''].join('\n')))),
})))
