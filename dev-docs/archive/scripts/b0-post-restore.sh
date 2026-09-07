#!/bin/bash

echo "=== B0 运行后恢复 ==="

# 检查是否有 stash 记录
if [ -f .lrnev/runtime/b0-stash-sha.txt ]; then
  STASH_SHA=$(cat .lrnev/runtime/b0-stash-sha.txt)

  echo "发现 B0 stash 记录，恢复中..."
  git stash pop

  echo "✅ M1 改动已恢复"
  rm .lrnev/runtime/b0-stash-sha.txt
else
  echo "✅ 无 stash 记录，无需恢复"
fi
