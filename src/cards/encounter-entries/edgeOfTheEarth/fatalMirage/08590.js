// 08590 玛拉·辛哈医生 · 坚毅伙伴
import { partnerHealingAbility } from '../_shared/expedition_team/_shared.js'

export default {
  code: '08590', scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 3, usesType: 'supplies',
  abilities: [partnerHealingAbility('free', 'damage', '补给')],
}
