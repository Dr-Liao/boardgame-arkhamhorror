import { keyedFlashbackAbility } from '../../_shared.js'

export default {
  code: '07242', scope: 'location',
  locationRule: { floodBounds: { min: 0, max: 1 } },
  abilities: [keyedFlashbackAbility({ key: 'white', requiresNoClues: false, flashback: 'flashback12', label: '猎鹰岬崖边：白色钥匙，记忆闪回XII' })],
}
