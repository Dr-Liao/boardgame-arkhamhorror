// 08587 威廉·戴尔教授 · 坚毅伙伴
import { partnerHealingAbility } from '../_shared/expedition_team/_shared.js'

export default {
  code: '08587', scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 3, usesType: 'secrets',
  abilities: [partnerHealingAbility('free', 'horror', '秘密')],
}
