export const SUSPECTS={ '07076':'RobertFriendly','07077':'ZadokAllen','07078':'BrianBurnham','07079':'BarnabasMarsh','07080':'JoyceLittle','07081':'OtheraGilman' }
export const HIDEOUTS={ '07070':'EsotericOrderOfDagon','07071':'SawboneAlley','07072':'ShorewardSlums','07073':'TheHouseOnWaterStreet','07074':'InnsmouthJail','07075':'NewChurchGreen' }
export const printedRole=(map,value)=>Object.hasOwn(map,value)?value:Object.keys(map).find(code=>map[code]===value)
export const suspectCode=value=>printedRole(SUSPECTS,value)
export const suspectRole=value=>SUSPECTS[suspectCode(value)]
export const hideoutCode=value=>printedRole(HIDEOUTS,value)
export const hideoutRole=value=>HIDEOUTS[hideoutCode(value)]
