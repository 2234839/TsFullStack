---
name: notecalc
description: 数学表达式计算工具。支持变量赋值、单位转换、等式验证。当用户需要进行数学计算时使用此技能。
---

## 工作流（必须按此顺序执行）

1. **理解用户的计算需求**，按照下方语法规则将问题转化为表达式
2. **调用 API 计算并验算**——确保结果正确后再回复用户
3. **展示结果给用户**——使用截图或 iframe（优先截图，因为多数 AI 助手不支持渲染 iframe）

## 表达式语法

每行写一个表达式，用 `\n` 分隔多行。支持的语法：

### 赋值与变量
```
价格 = 99.5          # 赋值，变量名支持中文
总价 = 价格 * 3       # 引用变量
```

### 运算符
`+` `-` `*` `/` `^`（幂）`%`（取模）

### 数学函数
`sqrt(16)` `abs(-5)` `pow(2,10)` `sin(1)` `cos(1)` `tan(1)` `log(100)` `log2(8)` `log10(100)` `exp(1)` `ceil(3.2)` `floor(3.8)` `round(3.5)` `max(1,2,3)` `min(1,2,3)`

### 常量
`pi` = 3.14159... `e` = 2.71828...

### 单位转换
```
5 kg to g            # 数字+单位 to 目标单位
距离 = 10 km
距离 to m             # 变量 to 目标单位
```
支持的单位类别：长度（mm/cm/m/km/inch/ft/mi/里/丈/尺/寸）、重量（mg/g/kg/t/lb/oz/斤/两）、面积（cm2/m2/km2/acre/ha）、体积（ml/L/gallon）、温度（°C/°F/K）、时间（ms/s/min/h/day）

### 等式验证
```
1 + 2 = 3            # 返回 isCorrect: true
sqrt(16) = 4         # 返回 isCorrect: true
```

### 百分比
```
50%                  # = 0.5
200 * 15%            # = 30
```

### 其他行类型
- `# 标题` / `## 副标题` — 标题
- `// 注释` — 注释，不参与计算
- 空行 — 跳过

## API 调用

**请求：**
```
POST https://tsfullstack.heartstack.space/app-api/noteCalcApi.evaluate
Content-Type: application/json

[{"content":"1 + 2\n价格 = 99.5\n总价 = 价格 * 3"}]
```

**响应（superjson 格式）：**
```json
{"json":{"result":{"results":[
  {"line":"1 + 2","type":"expression","result":"3"},
  {"line":"价格 = 99.5","type":"assignment","result":"99.5","variable":"价格"},
  {"line":"总价 = 价格 * 3","type":"assignment","result":"298.5","variable":"总价"}
]}}}
```

### 结果类型
| type | 说明 |
|------|------|
| expression | 普通表达式 |
| assignment | 变量赋值（variable 字段为变量名） |
| equation | 等式验证（isCorrect 字段） |
| unitConversion | 单位转换 |
| error | 计算错误（error 字段） |
| normal | 非表达式文本 |
| comment | 注释（// 开头） |
| title/subtitle | 标题（# / ##） |
| empty | 空行 |

## 展示结果给用户

### 方式一：网页截图（推荐，AI 助手可直接展示图片）

将计算内容拼入 URL，通过 Microlink 免费截图 API 生成图片：

```
https://api.microlink.io/?url=https://tsfullstack.heartstack.space/noteCalc/embed%23{URLEncoded内容}&screenshot=true&embed=screenshot.url&viewport.width=600&viewport.height=400
```

示例——展示 `1 + 2` 和 `价格 = 99.5`：
```
https://api.microlink.io/?url=https%3A%2F%2Ftsfullstack.heartstack.space%2FnoteCalc%2Fembed%231%20%2B%202%5Cn%E4%BB%B7%E6%A0%BC%20%3D%2099.5&screenshot=true&embed=screenshot.url&viewport.width=600&viewport.height=400
```

注意：hash 中的 `\n` 需要保持为字面量 `%5Cn`（不要编码为真正的换行），多个表达式之间用 `%5Cn` 分隔。

### 方式二：iframe 嵌入（适用于支持 iframe 的环境）

```html
<iframe src="https://tsfullstack.heartstack.space/noteCalc/embed#1 + 2\n价格 = 99.5" width="100%" height="300" />
```

## 参数说明
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| content | string | 必填 | 多行表达式，\n 分隔 |
| showPrecision | number | 4 | 显示精度（小数位数） |
