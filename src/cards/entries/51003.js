import { clueAtLocation } from '../../engine/matcher.js'

export default {
  code: '51003',
  playCondition: [{ when: clueAtLocation(), message: '当前地点没有线索' }],
  abilities: [{ kind: 'played', label: '抽取 3 张牌', effect: { type: 'draw', amount: 3 } }],
}
