#!/bin/bash
# 开发服务器启动脚本

# 端口号
PORT=5209

# 查找并终止占用端口的进程
PID=$(lsof -ti:$PORT)
if [ -n "$PID" ]; then
  echo "Killing old process on port $PORT (PID: $PID)"
  kill -9 $PID
  # 等待端口释放
  sleep 1
fi

# 启动新的服务器进程
echo "Starting server on port $PORT..."
node --enable-source-maps ./dist/index.js
