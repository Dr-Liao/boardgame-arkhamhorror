import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { recordsFor } from '../../encounter-rules.js'
import { TCU_STORY_TEXT } from '../../story-text.js'
import { WITCHING_HOUR_DIVINATION } from '../../tarot.js'

// 队长介绍 2 的两张战役卡（不计入牌组张数）。
export const CAMPAIGN_CARDS = Object.freeze({ towerXVI: '05042', aceOfRods: '05040' })

const witchingHourIntro = TCU_STORY_TEXT.introductions.theWitchingHour

function presentIntroSection(api, section, code) {
  api.present?.(witchingHourIntro.sections[section].join('\n\n'), {
    kind: 'story', title: '故事导入', name: witchingHourIntro.title, code, intro: true,
  }, { log: false })
}

export function preScenarioSetup(state, events, api) {
  const flags = (state.scenarioFlags ||= {})
  if (flags.introResolved) return
  flags.introResolved = true
  const records = recordsFor(state)
  const lead = state.campaign?.leadSeat ?? 0
  presentIntroSection(api, 'intro1', CAMPAIGN_CARDS.towerXVI)
  const fate = api.choose({
    kind: 'story', source: '05050-intro', seat: lead,
    prompt: '介绍 1：安娜翻出破旧的高塔·XVI。你要如何面对命运？',
    options: [
      { id: 'avoidFate', label: '「我怎样才能避免这样的命运呢？」' },
      { id: 'bullshit', label: '「一派胡言」' },
    ],
  })
  if (fate === 'bullshit') {
    presentIntroSection(api, 'intro3', CAMPAIGN_CARDS.towerXVI)
    records.youHaveRejectedYourFate = true
    // 混乱袋此时尚未由 setupChaosBag 重建（initializeChaosBag 会覆盖 state.chaosBag），
    // 因此先记录 flag，在 afterChaosBagSetup 里真正加入。
    flags.fateChaosToken = 'elderthing'
    api.info?.('安娜笑了：「塔罗牌只会揭示和建议，不会影响，也不会强加。」记录「你拒绝了自己的命运」，混乱袋加入 2 个古神标记。')
    return
  }
  presentIntroSection(api, 'intro2', CAMPAIGN_CARDS.aceOfRods)
  records.youHaveAcceptedYourFate = true
  flags.fateChaosToken = 'tablet'
  api.info?.('「别犹豫。别后悔。机会来临的时候，你必须行动起来改变命运。」记录「你接受了自己的命运」，混乱袋加入 2 个石板标记。')
  // 队长把「高塔·XVI」和「权杖王牌」加入牌组（不占 30 张）。
  const campaign = state.campaign
  const record = campaign?.investigators?.[lead]
  for (const code of [CAMPAIGN_CARDS.towerXVI, CAMPAIGN_CARDS.aceOfRods]) {
    if ((record?.deck || []).includes(code)) continue
    campaignCardChange(campaign, lead, code, 'add', '巫异时刻介绍2')
  }
  api.info?.('队长从收藏中找出「高塔·XVI」与「权杖王牌」加入牌组（不计入牌组张数）。')
  // 重返版的 8 张固定 Campaign Reading（原版没有；P8 作为垂直切片保留）。
  const reading = api.choose({
    kind: 'story', source: '05050-tarot', seat: lead, canSkip: true,
    prompt: '是否进行 8 张固定顺序的战役占卜（重返版规则）？',
    options: [
      { id: 'takeCards', label: '获得「高塔·XVI」和「权杖王牌」' },
      { id: 'performTarotReading', label: '进行战役占卜' },
    ],
  })
  if (reading === 'performTarotReading') {
    flags.campaignReading = WITCHING_HOUR_DIVINATION.map(entry => ({ ...entry }))
    api.info?.(`🔮 战役占卜：${flags.campaignReading.map(entry => `${entry.scenarioName}「${entry.arcanaName}」`).join('·')}。`)
  }
}
