#!/bin/bash

echo "=== B0 运行前检查 ==="

# 1. 检查 git 状态
DIRTY=$(git status --porcelain)

if [ -n "$DIRTY" ]; then
  echo "⚠️ 工作区不干净，发现未提交变更："
  git status --short

  echo ""
  echo "执行 stash 以隔离 M1 改动..."
  git stash push -m "B0 运行前隔离 M1 改动 $(date +%Y-%m-%d-%H%M%S)"

  # 确保 runtime 目录存在
  mkdir -p .lrnev/runtime

  # 记录 stash SHA
  git stash list -1 --format="%H" > .lrnev/runtime/b0-stash-sha.txt

  echo "✅ Stash 完成，stash SHA: $(cat .lrnev/runtime/b0-stash-sha.txt)"
else
  echo "✅ 工作区干净，无需 stash"
fi

# 2. 确认当前 commit = B0 baseline（如果存在 baseline 记录）
if [ -f .lrnev/runtime/b0-baseline-sha.txt ]; then
  B0_SHA=$(cat .lrnev/runtime/b0-baseline-sha.txt)
  CURRENT_SHA=$(git rev-parse HEAD)

  if [ "$B0_SHA" != "$CURRENT_SHA" ]; then
    echo "❌ 错误：当前 commit ($CURRENT_SHA) != B0 baseline ($B0_SHA)"
    echo "请切换到 B0 baseline commit 再运行"
    exit 1
  fi

  echo "✅ 当前 commit = B0 baseline ($B0_SHA)"
else
  echo "ℹ️ 未找到 B0 baseline 记录，记录当前 commit 作为 baseline"
  mkdir -p .lrnev/runtime
  git rev-parse HEAD > .lrnev/runtime/b0-baseline-sha.txt
  echo "✅ B0 baseline 已记录: $(cat .lrnev/runtime/b0-baseline-sha.txt)"
fi

# 3. 准备 B0 运行环境
echo "✅ B0 运行前检查完成，可以执行 T-014（B0 运行）"
