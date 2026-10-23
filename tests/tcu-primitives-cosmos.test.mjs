// 万象无终（TCU）第 2 步 P2.13 原语验收：Cosmos / 未知地点牌库。
//
// 覆盖路线图 §4.1 的必测项：建堆、抽取、洗回、地点搬移、存档。
// 牌库里装的是**关卡地点定义 id**（placeLocation 的入参）；抽 X 选 1，未选中的放回牌库底；
// Void/虚空地点可以洗回；放置时把原地点上的调查员与敌人一起搬过去（运行时接口负责搬移）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './core-fixture.mjs';
import {
  EXTRA_LOCATION_DECKS, buildScenarioLocationDeck, chooseScenarioLocationDeck, discardScenarioLocation,
  drawScenarioLocationDeck, extraLocationDeckId, extraLocationPiles, resetExtraLocationDecks,
  scenarioLocationDeckInfo, shuffleScenarioLocationIntoDeck,
} from '../src/engine/alt-decks.js';
import { campaignProjection } from '../src/cards/campaign-view.js';
import { createScenarioRuntime } from '../src/engine/scenario-runtime.js';

const identity = list => [...list];
const reverse = list => [...list].reverse();

function deckFixture(ids, extra = {}) {
  const state = fixture('01001', 1);
  // 把三个虚拟地点定义挂到剧本数据上（placeLocation 的读点）。
  for (const id of ['cosmos-a', 'cosmos-b', 'cosmos-c']) {
    state.scenario.locations[id] = { id, name: '虚空：' + id, shroud: 3, clues: 1, ...(extra[id] || {}) };
  }
  buildScenarioLocationDeck(state, 'cosmos', ids, { shuffle: identity });
  return { state };
}

test('P2.13 词表与建堆：cosmos/unknownPlaces，去重后按注入洗牌', () => {
  assert.deepEqual([...EXTRA_LOCATION_DECKS], ['cosmos', 'unknownPlaces']);
  assert.equal(extraLocationDeckId('cosmos'), 'cosmos');
  assert.throws(() => extraLocationDeckId('void'), /未知的地点牌库/);
  const state = {};
  const piles = buildScenarioLocationDeck(state, 'cosmos', ['a', 'b', 'a'], { shuffle: reverse });
  assert.deepEqual(piles.deck, ['b', 'a']);
  assert.deepEqual(scenarioLocationDeckInfo(state, 'cosmos'), { deck: 2, discard: [] });
  assert.throws(() => buildScenarioLocationDeck(state, 'cosmos', 'ab'), /地点 id 数组/);
});

test('P2.13 抽取：从牌库顶抽；空了把弃牌堆洗回；两堆都空返回空数组', () => {
  const { state } = deckFixture(['cosmos-a', 'cosmos-b']);
  assert.deepEqual(drawScenarioLocationDeck(state, 'cosmos', 1), ['cosmos-b']);
  assert.deepEqual(scenarioLocationDeckInfo(state, 'cosmos'), { deck: 1, discard: [] });
  assert.deepEqual(drawScenarioLocationDeck(state, 'cosmos', 5), ['cosmos-a']);
  assert.deepEqual(drawScenarioLocationDeck(state, 'cosmos', 1), []);
  discardScenarioLocation(state, 'cosmos', ['cosmos-a']);
  assert.deepEqual(drawScenarioLocationDeck(state, 'cosmos', 1, { shuffle: identity }), ['cosmos-a']);
});

test('P2.13 抽 X 选 1：未选中的放回牌库底，顺序保留', () => {
  const { state } = deckFixture(['cosmos-a', 'cosmos-b', 'cosmos-c']);
  const asked = [];
  const chosen = chooseScenarioLocationDeck(state, 'cosmos', 2, {
    seat: 0,
    requestChoice: (target, request) => { asked.push(request); return 'cosmos-b' },
  });
  assert.equal(chosen, 'cosmos-b');
  assert.equal(asked.length, 1);
  assert.equal(asked[0].kind, 'location');
  // 抽到的是 c、b；b 被选中，c 放回牌库底（unshift），牌库变回 2 张。
  assert.deepEqual(scenarioLocationDeckInfo(state, 'cosmos'), { deck: 2, discard: [] });
  assert.deepEqual(extraLocationPiles(state, 'cosmos').deck, ['cosmos-c', 'cosmos-a']);
  // 只剩一张时直接返回，不再询问。
  assert.equal(chooseScenarioLocationDeck(state, 'cosmos', 1, { requestChoice: () => { throw new Error('should not ask') } }), 'cosmos-a');
  assert.equal(chooseScenarioLocationDeck(state, 'cosmos', 1, { requestChoice: () => 'x' }), 'cosmos-c');
});

test('P2.13 洗回与弃置：Void 地点可洗回牌库', () => {
  const { state } = deckFixture(['cosmos-a', 'cosmos-b']);
  shuffleScenarioLocationIntoDeck(state, 'cosmos', ['cosmos-a'], { shuffle: reverse });
  assert.equal(scenarioLocationDeckInfo(state, 'cosmos').deck, 3);
  discardScenarioLocation(state, 'cosmos', ['cosmos-b']);
  assert.deepEqual(scenarioLocationDeckInfo(state, 'cosmos').discard, ['cosmos-b']);
  resetExtraLocationDecks(state);
  assert.deepEqual(scenarioLocationDeckInfo(state, 'cosmos'), { deck: 0, discard: [] });
});

test('P2.13 存档：牌库与弃牌堆随存档往返，且公开投影只给张数', () => {
  const { state } = deckFixture(['cosmos-a', 'cosmos-b']);
  drawScenarioLocationDeck(state, 'cosmos', 1);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(scenarioLocationDeckInfo(restored, 'cosmos'), { deck: 1, discard: [] });
  // 地点牌库顺序不进入观察投影（放置后的地点才公开）。
  assert.equal('extraLocationDecks' in campaignProjection(state), false);
});

test('P2.13 运行时接口：cosmos 的 build/draw/take/info 都接线', () => {
  const proxy = new Proxy({}, { get: () => () => {} });
  const runtime = createScenarioRuntime(proxy)({}, [], null);
  assert.equal(typeof runtime.cosmos, 'function');
  assert.equal(typeof runtime.locationDeck, 'function');
});
