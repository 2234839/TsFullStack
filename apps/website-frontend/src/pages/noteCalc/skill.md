---
name: notecalc
description: 数学表达式计算工具。支持变量赋值、单位转换、等式验证。当用户需要进行数学计算时使用此技能。
---

### 功能
- 基础运算：`1 + 2`、`5 * 10`、`sqrt(16)`
- 变量赋值：`价格 = 99.5`
- 引用变量：`总价 = 价格 * 3`
- 单位转换：`距离 to km`
- 等式验证：`1+2 = 3`
- 数学函数：`sin`、`cos`、`tan`、`log`、`sqrt`、`abs`、`max`、`min`、`pow`
- 支持中文变量名

### API 调用方式

**请求（普通 JSON 数组）：**
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

### iframe 嵌入（可视化展示给用户）
```html
<iframe src="https://tsfullstack.heartstack.space/noteCalc/embed#1 + 2\n价格 = 99.5" width="100%" height="300" />
```

### 参数说明
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| content | string | 必填 | 多行表达式，\n 分隔 |
| precision | number | 64 | 计算精度 |
| showPrecision | number | 4 | 显示精度 |

### 结果类型
| type | 说明 |
|------|------|
| expression | 普通表达式 |
| assignment | 变量赋值 |
| equation | 等式验证（isCorrect 字段） |
| unitConversion | 单位转换 |
| error | 计算错误 |
| normal | 非表达式文本 |
| comment | 注释（// 开头） |
| title/subtitle | 标题（# / ##） |
| empty | 空行 |
