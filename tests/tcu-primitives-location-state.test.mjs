// 万象无终（TCU）第 2 步 P2.11 原语验收：裂口（Breach）与地点布尔状态（火盆）。
//
// 覆盖路线图 §4.1 的必测项：增减、上限、骷髅值、火盆、UI（公开投影）。
// 两个机制都写在地点实例上（纯 JSON）：breaches 计数器 + flags.brazier 布尔值。

import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './core-fixture.mjs';
import {
  BREACH_LIMIT, LOCATION_FLAGS, addBreach, breachOf, breachTotal, locationFlagOf,
  locationFlagsOf, locationSkullValue, locationStateProjection, normalizeLocationFlag,
  removeBreach, setLocationFlag,
} from '../src/engine/location-state.js';
import { campaignProjection } from '../src/cards/campaign-view.js';

function locationFixture() {
  const state = fixture('01001', 1);
  const location = state.locations.find(item => item.id === state.investigators[0].location);
  return { state, location };
}

test('P2.11 词表：裂口上限 3，地点标记只有 brazier，未知标记立即失败', () => {
  assert.equal(BREACH_LIMIT, 3);
  assert.deepEqual([...LOCATION_FLAGS], ['brazier']);
  assert.equal(normalizeLocationFlag('brazier'), 'brazier');
  assert.throws(() => normalizeLocationFlag('lit'), /未知地点标记/);
  assert.equal(breachOf({}), 0);
  assert.equal(breachOf({ breaches: 2 }), 2);
});

test('P2.11 裂口：增减、上限、缺省与旧存档容错', () => {
  const { state, location } = locationFixture();
  assert.equal(addBreach(state, location.id), 1);
  assert.equal(addBreach(state, location.id, 2), 3);
  assert.equal(addBreach(state, location.id, 5), BREACH_LIMIT);
  assert.equal(breachOf(state.locations.find(item => item.id === location.id)), 3);
  assert.equal(breachTotal(state), 3);
  removeBreach(state, location.id, 2);
  assert.equal(breachTotal(state), 1);
  removeBreach(state, location.id, 5);
  assert.equal('breaches' in state.locations.find(item => item.id === location.id), false);
  assert.equal(addBreach(state, 'no-such-location'), null);
  assert.equal(removeBreach(state, 'no-such-location'), null);
  // 旧存档可能写成字符串或负数。
  assert.equal(breachOf({ breaches: '-2' }), 0);
  assert.equal(breachOf({ breaches: '2' }), 2);
});

test('P2.11 骷髅值：裂口 + 地点上的毁灭标记', () => {
  const { state, location } = locationFixture();
  addBreach(state, location.id, 2);
  const placed = state.locations.find(item => item.id === location.id);
  placed.doom = 1;
  assert.equal(locationSkullValue(state, location.id), 3);
  assert.equal(locationSkullValue(state, 'nowhere'), 0);
});

test('P2.11 火盆：点燃/熄灭是布尔状态，未知标记与未知地点都安全失败', () => {
  const { state, location } = locationFixture();
  assert.equal(locationFlagOf(state.locations.find(item => item.id === location.id), 'brazier'), false);
  assert.equal(setLocationFlag(state, location.id, 'brazier', true), true);
  assert.equal(locationFlagOf(state.locations.find(item => item.id === location.id), 'brazier'), true);
  assert.deepEqual(locationFlagsOf(state.locations.find(item => item.id === location.id)), { brazier: true });
  assert.equal(setLocationFlag(state, location.id, 'brazier', false), false);
  assert.deepEqual(locationFlagsOf(state.locations.find(item => item.id === location.id)), {});
  assert.equal(setLocationFlag(state, 'nowhere', 'brazier', true), null);
  assert.throws(() => setLocationFlag(state, location.id, 'campfire', true), /未知地点标记/);
  assert.throws(() => locationFlagOf({}, 'campfire'), /未知地点标记/);
});

test('P2.11 存档：裂口与标记随存档往返', () => {
  const { state, location } = locationFixture();
  addBreach(state, location.id, 2);
  setLocationFlag(state, location.id, 'brazier', true);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(breachTotal(restored), 2);
  assert.equal(locationFlagOf(restored.locations.find(item => item.id === location.id), 'brazier'), true);
  // 往返后还能继续加。
  assert.equal(addBreach(restored, location.id), 3);
});

test('P2.11 投影：只投影有标记的地点，且都是公开信息', () => {
  const { state, location } = locationFixture();
  // 键名是 `locationStates`，不是 `locations`：观察投影里的 `view.locations` 是地点数组，
  // 同名会把整张地图覆盖成一张 id 表（P5 交互层的真实事故点）。
  assert.equal('locationStates' in campaignProjection(state), false);
  addBreach(state, location.id, 1);
  setLocationFlag(state, location.id, 'brazier', true);
  assert.deepEqual(campaignProjection(state).locationStates, { [location.id]: { breaches: 1, flags: { brazier: true } } });
  assert.deepEqual(locationStateProjection(state), campaignProjection(state).locationStates);
});
