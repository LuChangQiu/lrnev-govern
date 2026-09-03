#!/usr/bin/env bash
# T-027 12 场景冒烟测试（sha-a）

set -e

# 确保在项目根目录运行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${PROJECT_ROOT}"

SCENARIOS=("E-01" "E-02" "E-03" "E-04" "E-05" "E-06a" "E-06b" "E-07" "E-08" "E-09" "E-10" "E-11")
SHA="sha-a"
TIMEOUT=180

echo "🚀 T-027 12 场景冒烟测试（SHA: ${SHA}）"
echo "📂 工作目录: ${PROJECT_ROOT}"
echo ""

PASSED=0
FAILED=0
SKIPPED=0

for SCENARIO in "${SCENARIOS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 ${SCENARIO}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if T027_SCENARIO="${SCENARIO}" T027_SHA="${SHA}" timeout ${TIMEOUT} npx tsx tests/e2e/t027-baseline/harness-mvp.mjs 2>&1; then
    echo "✅ ${SCENARIO} 通过"
    ((PASSED++))
  else
    EXIT_CODE=$?
    if [ ${EXIT_CODE} -eq 124 ]; then
      echo "⏱️  ${SCENARIO} 超时"
      ((FAILED++))
    elif [ ${EXIT_CODE} -eq 2 ] || [ ${EXIT_CODE} -eq 3 ]; then
      echo "⚠️  ${SCENARIO} 跳过（退出码 ${EXIT_CODE}）"
      ((SKIPPED++))
    else
      echo "❌ ${SCENARIO} 失败（退出码 ${EXIT_CODE}）"
      ((FAILED++))
    fi
  fi

  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 通过: ${PASSED}"
echo "❌ 失败: ${FAILED}"
echo "⚠️  跳过: ${SKIPPED}"
echo "📊 总计: ${#SCENARIOS[@]}"
