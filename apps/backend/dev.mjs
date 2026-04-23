/**
 * 开发模式启动脚本
 * 1. 启动 tsdown watch 监听文件变化
 * 2. 编译完成后自动重启 HTTP 服务器
 */
import { spawn, execSync } from 'child_process';

const PORT = 5209;
let serverProcess = null;

/** 杀死占用端口的进程 */
function killPortProcess() {
  try {
    const result = execSync(`lsof -ti:${PORT}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
    if (result) {
      console.log(`[dev] Killing old process on port ${PORT} (PID: ${result})`);
      process.kill(parseInt(result, 10), 'SIGKILL');
    }
  } catch {
    // 没有进程占用端口，忽略
  }
}

/** 杀掉当前服务器子进程 */
function killServer() {
  if (serverProcess) {
    console.log('[dev] Stopping server...');
    serverProcess.kill('SIGKILL');
    serverProcess = null;
  }
}

/** 启动服务器 */
function startServer() {
  killPortProcess();
  console.log('[dev] Starting server...');
  serverProcess = spawn('node', ['--enable-source-maps', './dist/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  serverProcess.on('exit', (code) => {
    console.log(`[dev] Server exited with code ${code}`);
    serverProcess = null;
  });

  serverProcess.on('error', (err) => {
    console.error('[dev] Server error:', err.message);
    serverProcess = null;
  });
}

/** 主流程 */
console.log('[dev] Starting development mode...');

let initialBuildDone = false;

// 启动 tsdown watch，监听编译完成事件（包括首次构建和后续 rebuild）
const tsdown = spawn('npx', ['tsdown', '--watch', '--config', 'tsdown.config.ts'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  env: { ...process.env, CHOKIDAR_USEPOLLING: 'true' },
});

tsdown.stdout?.on('data', (data) => {
  const output = data.toString();
  // 转发到终端
  process.stdout.write(output);
  if (output.includes('Build complete') || output.includes('Rebuilt in') || output.includes('✔ Rebuilt')) {
    if (!initialBuildDone) {
      // 首次构建完成，启动服务器
      initialBuildDone = true;
      startServer();
    } else {
      // 后续 rebuild，重启服务器
      console.log('\n[dev] Code changed, restarting server...');
      killServer();
      setTimeout(startServer, 500);
    }
  }
});

tsdown.on('exit', (code) => {
  console.log(`[dev] tsdown exited with code ${code}`);
  killServer();
  process.exit(code);
});

tsdown.on('error', (err) => {
  console.error('[dev] tsdown error:', err);
  killServer();
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[dev] Shutting down...');
  killServer();
  tsdown.kill('SIGINT');
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  killServer();
  tsdown.kill('SIGTERM');
});
