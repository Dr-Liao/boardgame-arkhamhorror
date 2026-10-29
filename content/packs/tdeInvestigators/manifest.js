// 食梦者 · 调查员包（M0 / catalog-only：5 位正式调查员 + 11 张专属主卡 + 2 张关联面）。
//
// 归属规则：
//   · 主卡：5 位正式调查员（type=investigator）+ 其专属卡（signatureFor 指向调查员）；
//   · 关联面：06015a/b「梦境之门」没有 encounterCode、也不在卡表 signatureCards 里，
//     按卡面 Bonded (Gate Box) 归到 Luke Robinson，属 scope 账本的显式 override（路线图 §1.1 / D6）。
//   · 专属弱点（06007/06009/06012/06014/06017）作为依赖卡登记，不进入构筑池。
//
// M1（P6）才补能力、旧印与逐人验收；本文件在 M0 只声明归属与目录状态。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { INVESTIGATOR_CODES } from '../../campaigns/theDreamEaters/shared.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^06\d{3}$/.test(code)).sort()
const investigatorCards = mainCodes
  .filter(code => !ALL_CARDS[code].encounterCode
    && (ALL_CARDS[code].type === 'investigator' || ALL_CARDS[code].signatureFor))
  .map(code => ALL_CARDS[code])

export const INVESTIGATOR_CARD_CODES = Object.freeze(investigatorCards.map(card => card.code))
export const TDE_INVESTIGATOR_CODES = INVESTIGATOR_CODES
export const TDE_SIGNATURE_CODES = Object.freeze(investigatorCards
  .filter(card => card.type !== 'investigator')
  .map(card => card.code))
// 无主双面卡（M0 显式登记；scope 账本逐条核对）。
export const UNOWNED_FACE_OVERRIDES = Object.freeze({
  '06015a': { pack: 'tdeInvestigators', owner: '06004', reason: '梦境之门正面：卡面无 encounterCode，按 Bonded (Gate Box) 归 Luke Robinson' },
  '06015b': { pack: 'tdeInvestigators', owner: '06004', reason: '梦境之门背面：与 06015a 同一张双面卡' },
  '06169a': { pack: 'tdeCampaign', owner: null, reason: '无主双面卡：按卡面 encounterCode 归 A Thousand Shapes of Horror（战役包）' },
  '06169b': { pack: 'tdeCampaign', owner: null, reason: '同上，06169a 的背面' },
})

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdeInvestigators',
  name: '食梦者 · 调查员',
  contentVersion: '0.2.0',
  minRulesVersion: 'n6.0',
  status: 'development',
  dependencies: ['core'],
  description: 'M1（P6）产物：5 位正式调查员 + 11 张专属主卡 + 2 张关联面；逐人能力、旧印与构筑已验收；06015a/b 是绑定地点（由门之匣/脱离现实放进场，不进牌组）。',
  cardRanges: [{ from: '06001', to: '06017' }],
  faceCodes: Object.keys(UNOWNED_FACE_OVERRIDES).filter(code => UNOWNED_FACE_OVERRIDES[code].pack === 'tdeInvestigators'),
  cards: investigatorCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: true,
    deckbuilding: true,
  })),
  encounterGroupIds: [],
  behaviorIds: INVESTIGATOR_CARD_CODES,
}
