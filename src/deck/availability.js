import { SCENARIO_CARD_IDENTITIES, SCENARIOS } from '../cards/scenarios-data.js'
import { expansionPlayerCodes } from '../../content/expansions.js'
import { coreCardVerified, CORE_ACCEPTANCE_PROFILE } from '../cards/core-acceptance.js'
import { tfaPlayerCardVerified, tfaPlayerBuildable, IMPLEMENTED_PLAYER_CODES } from '../../content/packs/tfaPlayer/manifest.js'
export const CORE_INVESTIGATOR_CODES = Object.freeze(['01001', '01002', '01003', '01004', '01005'])
export const DUNWICH_INVESTIGATOR_CODES = Object.freeze(['02001', '02002', '02003', '02004', '02005'])
export const CARCOSA_INVESTIGATOR_CODES = Object.freeze(['03001', '03002', '03003', '03004', '03005', '03006'])
export const TFA_INVESTIGATOR_CODES = Object.freeze(['04001', '04002', '04003', '04004', '04005'])
// 第四循环（万象无终）：6 位正式调查员；序章 4 位故事调查员永远不在这里（无牌组、不可构筑）。
export const TCU_INVESTIGATOR_CODES = Object.freeze(['05001', '05002', '05003', '05004', '05005', '05006'])
export const PLAYABLE_INVESTIGATOR_CODES = Object.freeze([
  ...CORE_INVESTIGATOR_CODES,
  ...DUNWICH_INVESTIGATOR_CODES,
  ...CARCOSA_INVESTIGATOR_CODES,
  ...TFA_INVESTIGATOR_CODES,
  ...TCU_INVESTIGATOR_CODES,
])

export const CORE_PLAYER_CODES = Object.freeze([
  '01016', '01017', '01018', '01019', '01020', '01021', '01022', '01023', '01024', '01025',
  '01030', '01031', '01032', '01033', '01034', '01035', '01036', '01037', '01038', '01039',
  '01044', '01045', '01046', '01047', '01048', '01049', '01050', '01051', '01052', '01053',
  '01058', '01059', '01060', '01061', '01062', '01063', '01064', '01065', '01066', '01067',
  '01072', '01073', '01074', '01075', '01076', '01077', '01078', '01079', '01080', '01081',
  '01086', '01087', '01088', '01089', '01090', '01091', '01092', '01093',
])
export const CORE_SIGNATURE_CODES = Object.freeze(['01006', '01007', '01008', '01009', '01010', '01011', '01012', '01013', '01014', '01015'])
export const CORE_BASIC_WEAKNESS_CODES = Object.freeze(['01096', '01097', '01098', '01099', '01100', '01101', '01102', '01103'])
export const DUNWICH_BASIC_WEAKNESS_CODES = Object.freeze(['02037', '02038', '02039'])
export const CARCOSA_BASIC_WEAKNESS_CODES = Object.freeze(['03040', '03041', '03042'])
export const ALL_BASIC_WEAKNESS_CODES = Object.freeze([
  ...CORE_BASIC_WEAKNESS_CODES,
  ...DUNWICH_BASIC_WEAKNESS_CODES,
  ...CARCOSA_BASIC_WEAKNESS_CODES,
])
export const CORE_STORY_CODES = Object.freeze(['01117'])
export const CORE_UPGRADE_CODES = Object.freeze([
  '01026', '01027', '01028', '01029',
  '01040', '01041', '01042', '01043',
  '01054', '01055', '01056', '01057',
  '01068', '01069', '01070', '01071',
  '01082', '01083', '01084', '01085',
  '01094', '01095',
])
export const SIGNATURES_BY_INVESTIGATOR = Object.freeze({
  '01001': Object.freeze(['01006', '01007']),
  '01002': Object.freeze(['01008', '01009']),
  '01003': Object.freeze(['01010', '01011']),
  '01004': Object.freeze(['01012', '01013']),
  '01005': Object.freeze(['01014', '01015']),
  '02001': Object.freeze(['02006', '02007']),
  '02002': Object.freeze(['02008', '02009']),
  '02003': Object.freeze(['02010', '02011']),
  '02004': Object.freeze(['02012', '02013']),
  '02005': Object.freeze(['02014', '02015']),
  '03001': Object.freeze(['03007', '03008', '03009']),
  '03002': Object.freeze(['03010', '03011']),
  '03003': Object.freeze(['03012', '03013']),
  '03004': Object.freeze(['03014', '03015']),
  '03005': Object.freeze(['03016', '03017']),
  '03006': Object.freeze(['03018', '03019']),
  '04001': Object.freeze(['04006', '04007']),
  '04002': Object.freeze(['04008', '04009']),
  '04003': Object.freeze(['04010', '04011', '04012']),
  '04004': Object.freeze(['04013', '04014']),
  '04005': Object.freeze(['04015', '04016']),
  '05001': Object.freeze(['05007', '05008']),
  '05002': Object.freeze(['05009', '05010']),
  '05003': Object.freeze(['05011', '05012']),
  '05004': Object.freeze(['05013', '05014', '05015']),
  '05005': Object.freeze(['05016', '05017']),
  '05006': Object.freeze(['05018', '05019']),
})
export const SIMPLIFIED_CARD_CODES = Object.freeze([...CORE_PLAYER_CODES, ...CORE_SIGNATURE_CODES, ...CORE_BASIC_WEAKNESS_CODES, ...CORE_STORY_CODES])
export {
  CORE_PLAYER_CODES as SIMPLIFIED_PLAYER_CARD_CODES,
  SIGNATURES_BY_INVESTIGATOR as SIGNATURE_CARD_CODES_BY_INVESTIGATOR,
  CORE_BASIC_WEAKNESS_CODES as BASIC_WEAKNESS_CODES,
}

const investigators = new Set(PLAYABLE_INVESTIGATOR_CODES)
const dunwichSignatures = Object.values(SIGNATURES_BY_INVESTIGATOR).slice(5, 10).flat()
const carcosaSignatures = [...Object.values(SIGNATURES_BY_INVESTIGATOR).slice(10, 16).flat(), '03009b']
// 第 5 步 M1 调查员批次（P6）：TCU 的 13 张专属卡。按调查员显式取，不再用 slice 位置——
// 新增循环时 `slice(16)` 这类写法会把后面的循环一起算进来。
const tfaSignatureGroups = Object.values(SIGNATURES_BY_INVESTIGATOR).slice(16, 21)
const tfaSignatures = tfaSignatureGroups.flat()
const tcuSignatures = TCU_INVESTIGATOR_CODES.flatMap(code => [...(SIGNATURES_BY_INVESTIGATOR[code] || [])])
const tfaPlayerCodes = [...IMPLEMENTED_PLAYER_CODES]
export const TFA_PLAYER_BUILDABLE_CODES = Object.freeze(tfaPlayerCodes.filter(code => tfaPlayerBuildable(code)))
export const PLAYER_CARD_CODES = Object.freeze([
  ...CORE_PLAYER_CODES, ...expansionPlayerCodes,
])
// 失落的时代玩家卡可用于手动牌组与升级，但不进入默认自动构筑池：
// 新增卡池不应改变既有循环自动牌组的产出。
export const ALL_BUILDABLE_CODES = Object.freeze([...PLAYER_CARD_CODES, ...TFA_PLAYER_BUILDABLE_CODES])
const cards = new Set([...SIMPLIFIED_CARD_CODES, ...CORE_UPGRADE_CODES, ...expansionPlayerCodes,
  ...dunwichSignatures, ...carcosaSignatures, ...tfaSignatures, ...tfaPlayerCodes, ...tcuSignatures,
  ...DUNWICH_BASIC_WEAKNESS_CODES, ...CARCOSA_BASIC_WEAKNESS_CODES])
const strictAcceptedCodes = new Set([...investigators, ...cards])
const strictScenarioCodes = new Set(Object.values(SCENARIO_CARD_IDENTITIES).flatMap(categories =>
  Object.values(categories).flatMap(entries => Object.values(entries).map(entry => entry.originalCode))))
for (const scenario of Object.values(SCENARIOS)) {
  for (const variants of Object.values(scenario.locationVariants || {})) {
    for (const variant of variants) strictScenarioCodes.add(variant.originalCode)
  }
}
function isStrictAccepted(code) {
  return coreCardVerified(code) || strictAcceptedCodes.has(code) || strictScenarioCodes.has(code)
}
export function canSelectInvestigator(code, mode = 'simplified') {
  return (mode === 'simplified' || mode === 'strict') && investigators.has(code)
}
export function isCardAvailable(code, mode = 'simplified') {
  return (mode === 'simplified' || mode === 'strict') && cards.has(code)
}
export function getAvailability(code) {
  return {
    availability: isStrictAccepted(code) ? 'strict' : 'catalog-only',
    strictAccepted: isStrictAccepted(code),
    selectable: investigators.has(code),
    deckbuilding: ALL_BUILDABLE_CODES.includes(code),
    upgradeOnly: CORE_UPGRADE_CODES.includes(code),
    dependencyOnly: CORE_SIGNATURE_CODES.includes(code) || dunwichSignatures.includes(code)
      || carcosaSignatures.includes(code) || tfaSignatures.includes(code) || tcuSignatures.includes(code)
      || ALL_BASIC_WEAKNESS_CODES.includes(code),
    scenarioOnly: CORE_STORY_CODES.includes(code),
    acceptanceProfile: coreCardVerified(code) ? CORE_ACCEPTANCE_PROFILE.id : null,
    reason: coreCardVerified(code) ? '初始包已通过逐卡行为验收；范围与测试见 audit/core-acceptance.json。'
      : tfaPlayerCardVerified(code)
        ? 'M2 失落的时代玩家卡已全部通过逐卡主要印刷效果验收（含战役层永久卡）。'
      : TCU_INVESTIGATOR_CODES.includes(code) || tcuSignatures.includes(code)
        ? 'M1 万象无终六位调查员及其 13 张专属依赖已通过逐人行为与存档回放验收；玩家卡与剧本仍未开放。'
      : TFA_INVESTIGATOR_CODES.includes(code) || tfaSignatures.includes(code)
        ? 'M1 失落的时代五位调查员及其 11 张专属依赖已通过逐人行为与存档回放验收；玩家卡与剧本仍未开放。'
      : CARCOSA_INVESTIGATOR_CODES.includes(code) || carcosaSignatures.includes(code)
        ? 'C1 卡尔克萨六位调查员及其专属依赖已通过逐人行为与存档回放验收；普通玩家卡、基础弱点和剧本仍未开放。'
      : (code.startsWith('03') && expansionPlayerCodes.includes(code)) || CARCOSA_BASIC_WEAKNESS_CODES.includes(code)
        ? 'C2 卡尔克萨玩家卡与基础弱点已通过逐卡主要印刷效果验收；剧本内容仍未开放。'
      : CORE_UPGRADE_CODES.includes(code) ? 'N4 Core 关间升级卡；不能用于 0 XP 开局，规则验收以逐卡测试为准。'
      : investigators.has(code) || cards.has(code) ? '当前可玩子集；尚未完成全部规则等价审计，strict 字段仅为兼容旧协议。' : '目录收录；未开放构筑、选人或升级。',
  }
}
