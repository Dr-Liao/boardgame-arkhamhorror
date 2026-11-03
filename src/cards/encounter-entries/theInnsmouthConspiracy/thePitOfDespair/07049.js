import { keysAt, keyedFlashbackAbility } from '../../_shared.js'
export default {
  code: '07049', scope: 'location', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'turnEnded', label: '鱼骸坑：回合在此结束且未持有钥匙，受到1点恐惧',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, inv, source, context }) => context.seat === inv.seat && inv.location === source.id
      && keysAt(state, `investigator:${inv.seat}`).length === 0,
    resolve: ({ inv, api }) => api.horror(inv.seat, 1),
  }, keyedFlashbackAbility({ key: 'red', flashback: 'flashback3', label: '持有红色钥匙且线索已清空：阅读记忆闪回III' })],
}
