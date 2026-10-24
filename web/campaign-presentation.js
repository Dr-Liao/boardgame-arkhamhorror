import { scenarioPlaylistId } from './scenario-music.js'

// 单一主题入口（新增循环 / 新视觉风格只改这里）：
//   palette   循环专属的 7 个界面色，由 web/campaign-theme.css 统一映射到控件；
//   materials 刻意不跟随循环的固定材质色（例如羊皮纸上的墨色），仍可按循环覆盖；
//   assets    局外页 / 牌桌 / 剧情插画与音乐。
// 组件 CSS 只消费 --ah-theme-* 与 --ah-material-*，不要另写死主题色。

const ROOT = '/mods/arkhamhorror'
const CARCOSA = `${ROOT}/img/campaigns/thePathToCarcosa`
const FORGOTTEN_AGE = `${ROOT}/img/campaigns/theForgottenAge`
const DUNWICH = `${ROOT}/img/campaigns/theDunwichLegacy`
const NOTZ = `${ROOT}/img/campaigns/nightOfTheZealot`
const CIRCLE = `${ROOT}/img/campaigns/theCircleUndone`

const COMMON = Object.freeze({
  id: 'common',
  palette: Object.freeze({
    background: '#101e1a', panel: '#11251e', header: '#09130f',
    accent: '#dfc58d', accentStrong: '#f2d99b', muted: '#acb7a4', edge: '#b59b604b',
  }),
  materials: Object.freeze({
    // 羊皮纸 / 档案卡上的字是「纸上墨迹」，不随循环换色，保持纯黑可读性。
    paperInk: '#000000',
  }),
  assets: Object.freeze({
    hubHero: `${ROOT}/img/ui/hub-manor.webp`,
    hubDesk: `${ROOT}/img/ui/hub-desk.webp`,
    casefile: `${ROOT}/img/ui/hub-casefile.webp`,
    tableOverlay: `${ROOT}/img/ui/investigation-map.webp`,
    storyDefault: `${ROOT}/img/ui/hub-manor.webp`,
  }),
  musicPlaylist: 'common',
  scenarios: Object.freeze({}),
})

const CAMPAIGNS = Object.freeze({
  theCircleUndone: Object.freeze({
    id: 'theCircleUndone',
    palette: Object.freeze({
      background: '#17131e', panel: '#241e2d', header: '#100e16',
      accent: '#c7b6d6', accentStrong: '#e7d5ef', muted: '#ada3b8', edge: '#a38ab266',
    }),
    assets: Object.freeze({
      hubHero: `${CIRCLE}/scenarios/disappearanceAtTheTwilightEstate/scene.webp`,
      tableOverlay: `${CIRCLE}/table/investigation-desk.webp`,
      storyDefault: `${CIRCLE}/scenarios/disappearanceAtTheTwilightEstate/scene.webp`,
    }),
    musicPlaylist: 'theCircleUndone',
    scenarios: Object.freeze(Object.fromEntries([
      'disappearanceAtTheTwilightEstate', 'theWitchingHour', 'atDeathsDoorstep',
      'theSecretName', 'theWagesOfSin', 'forTheGreaterGood', 'unionAndDisillusion',
      'inTheClutchesOfChaos', 'beforeTheBlackThrone',
    ].map(id => [id, Object.freeze({ assets: Object.freeze({
      storyDefault: `${CIRCLE}/scenarios/${id}/scene.webp`,
    }) })]))),
  }),
  theForgottenAge: Object.freeze({
    id: 'theForgottenAge',
    // 失落时代：翡翠雨林 + 古铜旧纸（原画色板「深翡翠、苔绿、炭黑、古铜、暖琥珀」）。
    palette: Object.freeze({
      background: '#0d1712', panel: '#15251c', header: '#060e0a',
      accent: '#8fc7a8', accentStrong: '#d2ecd6', muted: '#b4ab8d', edge: '#8fc7a866',
    }),
    assets: Object.freeze({
      hubHero: `${FORGOTTEN_AGE}/hub/jungle-temple.webp`,
      tableOverlay: `${FORGOTTEN_AGE}/table/investigation-desk.webp`,
      storyDefault: `${FORGOTTEN_AGE}/hub/jungle-temple.webp`,
    }),
    scenarios: Object.freeze(Object.fromEntries([
      'theUntamedWilds', 'theDoomOfEztli', 'threadsOfFate', 'theBoundaryBeyond',
      'heartOfTheEldersPart1', 'heartOfTheEldersPart2', 'theCityOfArchives',
      'theDepthsOfYoth', 'shatteredAeons', 'turnBackTime',
    ].map(id => [id, Object.freeze({ assets: Object.freeze({
      storyDefault: `${FORGOTTEN_AGE}/scenarios/${id}/scene.webp`,
    }) })]))),
  }),
  theDunwichLegacy: Object.freeze({
    id: 'theDunwichLegacy',
    // 敦威治：褐土乡野 + 雾青（取自敦威治村落与调查桌原画的暖褐/雾青主色）。
    palette: Object.freeze({
      background: '#16130d', panel: '#221d14', header: '#0b0906',
      accent: '#7fc4b1', accentStrong: '#c8ece0', muted: '#b3a98f', edge: '#7fc4b166',
    }),
    assets: Object.freeze({
      hubHero: `${DUNWICH}/hub/dunwich-village.webp`,
      tableOverlay: `${DUNWICH}/table/investigation-desk.webp`,
      storyDefault: `${DUNWICH}/hub/dunwich-village.webp`,
    }),
    musicPlaylist: 'theDunwichLegacy',
    scenarios: Object.freeze(Object.fromEntries([
      'extracurricularActivity', 'theHouseAlwaysWins', 'theMiskatonicMuseum', 'theEssexCountyExpress',
      'bloodOnTheAltar', 'undimensionedAndUnseen', 'whereDoomAwaits', 'lostInTimeAndSpace',
    ].map(id => [id, Object.freeze({ assets: Object.freeze({
      storyDefault: `${DUNWICH}/scenarios/${id}/scene.webp`,
    }) })]))),
  }),
  thePathToCarcosa: Object.freeze({
    id: 'thePathToCarcosa',
    // 卡尔克萨：黑红帷幕 + 黄衣（剧院原画的暗红帷幕与「黄衣之王」的昏黄）。
    palette: Object.freeze({
      background: '#150f13', panel: '#221820', header: '#0a0709',
      accent: '#d9c56a', accentStrong: '#f2e7a4', muted: '#b5a690', edge: '#d9c56a66',
    }),
    assets: Object.freeze({
      hubHero: `${CARCOSA}/hub/theatre.webp`,
      tableOverlay: `${CARCOSA}/table/investigation-desk.webp`,
      storyDefault: `${CARCOSA}/hub/theatre.webp`,
    }),
    musicPlaylist: 'thePathToCarcosa',
    scenarios: Object.freeze(Object.fromEntries([
      'curtainCall', 'theLastKing', 'echoesOfThePast', 'theUnspeakableOath',
      'aPhantomOfTruth', 'thePallidMask', 'blackStarsRise', 'dimCarcosa',
    ].map(id => [id, Object.freeze({ assets: Object.freeze({
      storyDefault: id === 'curtainCall' ? `${CARCOSA}/hub/theatre.webp` : `${CARCOSA}/scenarios/${id}/scene.webp`,
    }) })]))),
  }),
  nightOfTheZealot: Object.freeze({
    id: 'nightOfTheZealot',
    // 夜之狂热：保留基础包原有的墨绿夜色 + 琥珀灯火（按需求继续用绿色 UI）。
    palette: Object.freeze({
      background: '#0b1518', panel: '#102226', header: '#071014',
      accent: '#c99a54', accentStrong: '#efc878', muted: '#91a8a2', edge: '#9c754f66',
    }),
    assets: Object.freeze({
      hubHero: `${NOTZ}/hub/office-hero.webp`,
      tableOverlay: `${NOTZ}/table/investigation-map.webp`,
      storyDefault: `${NOTZ}/story/default.png`,
    }),
    musicPlaylist: 'nightOfTheZealot',
    scenarios: Object.freeze(Object.fromEntries([
      'theGathering', 'theMidnightMasks', 'theDevourerBelow',
    ].map(id => [id, Object.freeze({ assets: Object.freeze({
      storyDefault: `${NOTZ}/scenarios/${id}/scene.webp`,
    }) })]))),
  }),
})

export function campaignPresentation(campaignId, scenarioId = '') {
  const campaign = CAMPAIGNS[campaignId] || {}
  const scenario = campaign.scenarios?.[scenarioId] || {}
  return {
    id: campaign.id || COMMON.id,
    palette: { ...COMMON.palette, ...campaign.palette, ...scenario.palette },
    materials: { ...COMMON.materials, ...campaign.materials, ...scenario.materials },
    assets: { ...COMMON.assets, ...campaign.assets, ...scenario.assets },
    musicPlaylist: scenarioPlaylistId(campaignId, scenarioId) || scenario.musicPlaylist || campaign.musicPlaylist
      || (campaignId === 'theDunwichLegacy' ? 'theDunwichLegacy' : COMMON.musicPlaylist),
  }
}

export function presentationAsset(state, key) {
  return campaignPresentation(state?.campaign?.id, state?.scenario?.id || state?.hubSelectedScenarioId).assets[key]
}

const materialVariable = name => '--ah-material-' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())

export function presentationAttributes(state) {
  const campaignId = state?.campaign?.id || 'common'
  const scenarioId = state?.scenario?.id || state?.hubSelectedScenarioId || ''
  const theme = campaignPresentation(campaignId, scenarioId)
  const color = theme.palette
  return {
    'data-campaign': campaignId,
    'data-scenario': scenarioId || null,
    'data-presentation-theme': theme.id,
    style: {
      '--ah-theme-bg': color.background,
      '--ah-theme-panel': color.panel,
      '--ah-theme-header': color.header,
      '--ah-theme-accent': color.accent,
      '--ah-theme-accent-strong': color.accentStrong,
      '--ah-theme-muted': color.muted,
      '--ah-theme-edge': color.edge,
      ...Object.fromEntries(Object.entries(theme.materials).map(([key, value]) => [materialVariable(key), value])),
      '--ah-table-overlay-image': `url("${theme.assets.tableOverlay}")`,
    },
  }
}

export function campaignPlaylistId(state) {
  // A hub may still carry the previous table state after selecting the next chapter.
  const inHub = ['campaignHub', 'scenarioSetup', 'interlude'].includes(state?.uiState)
  const scenarioId = inHub ? state?.hubSelectedScenarioId || state?.scenario?.id
    : state?.scenario?.id || state?.hubSelectedScenarioId
  return campaignPresentation(state?.campaign?.id, scenarioId).musicPlaylist
}

export const CAMPAIGN_PRESENTATIONS = CAMPAIGNS
