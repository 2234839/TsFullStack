import { defineConfig } from 'tsup';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let serverProcess: ReturnType<typeof spawn> | null = null;
const PORT = 5209;

export default defineConfig({
  // 入口文件，根据你的项目结构调整
  entry: ['src/index.ts'],
  // 输出目录
  outDir: 'dist',
  // 生成类型声明文件
  dts: false,
  // 打包格式
  format: 'esm',
  // 代码分割
  splitting: false,
  minify: true,
  // 生成 sourcemap
  sourcemap: true,
  // 清除输出目录
  clean: true,
  // 忽略 watch 的文件,减少文件描述符使用
  ignoreWatch: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist-lib/**',
    '**/dist/**',
    '**/.zenstack/**',
    '**/coverage/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/*.log',
    '**/.env*',
    '**/config.example.json',
    '**/config.json',
    '**/*.db',
    '**/*.db-*',
    '**/*.md',
    '**/CLAUDE.md',
  ],
  // 开发模式下排除所有npm包依赖
  // external: [/node_modules/],
  noExternal: [],
  // 开发服务器启动
  async onSuccess() {
    // 如果有之前的进程，先杀掉
    if (serverProcess) {
      console.log('Killing old server process...');
      serverProcess.kill('SIGKILL');
      // 等待进程完全退出
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // 额外保险：使用 lsof 查找并杀掉所有占用端口的进程
    try {
      const { stdout } = await execAsync(`lsof -ti:${PORT}`);
      const pids = stdout.trim().split('\n').filter(Boolean);
      if (pids.length > 0) {
        console.log(`Found ${pids.length} process(es) using port ${PORT}, killing them...`);
        for (const pid of pids) {
          await execAsync(`kill -9 ${pid}`);
        }
        // 等待端口释放
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      // lsof 没有找到进程是正常的，忽略错误
    }

    // 启动新的服务器进程
    console.log('Starting server...');
    serverProcess = spawn('node', ['--enable-source-maps', './dist/index.js'], {
      stdio: 'inherit'
    });

    // 处理进程退出
    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
    });
  },
});
