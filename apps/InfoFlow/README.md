# InfoFlow

我想做一个浏览器扩展项目，能够定时监听网页变化，获取信息内容通过ai整合提示

用户定义规则，比如监听某个网页的某个元素，当该元素内容发生变化时

```typescript
{
  "id": "rule-news",
  "name": "科技新闻监控",
  "target": {
    url: string;
    selector: string[];
  },
  "trigger": {
    "corn": "0 0 * * *", // 每天午夜触发
  },
  "action": {
    "aiPrompt": "用中文总结这篇科技文章的3个关键创新点: {extractedText}",
    "notification": {
      "enabled": true,
      "format": "检测到新文章: {summary}"
    }
  }
}
```
