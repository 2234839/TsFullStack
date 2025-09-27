/**
 * 通过 claude -p "提示词" 的形式来实现文档翻译功能
 */

import { execSync } from 'child_process';

const 需要翻译的文档 = [
  {
    source: 'README_zh.md',
    out: [
      { path: 'README.md', language: 'English' },
      { path: 'README_ja.md', language: 'Japanese' },
      { path: 'README_ko.md', language: 'Korean' },
      { path: 'README_fr.md', language: 'French' },
      { path: 'README_de.md', language: 'German' },
      { path: 'README_es.md', language: 'Spanish' },
    ],
  },
];

async function translateFile(sourcePath: string, outputs: Array<{ path: string; language: string }>) {
  await Promise.all(outputs.map(async (output) => {
    console.log(`开始翻译 ${sourcePath} 到 ${output.language} (${output.path})...`);

    const prompt = `请将文件 ${sourcePath} 翻译成${output.language}，保持原有的格式、代码块、链接和结构不变，只翻译中文内容。

在翻译完成后，请在文档开头添加语言切换链接，请根据以下输出的语言信息自动生成对应的本地化显示文本：
${outputs.map(o => `- ${o.path}: ${o.language}`).join('\n')}

翻译完成后请将结果保存到 ${output.path}`;

    const result = execSync(`claude --permission-mode acceptEdits --add-dir . --allowedTools "Read" "Grep" "Write" -p "${prompt}"`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    console.log(result);
    console.log(`翻译完成: ${output.path}`);
  }));
}

(async () => {
  await Promise.all(需要翻译的文档.map(doc => translateFile(doc.source, doc.out)));
})();