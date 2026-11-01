#!/usr/bin/env bash
# 备份线上 SQLite 库到本地 ./backup/
# 线上 PM2 服务运行中持有 WAL，主库文件可能不含最新数据，
# 必须把 dev.db / dev.db-wal / dev.db-shm 一起打包拉下来，缺一不可
set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
if [ ! -f "$REPO_ROOT/.deploy-env" ]; then
  echo "错误: 找不到 $REPO_ROOT/.deploy-env（应包含 SSH_TARGET=root@host）" >&2
  exit 1
fi
source "$REPO_ROOT/.deploy-env"

TS=$(date +%Y%m%d-%H%M%S)
REMOTE_DIR=/root/app/TsFullStack/prisma
OUT=backup/db-$TS.tar.gz

mkdir -p backup

# 在服务器上把主库 + WAL + SHM 一起打包（只读，不影响线上服务）
TARBALL=tsfullstack-db-$TS.tar.gz
ssh "$SSH_TARGET" "cd $REMOTE_DIR && tar czf /tmp/$TARBALL dev.db dev.db-wal dev.db-shm"

scp -q "$SSH_TARGET:/tmp/$TARBALL" "$OUT"
ssh "$SSH_TARGET" "rm -f /tmp/$TARBALL"

# 本地解开并验证可读
VERIFY_DIR=$(mktemp -d)
tar xzf "$OUT" -C "$VERIFY_DIR"
echo "--- 验证备份 ---"
sqlite3 "$VERIFY_DIR/dev.db" "PRAGMA integrity_check; select 'AiModel: '||count(*) from AiModel;"
rm -rf "$VERIFY_DIR"

echo "备份完成: $OUT"
