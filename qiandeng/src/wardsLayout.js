// Width runs along the street. The house's +z axis faces its shopfront.
const addresses = []
function street(bank, row, entries) {
  const sign = bank === 'west' ? -1 : 1
  entries.forEach(([z, width, depth, levels, form, name, trade, offset = 0], j) => {
    const quay = row === 0,
      center = [26.6, 39.1, 52.3][row] + offset
    const reversed = (row === 1 && j % 3 === 1) || (row === 2 && j % 4 === 3)
    addresses.push({
      id: addresses.length,
      name,
      trade,
      bank,
      row,
      x: sign * center,
      z,
      w: width,
      d: depth,
      levels,
      form,
      angle: (sign * (reversed ? 1 : -1) * Math.PI) / 2,
      quay,
      phase: (j * 5 + row * 3 + (sign + 1)) % 9,
    })
  })
}
street('west', 0, [
  [8.55, 8.2, 7.6, 2, 'gable', '玉声乐肆', 'music'],
  [18.86, 7.64, 7.35, 2, 'terrace', '漱雨茶肆', 'tea'],
  [28.2, 8.67, 7.7, 2, 'work', '金缕绸庄', 'silk'],
  [40.25, 10.08, 8.1, 3, 'guild', '千灯会馆', 'guild'],
  [50.12, 6.28, 6.88, 2, 'gable', '白瓷雅集', 'ceramics'],
  [60.68, 9.53, 7.95, 2, 'court', '寄星客邸', 'inn'],
  [73.23, 9.78, 7.42, 2, 'terrace', '松茗春坊', 'tea'],
  [-25.18, 8.1, 7.22, 2, 'terrace', '鸣玉香行', 'incense'],
  [-36.75, 7.81, 7.48, 3, 'tower', '镜湖书楼', 'books'],
  [-47.03, 7.06, 7.45, 2, 'work', '九绣钱庄', 'silk'],
  [-56.78, 8.05, 7.52, 2, 'gable', '桂影旅舍', 'inn'],
])
street('east', 0, [
  [8.43, 8.32, 7.98, 2, 'court', '洗月茶楼', 'tea'],
  [19.0, 7.79, 7.77, 1, 'work', '听桨船坊', 'boat'],
  [29.92, 8.36, 7.97, 3, 'stage', '绛绮戏楼', 'stage'],
  [40.91, 8.84, 7.55, 3, 'guild', '百草药楼', 'apothecary'],
  [49.85, 6.4, 7.22, 2, 'gable', '绀碧印绫', 'print'],
  [60.29, 9.63, 7.75, 2, 'terrace', '朝霞酒旗', 'wine'],
  [73.06, 10.03, 8.0, 2, 'work', '竹篾鱼行', 'fish'],
  [-25.13, 8.04, 7.67, 2, 'court', '檀音会所', 'music'],
  [-36.75, 8.38, 7.2, 2, 'gable', '藕花针坊', 'silk'],
  [-47.33, 7.42, 7.7, 3, 'tower', '留云印社', 'books'],
  [-56.75, 7.77, 7.52, 2, 'terrace', '停云行栈', 'inn'],
])
street('west', 1, [
  [8.22, 7.46, 7.22, 1, 'work', '石泉刻坊', 'stone'],
  [24.32, 15.28, 7.1, 2, 'split', '清音琴院', 'music'],
  [44.14, 14.22, 7.35, 2, 'court', '赭石染院', 'print'],
  [60.34, 9.22, 7.71, 2, 'gable', '三余书坊', 'books'],
  [73.12, 9.61, 7.32, 1, 'work', '茶砖旧号', 'tea'],
  [-25.34, 7.73, 7.24, 1, 'work', '素影漆工', 'lacquer'],
  [-36.82, 8.17, 7.22, 2, 'gable', '云鬓钗行', 'jewels'],
  [-51.74, 15.73, 7.55, 2, 'split', '枕霜绣坊', 'silk'],
])
street('east', 1, [
  [8.2, 7.25, 7.48, 2, 'gable', '江南墨馆', 'books'],
  [24.48, 15.6, 7.15, 2, 'split', '桐木舟栈', 'boat'],
  [44.14, 14.63, 7.74, 2, 'court', '小寒药圃', 'apothecary'],
  [60.72, 9.1, 7.23, 2, 'gable', '照影纸伞', 'umbrellas'],
  [73.19, 9.82, 7.69, 1, 'court', '陶土小窑', 'ceramics'],
  [-25.4, 7.71, 7.14, 2, 'gable', '临波靴作', 'leather'],
  [-36.62, 8.05, 7.42, 2, 'terrace', '山鸡绒缎', 'silk'],
  [-51.4, 15.34, 7.67, 2, 'split', '碧筠琴舍', 'music'],
])
street('west', 2, [
  [8.31, 7.6, 8.72, 1, 'court', '西街竹坊', 'bamboo'],
  [24.56, 14.74, 8.6, 2, 'split', '四季作坊', 'lacquer'],
  [44.41, 13.9, 8.35, 2, 'terrace', '珠露香堂', 'incense'],
  [60.63, 9.05, 8.51, 1, 'work', '锦鲤灯坊', 'guild'],
  [73.19, 9.93, 8.8, 2, 'gable', '青瓷藏所', 'ceramics'],
  [-25.36, 7.58, 8.52, 2, 'court', '春水裁铺', 'silk'],
  [-36.72, 8.42, 8.2, 1, 'work', '金线绳行', 'bamboo'],
  [-51.47, 15.02, 8.62, 2, 'split', '丹青画坊', 'print'],
])
street('east', 2, [
  [8.27, 7.6, 8.46, 1, 'work', '巧木轮作', 'bamboo'],
  [24.4, 15.08, 8.83, 2, 'court', '双桂客院', 'inn'],
  [44.38, 14.62, 8.44, 2, 'split', '青篆刻院', 'stone'],
  [60.81, 9.32, 8.9, 1, 'work', '栗香酒坊', 'wine'],
  [73.07, 9.76, 8.58, 2, 'gable', '乌篷篾作', 'boat'],
  [-25.51, 7.63, 8.17, 2, 'gable', '初雪银工', 'jewels'],
  [-36.81, 8.16, 8.68, 1, 'court', '雾柳花圃', 'incense'],
  [-51.53, 15.03, 8.42, 2, 'split', '栖云客院', 'inn'],
])
export const wardAddresses = addresses
export const wardRoofs = addresses.map((h) => ({
  name: h.name,
  bank: h.bank,
  x: h.x,
  z: h.z,
  w: h.w,
  d: h.d,
  angle: h.angle,
  minX: h.x - h.d / 2,
  maxX: h.x + h.d / 2,
  minZ: h.z - h.w / 2,
  maxZ: h.z + h.w / 2,
}))
