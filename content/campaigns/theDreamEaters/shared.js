// 食梦者（The Dream Eaters）· 战役共享常量（M0 / catalog-only 基线）。
//
// 本文件只登记 M0 能被工具复算的那部分战役事实：8 章清单、两条线（part）与 4 个章对、
// 20 个遭遇组（8 章节组 + 12 共享组）、四种开局模式、5 位正式调查员。
// 剧情正文、55 个记录键、两袋混乱袋、三幕间与 16 段尾声属于 P8
// （story-text.js / record-labels.js / tde-chaos.js / interludes.js），这里不预建空模块。
//
// 口径：docs/tde-migration-roadmap.md §1.1–§1.4.1；卡面事实源是 src/cards/cards-data.js。
// `encounterCode` 是卡池里的原始组名（snake_case，来自卡面 encounterCode 字段），
// `id` 是内容目录使用的 camelCase 名；两者的一一对应由 tools/scan-tde-scope.mjs 核对。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'theDreamEaters'
export const CAMPAIGN_NAME = 'The Dream Eaters'
export const CAMPAIGN_NAME_ZH = '食梦者'

// 两条线：A 梦寻（The Dream-Quest）/ B 梦网（The Web of Dreams）。
// 产品口径每座位只建一套牌组，线归属落 campaign.seatParts（§1.4.1）。
export const PARTS = Object.freeze({
  A: Object.freeze({ id: 'A', name: '梦寻', nameEn: 'The Dream-Quest' }),
  B: Object.freeze({ id: 'B', name: '梦网', nameEn: 'The Web of Dreams' }),
})

// 8 章按「平行章对」交错排列（A1 → B1 → A2 → B2 …），与参考实现声明序一致，
// 便于 M3 按章对复用同一批机制与原语（§1.2）。code 是章节参考卡的原卡号。
export const chapters = Object.freeze([
  {
    id: 'beyondTheGatesOfSleep', code: '06039', name: '梦境门外', nameEn: 'Beyond the Gates of Sleep',
    part: 'A', pair: 1, packCode: 'tde', encounterCode: 'beyond_the_gates_of_sleep',
  },
  {
    id: 'wakingNightmare', code: '06063', name: '清醒噩梦', nameEn: 'Waking Nightmare',
    part: 'B', pair: 1, packCode: 'tde', encounterCode: 'waking_nightmare',
  },
  {
    id: 'theSearchForKadath', code: '06119', name: '寻觅卡达斯', nameEn: 'The Search for Kadath',
    part: 'A', pair: 2, packCode: 'sfk', encounterCode: 'the_search_for_kadath',
  },
  {
    id: 'aThousandShapesOfHorror', code: '06168', name: '万千骇形', nameEn: 'A Thousand Shapes of Horror',
    part: 'B', pair: 2, packCode: 'tsh', encounterCode: 'a_thousand_shapes_of_horror',
  },
  {
    id: 'darkSideOfTheMoon', code: '06206', name: '月之暗面', nameEn: 'Dark Side of the Moon',
    part: 'A', pair: 3, packCode: 'dsm', encounterCode: 'dark_side_of_the_moon',
  },
  {
    id: 'pointOfNoReturn', code: '06247', name: '无归之地', nameEn: 'Point of No Return',
    part: 'B', pair: 3, packCode: 'pnr', encounterCode: 'point_of_no_return',
  },
  {
    id: 'whereTheGodsDwell', code: '06286', name: '神居之所', nameEn: 'Where the Gods Dwell',
    part: 'A', pair: 4, packCode: 'wgd', encounterCode: 'where_the_gods_dwell',
  },
  {
    id: 'weaverOfTheCosmos', code: '06333', name: '编织宇宙', nameEn: 'Weaver of the Cosmos',
    part: 'B', pair: 4, packCode: 'woc', encounterCode: 'weaver_of_the_cosmos',
  },
])

export const PAIR_COUNT = 4
export const MODES = Object.freeze(['singleA', 'singleB', 'pick', 'parallel'])

// 12 个循环共享遭遇组（卡池 encounterCode，按字母序稳定排列）。
// 中文名属 P8 的剧情/规则书文案，这里只留英文印刷名，避免自造译名。
export const SHARED_ENCOUNTER_GROUPS = Object.freeze([
  { id: 'agentsOfAtlachNacha', encounterCode: 'agents_of_atlach_nacha', nameEn: 'Agents of Atlach-Nacha' },
  { id: 'agentsOfNyarlathotep', encounterCode: 'agents_of_nyarlathotep', nameEn: 'Agents of Nyarlathotep' },
  { id: 'corsairs', encounterCode: 'corsairs', nameEn: 'Corsairs' },
  { id: 'creaturesOfTheUnderworld', encounterCode: 'creatures_of_the_underworld', nameEn: 'Creatures of the Underworld' },
  { id: 'descentIntoThePitch', encounterCode: 'descent_into_the_pitch', nameEn: 'Descent into the Pitch' },
  { id: 'dreamersCurse', encounterCode: 'dreamers_curse', nameEn: "Dreamer's Curse" },
  { id: 'dreamlands', encounterCode: 'dreamlands', nameEn: 'Dreamlands' },
  { id: 'mergingRealities', encounterCode: 'merging_realities', nameEn: 'Merging Realities' },
  { id: 'spiders', encounterCode: 'spiders', nameEn: 'Spiders' },
  { id: 'terrorOfTheVale', encounterCode: 'terror_of_the_vale', nameEn: 'Terror of the Vale' },
  { id: 'whispersOfHypnos', encounterCode: 'whispers_of_hypnos', nameEn: 'Whispers of Hypnos' },
  { id: 'zoogs', encounterCode: 'zoogs', nameEn: 'Zoogs' },
])

// 20 个遭遇组 = 8 章节组 + 12 共享组；章节组的 id 与章节目录 id 相同。
export const ENCOUNTER_GROUP_IDS = Object.freeze([
  ...chapters.map(chapter => chapter.id),
  ...SHARED_ENCOUNTER_GROUPS.map(group => group.id),
])

// 内容侧 id → 卡池 encounterCode 的反查表（scope 账本与遭遇组目录都用它）。
export const ENCOUNTER_GROUP_CODES = Object.freeze(Object.fromEntries([
  ...chapters.map(chapter => [chapter.id, chapter.encounterCode]),
  ...SHARED_ENCOUNTER_GROUPS.map(group => [group.id, group.encounterCode]),
]))

// 5 位正式调查员（五职业各 1）；专属卡与关联面登记在调查员包 manifest。
export const INVESTIGATOR_CODES = Object.freeze(['06001', '06002', '06003', '06004', '06005'])

export const chapterIdsByPart = part => chapters.filter(chapter => chapter.part === part).map(chapter => chapter.id)
export const pairChapters = pair => chapters.filter(chapter => chapter.pair === pair).map(chapter => chapter.id)

export { CONTENT_SCHEMA_VERSION }
