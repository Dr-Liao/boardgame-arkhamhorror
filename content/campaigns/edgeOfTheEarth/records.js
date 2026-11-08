// 《地球边缘》（Edge of the Earth）· 战役记录、伙伴/物资/封印常量与正文读取辅助（P7）。
//
// 事实源（锁定）：
//   · 记录键：参考实现 `backend/arkham-api/library/Arkham/Campaigns/EdgeOfTheEarth/Key.hs`（56 项）。
//     每项的类型按参考实现的使用方式判定：`record X` 单项 → boolean；`recordSetInsert X` → string[]。
//   · 伙伴名册：`EdgeOfTheEarth/Partner.hs#expeditionTeam` 的 9 位伙伴（安全面 08714–08722，坚毅面 08587–08595）。
//   · 探险物资：`Supplies.hs#Supply` 的 7 件（08614–08620）。
//   · 封印：`Seal.hs#SealKind` 的 A–E。
//   · 记录标签/伙伴名/物资名：生成物 `story-text.js` 的 `campaign.records`（经 `story-access.js` 读取）。
//   · 营地庇护值：参考 `Scenario/Scenarios/IceAndDeath.hs` 的地点 meta（crashSite 7 … crystallineCavern 1）。
//
// 本文件只提供**可序列化数据与只读辅助**：不写 state、不注册效果、不依赖引擎状态形状。
import {
  campaignStory, flattenStory, storyEntry,
} from './story-access.js'

export const CAMPAIGN_ID = 'edgeOfTheEarth'

// ---------------------------------------------------------------------------
// 正文读取（P7 统一口径）：流程节点只存 key，正文由 story-access 提供。
// EotE 的 story-text 扁平键是 `edgeOfTheEarth.<dotted-path>.body` / `.title`；
// 同时兼容生成物改回分组结构（campaign.<group>.entries[].key）的情形。
// ---------------------------------------------------------------------------

const textOf = value => {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value !== 'object') return ''
  if (typeof value.body === 'string') return value.body.trim()
  if (typeof value.text === 'string') return value.text.trim()
  return flattenStory(value).trim()
}

/** 在 campaign 分组里递归找 `entries[].key === path` 的条目（生成物改结构时的回退）。 */
function findCampaignEntry (path) {
  const root = campaignStory('checkpoints') ? {
    prologue: campaignStory('prologue'),
    partnerIntros: campaignStory('partnerIntros'),
    checkpoints: campaignStory('checkpoints'),
    interludes: campaignStory('interludes'),
    epilogue: campaignStory('epilogue'),
    specialRules: campaignStory('specialRules'),
    records: campaignStory('records'),
  } : null
  if (!root) return null
  const seen = new Set()
  const walk = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return null
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item)
        if (found) return found
      }
      return null
    }
    if (Array.isArray(value.entries)) {
      const entry = value.entries.find(item => item && item.key === path)
      if (entry) return entry
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'entries' || typeof child !== 'object') continue
      const found = walk(child)
      if (found) return found
    }
    return null
  }
  for (const [key, group] of Object.entries(root)) {
    if (!group) continue
    if (key === 'records') {
      const labels = group.recordLabels
      const entry = labels?.entries?.find(item => item?.key === `key.${path}`)
      if (entry) return entry
      continue
    }
    const found = walk(group)
    if (found) return found
  }
  return null
}

/** 只接受「已译」条目：缺译/未译时返回 null，让调用方回退到模块内置中文兜底，避免英文进中文界面。 */
function presentEntry (entry) {
  if (!entry || typeof entry !== 'object') return null
  return entry.status === 'present-needs-review' ? entry : null
}

/** 正文：`checkpoint1.theDisappearance1` → 正文段落（空字符串表示生成物暂无该键或该键缺译）。 */
export function storyBody (path) {
  if (!path) return ''
  const flat = textOf(presentEntry(storyEntry(`edgeOfTheEarth.${path}.body`)))
  if (flat) return flat
  const direct = textOf(presentEntry(storyEntry(`edgeOfTheEarth.${path}`)))
  if (direct) return direct
  const campaignEntry = presentEntry(findCampaignEntry(path))
  return campaignEntry ? textOf(campaignEntry) : ''
}

/** 小标题：缺失或缺译时返回空串（流程节点回退到节点 label）。 */
export function storyHeading (path) {
  if (!path) return ''
  const flat = textOf(presentEntry(storyEntry(`edgeOfTheEarth.${path}.title`)))
  if (flat) return flat
  return textOf(presentEntry(storyEntry(`edgeOfTheEarth.${path}`)))
}

/** 记录标签：来自 story-text 的 campaign.records.recordLabels（键形如 `key.campCrashSite`）。 */
function recordLabelEntries () {
  const records = campaignStory('records')
  return records?.recordLabels?.entries || []
}

// story-text 的记录标签键是 lowerCamel（`key.theTeamFledToTheMountains`），
// Key.hs/recordSchema 用 PascalCase；这里统一归一到 schema 键（camP_* 保持原样）。
const canonicalRecordKey = value => {
  if (!value) return value
  // story-text 标签键已是 lowerCamel（campCrashSite/theTeamFledToTheMountains），与 recordSchema 同形。
  if (value.startsWith('camp_')) return 'camp' + value.slice(5)
  return value
}

export function recordLabelMap () {
  const labels = {}
  for (const entry of recordLabelEntries()) {
    if (!entry?.key) continue
    const key = canonicalRecordKey(String(entry.key).replace(/^key\./, ''))
    labels[key] = String(entry.body ?? entry.text ?? '').trim()
  }
  // 参考 locale 只覆盖 Key.hs 的 56 个记录键；流程层/章节层另有 25 个 schema 键，
  // 缺中文标签时战役记录面板会显示 camelCase 键名。这里补本地中文默认标签（不写回参考层）。
  for (const [key, label] of Object.entries(RECORD_LABEL_DEFAULTS)) {
    if (!labels[key]) labels[key] = label
  }
  for (const partner of PARTNERS) {
    const key = `partnerResult${partner.code}`
    if (!labels[key]) labels[key] = `伙伴结果 · ${partner.name}`
  }
  return labels
}

/** 流程层/章节层记录键的本地中文标签（Key.hs 56 键之外的 25 项）。 */
const RECORD_LABEL_DEFAULTS = Object.freeze({
  iceAndDeathPart1Resolution: '亡命冰原 I · 结局',
  iceAndDeathPart1CampShelter: '亡命冰原 I · 营地庇护值',
  iceAndDeathPart2Resolution: '亡命冰原 II · 结局',
  iceAndDeathPart3Resolution: '亡命冰原 III · 结局',
  shelterValue: '庇护值',
  eidolonsVanquished: '被击败的幻灵',
  seepingNightmaresEnded: '结束的渗出梦魇',
  partnersFacedInnerDemon: '直面心魔的伙伴',
  fatalMirageResolution: '致命幻景 · 结局',
  fatalMirageTimes: '进入致命幻景次数',
  fatalMirageCompleted: '完成致命幻景',
  resolutePartners: '坚毅伙伴',
  xp: '经验值',
  theTeamStudiedTheHistoryOfTheElderThings: '队伍研究了古老者的历史',
  theTeamDiscernedTheOriginOfTheShoggoths: '队伍查明了修格斯的起源',
  theTeamDiscoveredAHiddenPower: '队伍发现了隐藏的力量',
  eoteShelterValue: '营地庇护值',
  eoteMissingCount: '失踪人数',
  eoteMissingPartners: '失踪伙伴',
  eoteEliminatedPartners: '被淘汰的伙伴',
  eoteCheckedPartners: '已检查的伙伴',
  eoteInterludeXp: '幕间经验',
  eoteFatalMirageEntries: '致命幻景进入次数',
  eotePartnerStatuses: '伙伴状态',
})

/** 伙伴显示名：来自 story-text 的 campaign.records.partnerNames（键形如 `partnerNames.08714`）。 */
export function partnerNameMap () {
  const records = campaignStory('records')
  const names = {}
  for (const entry of records?.partnerNames?.entries || []) {
    if (!entry?.key) continue
    const code = String(entry.key).replace(/^partnerNames\./, '')
    names[code] = String(entry.body ?? entry.text ?? '').trim()
  }
  return names
}

/** 物资显示名：来自 story-text 的 campaign.records.suppliesRecovered（键形如 `suppliesRecovered.greenSoapstone`）。 */
export function supplyNameMap () {
  const records = campaignStory('records')
  const names = {}
  for (const entry of records?.suppliesRecovered?.entries || []) {
    if (!entry?.key) continue
    names[String(entry.key).replace(/^suppliesRecovered\./, '')] = String(entry.body ?? entry.text ?? '').trim()
  }
  return names
}

// ---------------------------------------------------------------------------
// 伙伴/物资/封印/营地常量
// ---------------------------------------------------------------------------

/** 9 位探险队伙伴：`{ code（安全面）, resolute（坚毅面）, key, name }`。 */
export const PARTNERS = Object.freeze([
  Object.freeze({ code: '08720', resolute: '08593', key: 'kensler', name: '艾米·肯斯勒博士', nameEn: 'Dr. Amy Kensler' }),
  Object.freeze({ code: '08714', resolute: '08587', key: 'dyer', name: '威廉·戴尔教授', nameEn: 'Professor William Dyer' }),
  Object.freeze({ code: '08715', resolute: '08588', key: 'danforth', name: '丹佛斯', nameEn: 'danforth' }),
  Object.freeze({ code: '08721', resolute: '08594', key: 'ellsworth', name: '罗尔德·埃尔斯沃思', nameEn: 'Roald Ellsworth' }),
  Object.freeze({ code: '08722', resolute: '08595', key: 'takada', name: '高田弘子', nameEn: 'Takada Hiroko' }),
  Object.freeze({ code: '08718', resolute: '08591', key: 'claypool', name: '艾弗里·克莱普尔', nameEn: 'Avery Claypool' }),
  Object.freeze({ code: '08717', resolute: '08590', key: 'sinha', name: '玛拉·辛哈医生', nameEn: 'Dr. Mala Sinha' }),
  Object.freeze({ code: '08719', resolute: '08592', key: 'cookie', name: '詹姆斯·“曲奇”·弗雷德里克斯', nameEn: 'James "Cookie" Fredericks' }),
  Object.freeze({ code: '08716', resolute: '08589', key: 'ashevak', name: '伊里亚·阿什瓦克', nameEn: 'Eliyah Ashevak' }),
])
export const PARTNER_CODES = Object.freeze(PARTNERS.map(partner => partner.code))
export const PARTNER_RESOLUTE_BY_CODE = Object.freeze(Object.fromEntries(
  PARTNERS.map(partner => [partner.code, partner.resolute])))
export const PARTNER_KEY_BY_CODE = Object.freeze(Object.fromEntries(
  PARTNERS.map(partner => [partner.code, partner.key])))

/** 7 件探险物资；`label` 为内容层兜底显示名，生成物就绪后以 story-text 为准。 */
export const SUPPLIES = Object.freeze([
  Object.freeze({ code: '08614', key: 'greenSoapstone', label: '绿皂石' }),
  Object.freeze({ code: '08615', key: 'woodenSledge', label: '木制雪橇' }),
  Object.freeze({ code: '08616', key: 'dynamite', label: '炸药' }),
  Object.freeze({ code: '08617', key: 'miasmicCrystal', label: '瘴气水晶' }),
  Object.freeze({ code: '08618', key: 'mineralSpecimen', label: '矿物标本' }),
  Object.freeze({ code: '08619', key: 'smallRadio', label: '小型收音机' }),
  Object.freeze({ code: '08620', key: 'spareParts', label: '备用零件' }),
])
export const SUPPLY_CODES = Object.freeze(SUPPLIES.map(supply => supply.code))

/** 五枚封印（A–E）。 */
export const SEALS = Object.freeze(['A', 'B', 'C', 'D', 'E'])

/** 13 个营地候选地点：记录键 → 打印庇护值（参考 IceAndDeath.hs 地点 meta）。 */
export const CAMP_SHELTER = Object.freeze({
  // 庇护值逐项来自 Location/CardDefs/EdgeOfTheEarth/IceAndDeath.hs 的 meta.shelter。
  campCrashSite: Object.freeze({ shelter: 0, label: '坠机点', labelEn: 'Crash Site', code: '08502' }),
  campFrozenShores: Object.freeze({ shelter: 2, label: '冰冻海岸', labelEn: 'Frozen Shores', code: '08503' }),
  campTreacherousPath: Object.freeze({ shelter: 1, label: '危险道路', labelEn: 'Treacherous Path', code: '08504' }),
  campPrecariousIceSheet: Object.freeze({ shelter: 2, label: '不稳定冰盖', labelEn: 'Precarious Ice Sheet', code: '08505' }),
  campBroadSnowdrifts: Object.freeze({ shelter: 4, label: '辽阔雪地', labelEn: 'Broad Snowdrifts', code: '08506' }),
  campIcyWastes: Object.freeze({ shelter: 4, label: '冰封荒原', labelEn: 'Icy Wastes', code: '08507' }),
  campRockyCrags: Object.freeze({ shelter: 3, label: '岩石峭壁', labelEn: 'Rocky Crags', code: '08508' }),
  campSnowGraves: Object.freeze({ shelter: 5, label: '雪冢', labelEn: 'Snow Graves', code: '08509' }),
  campIcebreakerLanding: Object.freeze({ shelter: 5, label: '破冰船登陆点', labelEn: 'Icebreaker Landing', code: '08510' }),
  campFrigidCave: Object.freeze({ shelter: 6, label: '严寒洞穴', labelEn: 'Frigid Cave', code: '08511' }),
  campBarrierCamp: Object.freeze({ shelter: 7, label: '屏障营地', labelEn: 'Barrier Camp', code: '08512' }),
  campRemnantsOfLakesCamp: Object.freeze({ shelter: 7, label: '莱克营地遗址', labelEn: "Remnants of Lake's Camp", code: '08513' }),
  campCrystallineCavern: Object.freeze({ shelter: 8, label: '水晶洞穴', labelEn: 'Crystalline Cavern', code: '08514' }),
})
export const CAMP_RECORD_KEYS = Object.freeze(Object.keys(CAMP_SHELTER))

/** 从战役记录读取当前营地庇护值（谁设了营地记录就是谁；优先取庇护值最高者避免脏记录歧义）。 */
export function campShelterFromRecords (records = {}) {
  let found = null
  for (const [key, spec] of Object.entries(CAMP_SHELTER)) {
    if (records[key] === true) {
      if (!found || spec.shelter > found.shelter) found = { key, ...spec }
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// 记录键 / 类型 / 默认值 / 标签
// ---------------------------------------------------------------------------

// Key.hs 的 56 项：boolean（`record`）与 string[]（`recordSetInsert`）按参考实现归组。
const BOOLEAN_RECORDS = Object.freeze([
  // 9 位伙伴的心魔（Fatal Mirage 强化面解锁前置）
  'claypoolHasConfrontedHisDemons', 'cookieHasConfrontedHisDemons', 'danforthHasConfrontedHisDemons',
  'drKenslerHasConfrontedHerDemons', 'drSinhaHasConfrontedHerDemons', 'dyerHasConfrontedHisDemons',
  'eliyahHasConfrontedHisDemons', 'ellsworthHasConfrontedHisDemons', 'takadaHasConfrontedHerDemons',
  // 肯斯勒研究线
  'drKenslerHasAPlan', 'drKenslerIsOnTheVergeOfUnderstanding',
  'drKenslerIsSharingHerResearchWithYou', 'drKenslerUnderstandsTheTrueNatureOfTheMiasma',
  // 剧情结果
  'theFacilityWasDestroyed', 'theInvestigatorsConvincedDyerToAllowTheExpedition',
  'theInvestigatorsDidNotBelieveDyersReport', 'theInvestigatorsScoutedTheCityOutskirts',
  'theInvestigatorsScoutedTheForkedPass', 'theInvestigatorsScoutedTheMountainPass',
  'theNamelessMadnessEscaped', 'theNamelessMadnessIsContainedSafelyWithinItsHostForNow',
  'theSealWasUsedImproperly', 'theTeamBarelyEscapedTheIceShelf', 'theTeamClimbedToTheSummit',
  'theTeamDefeatedTheHuntingCreatures', 'theTeamDiscoveredAnAncientVault',
  'theTeamEscapedTheFacility', 'theTeamFledToTheMountains', 'theTeamFoundAnotherWayThroughTheMountains',
  'theTeamFoundTheHiddenTunnel', 'theTeamPhotographedTheAstronomicalCharts', 'theTeamReadTheMap',
  'theTeamStudiedTheMuralCarvings', 'theTeamWasGuidedToTheHiddenTunnel',
  'theTruthOfTheMirageEludesYou', 'wasKilledInThePlaneCrash',
])
const STRING_ARRAY_RECORDS = Object.freeze([
  'locationsRevealed', 'memoriesBanished', 'memoriesDiscovered',
  'sealsPlaced', 'sealsRecovered', 'suppliesRecovered', 'theSurvivorsOfTheExpeditionWere',
])
// 流程层需要、但 Key.hs 未单列的记录（全部落在 recordSchema，跨章持久；命名以 eote 前缀区分）。
const FLOW_RECORDS = Object.freeze([
  ['eoteShelterValue', 'number'], // 检查点 I 用的当前营地庇护值快照
  ['eoteMissingCount', 'number'], // 检查点 I 失踪人数
  ['eoteMissingPartners', 'string[]'], // 检查点 I 失踪伙伴卡号
  ['eoteEliminatedPartners', 'number'], // 幕间同步：已被划去的伙伴数
  ['eoteCheckedPartners', 'string[]'], // 幕间已查看的伙伴卡号
  ['eoteInterludeXp', 'number'], // 幕间累计发放的奖励经验
  ['eoteFatalMirageEntries', 'number'], // 进入《致命幻景》的次数
  ['eotePartnerStatuses', 'string[]'], // 伙伴状态镜像（`code:status`，存档/审计可读）
])

// 章节专用记录（章节 behavior/manifest 读写的簿记；类型按实际写入值）。
const EOTE_CHAPTER_RECORDS = Object.freeze([
  ['iceAndDeathPart1Resolution', 'string'], ['iceAndDeathPart1CampShelter', 'number'],
  ['iceAndDeathPart2Resolution', 'string'], ['partnerResult08714', 'string'],
  ['shelterValue', 'number'], ['iceAndDeathPart3Resolution', 'string'],
  ['eidolonsVanquished', 'number'], ['seepingNightmaresEnded', 'boolean'],
  ['partnersFacedInnerDemon', 'string[]'], ['fatalMirageResolution', 'string'],
  ['fatalMirageTimes', 'number'], ['fatalMirageCompleted', 'boolean'],
  ['resolutePartners', 'string[]'], ['xp', 'number'],
  ['theTeamStudiedTheHistoryOfTheElderThings', 'boolean'],
  ['theTeamDiscernedTheOriginOfTheShoggoths', 'boolean'],
  ['theTeamDiscoveredAHiddenPower', 'boolean'],
])

/** 战役记录 schema：`{ key: 'boolean' | 'number' | 'string[]' }`（直接合入 manifest.recordSchema）。 */
export const recordSchema = Object.freeze({
  ...Object.fromEntries(EOTE_CHAPTER_RECORDS),
  ...Object.fromEntries(Object.keys(CAMP_SHELTER).map(key => [key, 'boolean'])),
  ...Object.fromEntries(BOOLEAN_RECORDS.map(key => [key, 'boolean'])),
  ...Object.fromEntries(STRING_ARRAY_RECORDS.map(key => [key, 'string[]'])),
  ...Object.fromEntries(FLOW_RECORDS),
})

/** 引擎初始化用的默认值（与 `setup.js` 的 recordSchema 派生规则一致）。 */
export const recordDefaults = Object.freeze(Object.fromEntries(
  Object.entries(recordSchema).map(([key, type]) => [key, type === 'boolean' ? false : type === 'number' ? 0 : []])))

/** 记录标签：以 story-text 的 campaign.records 为准，缺失键回退到营地常量或键名。 */
export function recordLabels () {
  const fromStory = recordLabelMap()
  const labels = {}
  for (const key of Object.keys(recordSchema)) {
    if (CAMP_SHELTER[key]) {
      labels[key] = fromStory[key] || `${CAMP_SHELTER[key].label}（庇护 ${CAMP_SHELTER[key].shelter}）`
    } else {
      labels[key] = fromStory[key] || key
    }
  }
  return labels
}

/** 按流程记录读取伙伴状态镜像（`code:status`）。 */
export function partnerStatusesFromRecords (records = {}) {
  const list = Array.isArray(records.eotePartnerStatuses) ? records.eotePartnerStatuses : []
  const map = {}
  for (const entry of list) {
    const [code, status] = String(entry).split(':')
    if (code && status) map[code] = status
  }
  return map
}

/** 与 `partnerStatusesFromRecords` 配对的写入格式（内容层生成 string[]）。 */
export function partnerStatusEntries (roster = []) {
  return roster
    .filter(entry => entry && entry.code && entry.status)
    .map(entry => `${entry.code}:${entry.status}`)
}
