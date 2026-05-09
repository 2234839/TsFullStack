/** 单位类别 */
export type UnitCategory = 'length' | 'mass' | 'area' | 'volume' | 'temperature' | 'time';

/** 单位定义 */
export interface UnitDef {
  /** 单位名称（用于匹配输入） */
  name: string;
  /** 单位别名 */
  aliases: string[];
  /** 所属类别 */
  category: UnitCategory;
  /** 转换到基准单位的系数（温度类特殊处理） */
  toBase: (value: number) => number;
  /** 从基准单位转换回来 */
  fromBase: (value: number) => number;
}

const lengthUnits: UnitDef[] = [
  { name: 'mm', aliases: ['millimeter', 'millimeters'], category: 'length', toBase: (v) => v * 0.001, fromBase: (v) => v * 1000 },
  { name: 'cm', aliases: ['centimeter', 'centimeters'], category: 'length', toBase: (v) => v * 0.01, fromBase: (v) => v * 100 },
  { name: 'dm', aliases: ['decimeter', 'decimeters'], category: 'length', toBase: (v) => v * 0.1, fromBase: (v) => v * 10 },
  { name: 'm', aliases: ['meter', 'meters'], category: 'length', toBase: (v) => v, fromBase: (v) => v },
  { name: 'km', aliases: ['kilometer', 'kilometers'], category: 'length', toBase: (v) => v * 1000, fromBase: (v) => v * 0.001 },
  { name: 'inch', aliases: ['in', 'inches'], category: 'length', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
  { name: 'ft', aliases: ['feet', 'foot'], category: 'length', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
  { name: 'yd', aliases: ['yard', 'yards'], category: 'length', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
  { name: 'mi', aliases: ['mile', 'miles'], category: 'length', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
  { name: '里', aliases: ['li'], category: 'length', toBase: (v) => v * 500, fromBase: (v) => v / 500 },
  { name: '丈', aliases: ['zhang'], category: 'length', toBase: (v) => v * 10 / 3, fromBase: (v) => v * 3 / 10 },
  { name: '尺', aliases: ['chi'], category: 'length', toBase: (v) => v * 10 / 30, fromBase: (v) => v * 30 / 10 },
  { name: '寸', aliases: ['cun'], category: 'length', toBase: (v) => v * 10 / 300, fromBase: (v) => v * 300 / 10 },
];

const massUnits: UnitDef[] = [
  { name: 'mg', aliases: ['milligram', 'milligrams'], category: 'mass', toBase: (v) => v * 0.000001, fromBase: (v) => v * 1000000 },
  { name: 'g', aliases: ['gram', 'grams'], category: 'mass', toBase: (v) => v * 0.001, fromBase: (v) => v * 1000 },
  { name: 'kg', aliases: ['kilogram', 'kilograms'], category: 'mass', toBase: (v) => v, fromBase: (v) => v },
  { name: 't', aliases: ['ton', 'tons', 'tonne', 'tonnes'], category: 'mass', toBase: (v) => v * 1000, fromBase: (v) => v * 0.001 },
  { name: 'lb', aliases: ['pound', 'pounds'], category: 'mass', toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
  { name: 'oz', aliases: ['ounce', 'ounces'], category: 'mass', toBase: (v) => v * 0.0283495, fromBase: (v) => v / 0.0283495 },
  { name: '斤', aliases: ['jin'], category: 'mass', toBase: (v) => v * 0.5, fromBase: (v) => v * 2 },
  { name: '两', aliases: ['liang'], category: 'mass', toBase: (v) => v * 0.05, fromBase: (v) => v * 20 },
];

const areaUnits: UnitDef[] = [
  { name: 'mm2', aliases: ['mm²'], category: 'area', toBase: (v) => v * 0.000001, fromBase: (v) => v * 1000000 },
  { name: 'cm2', aliases: ['cm²'], category: 'area', toBase: (v) => v * 0.0001, fromBase: (v) => v * 10000 },
  { name: 'm2', aliases: ['m²'], category: 'area', toBase: (v) => v, fromBase: (v) => v },
  { name: 'km2', aliases: ['km²'], category: 'area', toBase: (v) => v * 1000000, fromBase: (v) => v * 0.000001 },
  { name: 'acre', aliases: ['acres'], category: 'area', toBase: (v) => v * 4046.86, fromBase: (v) => v / 4046.86 },
  { name: 'ha', aliases: ['hectare', 'hectares'], category: 'area', toBase: (v) => v * 10000, fromBase: (v) => v / 10000 },
];

const volumeUnits: UnitDef[] = [
  { name: 'ml', aliases: ['milliliter', 'milliliters', 'mL'], category: 'volume', toBase: (v) => v * 0.001, fromBase: (v) => v * 1000 },
  { name: 'L', aliases: ['l', 'liter', 'liters', 'litre', 'litres'], category: 'volume', toBase: (v) => v, fromBase: (v) => v },
  { name: 'gallon', aliases: ['gal', 'gallons'], category: 'volume', toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
  { name: 'cup', aliases: ['cups'], category: 'volume', toBase: (v) => v * 0.236588, fromBase: (v) => v / 0.236588 },
];

/** 温度转换是仿射的，不是简单的乘法 */
const temperatureUnits: UnitDef[] = [
  { name: '°C', aliases: ['celsius', 'C', 'degC'], category: 'temperature', toBase: (v) => v, fromBase: (v) => v },
  { name: '°F', aliases: ['fahrenheit', 'F', 'degF'], category: 'temperature', toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
  { name: 'K', aliases: ['kelvin'], category: 'temperature', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
];

const timeUnits: UnitDef[] = [
  { name: 'ms', aliases: ['millisecond', 'milliseconds'], category: 'time', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
  { name: 's', aliases: ['sec', 'second', 'seconds'], category: 'time', toBase: (v) => v, fromBase: (v) => v },
  { name: 'min', aliases: ['minute', 'minutes'], category: 'time', toBase: (v) => v * 60, fromBase: (v) => v / 60 },
  { name: 'h', aliases: ['hr', 'hour', 'hours'], category: 'time', toBase: (v) => v * 3600, fromBase: (v) => v / 3600 },
  { name: 'day', aliases: ['days'], category: 'time', toBase: (v) => v * 86400, fromBase: (v) => v / 86400 },
];

/** 所有单位定义 */
const ALL_UNITS: UnitDef[] = [
  ...lengthUnits,
  ...massUnits,
  ...areaUnits,
  ...volumeUnits,
  ...temperatureUnits,
  ...timeUnits,
];

/** 按名称查找单位（不区分大小写，仅对英文有效） */
export function findUnit(name: string): UnitDef | undefined {
  return ALL_UNITS.find(
    (u) => u.name === name || u.aliases.includes(name) || u.name.toLowerCase() === name.toLowerCase(),
  );
}

/** 获取所有可识别的单位名称（用于 tokenizer） */
export function getUnitNames(): string[] {
  const names: string[] = [];
  for (const u of ALL_UNITS) {
    names.push(u.name);
    for (const alias of u.aliases) {
      names.push(alias);
    }
  }
  /** 按长度降序排列，确保长名称优先匹配 */
  names.sort((a, b) => b.length - a.length);
  return names;
}

/** 获取同类别单位名称列表（用于单位转换结果格式化） */
export function getUnitByName(name: string): UnitDef | undefined {
  return findUnit(name);
}
