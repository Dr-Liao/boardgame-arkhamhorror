import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../../../lib/server.js'
import gobang from '../../gobang/index.js'
import ox from '../../ox/index.js'

test('P0 边界：未加载 Arkham Mod 时大厅仍提供其他游戏', async () => {
  const server = createServer({ mods: [gobang, ox], persist: false })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await server.ready
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/catalog`)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.deepEqual(body.games.map(game => game.id).sort(), ['gobang', 'ox'])
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
