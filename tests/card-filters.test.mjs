import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardSource, filterCards } from '../web/card-filters.js'
import { queryCatalogView } from '../src/cards/card-catalog.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
const cards=[
  {code:'a',name:'基础工具',type:'asset',klass:'guardian',cost:0,pack:'core',traitsZh:['工具']},
  {code:'b',name:'扩展工具',type:'asset',klass:'seeker',faction2:'guardian',cost:4,pack:'dwl',traitsZh:['工具']},
  {code:'c',name:'博物馆事件',type:'event',klass:'seeker',cost:2,pack:'tmm'},
  {code:'d',name:'未来卡',type:'skill',cost:null,pack:'future',packName:'未来扩展'},
  {code:'e',name:'卡尔克萨卡牌',type:'skill',cost:1,pack:'ptc',packName:'The Path to Carcosa'},
]
test('按战役合并后续小包，保留精确扩展筛选并支持未知扩展',()=>{
  assert.equal(cardSource(cards[1]).id,cardSource(cards[2]).id)
  assert.deepEqual(filterCards(cards,{campaign:'dwl'}).map(c=>c.code),['b','c'])
  assert.deepEqual(filterCards(cards,{campaign:'dwl',pack:'tmm'}).map(c=>c.code),['c'])
  assert.deepEqual(filterCards(cards,{campaign:'future'}).map(c=>c.code),['d'])
  assert.equal(cardSource(cards[3]).name,'未来扩展')
  assert.equal(cardSource(cards[1]).packName,'敦威治遗产')
  assert.equal(cardSource(cards[4]).packName,'卡尔克萨之路')
})
test('共用筛选取交集，支持中文特性、多职业、零费用及清除恢复',()=>{
  assert.deepEqual(filterCards(cards,{campaign:'dwl',klass:'guardian',type:'asset',cost:'4+',search:'工具'}).map(c=>c.code),['b'])
  assert.deepEqual(filterCards(cards,{cost:'0'}).map(c=>c.code),['a'])
  assert.deepEqual(filterCards(cards,{pack:'core',type:'skill'}),[])
  assert.deepEqual(filterCards(cards,{}),cards)
  assert.deepEqual(filterCards(cards.slice(0,3),{sort:'cost'}).map(c=>c.code),['a','c','b'])
})

test('经验等级筛选保留零级，排除无经验字段并支持五级以上',()=>{
  const pool=[{code:'zero',xp:0},{code:'two',xp:2},{code:'five',xp:5},{code:'six',xp:6},{code:'none',xp:null},{code:'missing'}]
  assert.deepEqual(filterCards(pool,{xp:'0'}).map(c=>c.code),['zero'])
  assert.deepEqual(filterCards(pool,{xp:'2'}).map(c=>c.code),['two'])
  assert.deepEqual(filterCards(pool,{xp:'5+'}).map(c=>c.code),['five','six'])
  assert.equal(filterCards(pool,{}).length,6)
})

test('图鉴与构筑使用相同组合筛选，在分页前筛选并排序完整卡池',()=>{
  const filters={xp:'2',campaign:'core',klass:'guardian',cost:'4+',sort:'name'}
  const expected=filterCards(Object.values(ALL_CARDS),filters)
  assert.ok(expected.length)
  const result=queryCatalogView({...filters,limit:1,offset:1})
  assert.equal(result.total,expected.length)
  assert.deepEqual(result.cards.map(c=>c.code),expected.slice(1,2).map(c=>c.code))
  assert.ok(queryCatalogView({type:'location',limit:1}).total>100)
  assert.equal(queryCatalogView({type:'location',xp:'0'}).total,0)
})
