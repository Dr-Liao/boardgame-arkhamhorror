// 07252b 拘禁室（Holding Cells）· 地点（剧情卡 07252 的背面）· TIC 第六章《雾中之光》
//
// 印刷（中文）：
//   拘禁室不能被淹没。
//   敌人不能进入或生成在拘禁室(如果将有敌人生成在此，改为将其生成在任意沉没岩洞)。
//   [action]：检定[combat](3)以扭断铁条或[agility](3)以撬锁开门。如果你控制黄色钥匙，本次
//   检定自动成功。如果你检定成功，解救此处一位被俘的调查员。
//
// 印刷（English）：
//   Holding Cells cannot be flooded.
//   Enemies cannot enter or spawn at Holding Cells (if one would spawn here, spawn it at any
//   Sunken Grotto instead).
//   [action]: Test [combat] (3) to break the bars or [agility] (3) to pick the locks. If you
//   control the yellow key, this test automatically succeeds. If you succeed, free an investigator
//   who is captured here.
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07252b.js
//
// 引擎读点：
//   · 「不能被淹没」= locationRule.floodBounds {min:0,max:0} → src/engine/flood.js 的
//     activeFloodBounds / canChangeFloodLevel / setFloodLevel（07040/07239 同模式；章节数据也声明了
//     07252b 的 waterBounds，两处一致）。
//   · 「敌人不能进入/生成」= locationRule.enemiesCannotEnter → enemy-entry.js#enemyCanEnterLocation
//     （移动 / 猎人 / 追逐 / 生成校验共用）；生成落点被挡时 enemies.js#spawnEnemy 读
//     locationRule.enemySpawnRedirect 改到任意沉没岩洞（07244/45/46 已入场者，多位候选由领队选）。
//   · [action] 行动描述子 → parley.js#parleyMovesFor → doEntityAbility（消耗 1 行动）：
//     被俘者名单走 api.scenario.capturedAt(本地点 id)（capture.js 只读查询），解救走
//     api.scenario.freeCaptured(seat)（唯一写入口）；控制黄色钥匙 = keysAt(investigator:<seat>)
//     含 'yellow'，此时不掷骰直接成功（等价参考实现 SkillTestAutomaticallySucceeds）。
//   · 「此处」= 本地点实例 id（source.id）；被俘者在场时才会出现在合法行动里（criteria）。
//
// implemented: true

import { capturedAtLocation, keysAt } from '../../_shared.js'

const CELLS_CODE = '07252b'

export default {
  code: '07252b', scope: 'location', implemented: true,
  locationRule: {
    floodBounds: { min: 0, max: 0 },
    enemiesCannotEnter: true,
    enemySpawnRedirect: { toOriginalCodes: ['07244', '07245', '07246'], chooser: 'lead' },
  },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: `[action] 破坏铁条（战斗3）或撬锁（敏捷3）：解救此处一位被俘调查员（控制黄色钥匙自动成功）`,
    criteria: ({ state, source }) => capturedAtLocation(state, source.id).length > 0,
    resolve: ({ state, inv, source, api }) => {
      const captured = capturedAtLocation(state, source.id)
      if (!captured.length) return
      // 多位被俘者：由行动者选一位（印刷「free an investigator who is captured here」）。
      let target = captured[0]
      if (captured.length > 1) {
        const answer = api.choose({
          kind: 'investigator', source: `${CELLS_CODE}:free`, seat: inv.seat,
          prompt: '选择要解救的被俘调查员。',
          options: captured.map(seat => ({ id: String(seat), label: state.investigators[seat]?.name || `座位 ${seat}` })),
        })
        target = captured.includes(Number(answer)) ? Number(answer) : captured[0]
      }
      const free = () => api.scenario.freeCaptured(target)
      // 「如果你控制黄色钥匙，本次检定自动成功」：直接成功，不开始检定（与参考实现一致，
      // 避免替换标记/投入等窗口改变结果）。
      if (keysAt(state, `investigator:${inv.seat}`, { reveal: true }).includes('yellow')) {
        api.info?.(`🔑 ${inv.name} 控制黄色钥匙：破坏铁条/撬锁自动成功。`)
        free()
        return
      }
      const skill = api.choose({
        kind: 'skill', source: CELLS_CODE, seat: inv.seat,
        prompt: '扭断铁条（战斗 3）还是撬锁（敏捷 3）？',
        options: [{ id: 'combat', label: '战斗 3（扭断铁条）' }, { id: 'agility', label: '敏捷 3（撬锁）' }],
      })
      const chosen = skill === 'agility' ? 'agility' : 'combat'
      api.test(inv.seat, chosen, 3, {
        source: { type: 'scenario', code: CELLS_CODE, name: source.name, ability: true },
        target: { kind: 'location', id: source.id },
        resolve: result => { if (result.success) free() },
      })
    },
  }],
}
