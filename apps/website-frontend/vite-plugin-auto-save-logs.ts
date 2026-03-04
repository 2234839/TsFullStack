/**
 * Vite 插件：自动保存前端日志到文件 + 远程执行 JS
 *
 * 在开发模式下：
 * 1. 拦截前端日志并增量追加到 .dev-logs/latest-errors.log
 * 2. 提供远程执行 JS 的功能，AI 可以在页面上执行代码并获取结果
 */

import { appendFileSync, writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import type { Connect } from 'vite';

export function autoSaveLogsPlugin() {
  const logsDir = resolve(process.cwd(), '.dev-logs');
  const logFile = resolve(logsDir, 'latest-errors.log');
  const pendingJsFile = resolve(logsDir, 'pending-js.txt');

  // 确保日志目录存在
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // 启动时清空日志文件（避免累积历史日志）
  if (existsSync(logFile)) {
    writeFileSync(logFile, '', 'utf-8');
  }

  // 清空待执行的 JS 文件
  if (existsSync(pendingJsFile)) {
    unlinkSync(pendingJsFile);
  }

  return {
    name: 'auto-save-logs',
    configureServer(server: any) {
      server.middlewares.use((req: Connect.IncomingMessage, res: any, next: any) => {
        // 保存日志端点
        if (req.url === '/__save_logs') {
          console.log('[AutoSaveLogs] 收到保存日志请求');
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              console.log('[AutoSaveLogs] 请求体:', body);
              const logs = JSON.parse(body);
              console.log('[AutoSaveLogs] 解析后的日志:', logs);
              const formatted = formatLogs(logs);
              /** 追加到文件，而不是覆盖 */
              console.log('[AutoSaveLogs] 格式化后的日志长度:', formatted.length);
              console.log('[AutoSaveLogs] 日志文件路径:', logFile);
              appendFileSync(logFile, formatted, 'utf-8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, file: logFile }));
              console.log(`[AutoSaveLogs] 已追加 ${logs.length} 条日志到 ${logFile}`);
            } catch (error) {
              console.error('[AutoSaveLogs] 保存失败:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(error) }));
            }
          });
          return;
        }

        // 检查是否有待执行的 JS
        if (req.url === '/__check_exec_js') {
          try {
            if (existsSync(pendingJsFile)) {
              const code = readFileSync(pendingJsFile, 'utf-8');
              // 读取后立即删除，避免重复执行
              unlinkSync(pendingJsFile);
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(code);
              console.log('[AutoSaveLogs] 执行远程 JS 请求');
            } else {
              res.writeHead(204); // No Content
              res.end();
            }
          } catch (error) {
            console.error('[AutoSaveLogs] 检查执行 JS 失败:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(error) }));
          }
          return;
        }

        next();
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        // 在所有 HTML 页面中注入开发和调试脚本
        const injectScript = `
<script>
(function() {
  console.log('[DevTools] 开发工具脚本已加载');

  /** ============ 日志收集系统 ============ */
  (function() {
    const maxLogs = 200;
    let logs = [];
    let lastSavedIndex = 0;

    // 拦截全局错误
    window.addEventListener('error', function(event) {
      logs.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: event.message,
        source: event.filename,
        line: event.lineno,
        col: event.colno,
        stack: event.error?.stack,
      });
      if (logs.length > maxLogs) logs.shift();
    });

    window.addEventListener('unhandledrejection', function(event) {
      logs.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: 'Unhandled Promise Rejection: ' + event.reason,
        stack: event.reason?.stack,
      });
      if (logs.length > maxLogs) logs.shift();
    });

    // 拦截 console 方法
    const originals = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error
    };

    function stringify(arg) {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message + '\\n' + arg.stack;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }

    function addLog(type, args) {
      const entry = {
        timestamp: new Date().toISOString(),
        type: type,
        message: Array.from(args).map(stringify).join(' ')
      };
      logs.push(entry);
      if (logs.length > maxLogs) logs.shift();
    }

    console.log = function(...args) {
      addLog('info', args);
      originals.log.apply(console, args);
    };
    console.info = function(...args) {
      addLog('info', args);
      originals.info.apply(console, args);
    };
    console.warn = function(...args) {
      addLog('warning', args);
      originals.warn.apply(console, args);
    };
    console.error = function(...args) {
      addLog('error', args);
      originals.error.apply(console, args);
    };

    // 定期保存到服务器（每秒）
    setInterval(function() {
      if (logs.length > lastSavedIndex) {
        var newLogs = logs.slice(lastSavedIndex);
        if (newLogs.length > 0) {
          originals.log('[LogCollector] 发送', newLogs.length, '条日志到服务器');
          fetch('/__save_logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLogs)
          })
          .then(function() {
            originals.log('[LogCollector] 成功发送', newLogs.length, '条日志');
          })
          .catch(function(err) {
            originals.error('[LogCollector] 发送失败:', err);
          });
          lastSavedIndex = logs.length;
        }
      }
    }, 1000);
  })();

  /** ============ 远程执行 JS 系统 ============ */
  (function() {
    function checkAndExec() {
      fetch('/__check_exec_js')
        .then(r => {
          if (r.status === 200) return r.text();
          return null;
        })
        .then(code => {
          if (code) {
            console.log('[RemoteExec] 执行远程 JS 代码:', code);
            try {
              const result = eval(code);
              console.log('[RemoteExec] 执行结果:', result);
            } catch (error) {
              console.error('[RemoteExec] 执行失败:', error);
            }
          }
        })
        .catch(err => console.error('[RemoteExec] 检查失败:', err));
    }

    // 页面加载完成后启动
    function startRemoteExec() {
      // 立即执行一次，然后每秒检查一次
      checkAndExec();
      setInterval(checkAndExec, 1000);
      console.log('[RemoteExec] 远程执行脚本已启动');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startRemoteExec);
    } else {
      startRemoteExec();
    }
  })();

  console.log('[DevTools] 所有开发工具已就绪');
})();
</script>`;
        console.log('[AutoSaveLogs] 注入开发工具脚本到 HTML');
        return html.replace('</body>', injectScript + '</body>');
      }
    }
  };
}

function formatLogs(logs: any[]): string {
  const header = logs.length > 0 ? `
# 追加时间: ${new Date().toISOString()}
# 新增日志: ${logs.length} 条
${'='.repeat(80)}

` : '';

  const content = logs.map(log => {
    const parts = [
      `[${log.timestamp}]`,
      `[${log.type.toUpperCase()}]`,
    ];
    if (log.source) {
      parts.push(`at ${log.source}:${log.line || '?'}:${log.col || '?'}`);
    }
    parts.push(log.message);
    if (log.stack) {
      parts.push(`\nStack Trace:\n${log.stack}`);
    }
    return parts.join(' ');
  }).join('\n\n' + '-'.repeat(80) + '\n\n');

  return header + content;
}
