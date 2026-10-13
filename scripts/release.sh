#!/usr/bin/env bash
# 一键安装依赖、发布前端并运行后端。
# 已安装 systemd 单元 visora.service 时重启该服务；否则前台启动。
set -euo pipefail

usage() {
  cat <<'EOF'
用法: scripts/release.sh [--build-only | --foreground]

  默认           安装依赖、构建前端、迁移数据库。
                 若已安装 visora.service，则替换静态文件后重启，并检查 /api/health。
                 否则在前台启动后端（使用 .env 里的 HOST / PORT）。
  --build-only   安装、构建、迁移并发布静态文件，不启动或重启。
  --foreground   发布后始终在前台启动，不操作 systemd。
EOF
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mode="auto"
if [[ $# -gt 1 ]]; then
  echo "visora: 只能指定一个参数" >&2
  usage >&2
  exit 2
fi
case "${1:-}" in
  "") ;;
  --build-only) mode="build" ;;
  --foreground) mode="foreground" ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    echo "visora: 未知参数: $1" >&2
    usage >&2
    exit 2
    ;;
esac

say() { printf 'visora: %s\n' "$*"; }

STAGING="$ROOT/data/.frontend-staging"
PREVIOUS="$ROOT/data/.frontend-previous"

remove_tree() {
  [[ -e "$1" ]] || return 0
  node --input-type=module -e 'import { rm } from "node:fs/promises"; await rm(process.argv[1], { recursive: true, force: true })' "$1"
}

cleanup_staging() {
  if [[ -d "$STAGING" ]]; then
    remove_tree "$STAGING"
  fi
}
trap cleanup_staging EXIT

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "visora: 需要 Node.js 24 或更高版本" >&2
    exit 1
  fi
  node --input-type=module -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 24) { console.error(`visora: 需要 Node.js 24+，当前是 ${process.versions.node}`); process.exit(1) }'
}

require_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return
  fi
  if ! command -v corepack >/dev/null 2>&1; then
    echo "visora: 未找到 pnpm，也无法通过 corepack 启用" >&2
    exit 1
  fi
  say "启用 pnpm@10.32.1"
  corepack enable
  corepack prepare pnpm@10.32.1 --activate
}

acquire_lock() {
  mkdir -p "$ROOT/data"
  exec 9>"$ROOT/data/.release.lock"
  if ! flock -n 9; then
    echo "visora: 已有发布任务在运行" >&2
    exit 1
  fi
}

release_lock() {
  flock -u 9 || true
}

build_frontend() {
  remove_tree "$STAGING"
  say "构建前端"
  pnpm --dir front exec -- vite build --outDir "$STAGING" --emptyOutDir
  pnpm --dir front exec -- tsc -b --pretty false
}

publish_frontend() {
  say "发布前端静态文件"
  remove_tree "$PREVIOUS"
  if [[ -d "$ROOT/front/dist" ]]; then
    mv "$ROOT/front/dist" "$PREVIOUS"
  fi
  if ! mv "$STAGING" "$ROOT/front/dist"; then
    if [[ -d "$PREVIOUS" && ! -d "$ROOT/front/dist" ]]; then
      mv "$PREVIOUS" "$ROOT/front/dist"
    fi
    echo "visora: 无法替换前端静态文件" >&2
    exit 1
  fi
  remove_tree "$PREVIOUS"
}

migrate_database() {
  say "迁移数据库"
  pnpm db:migrate
}

unit_env() {
  local name="$1"
  systemctl show visora.service -p Environment --value | tr ' ' '\n' | sed -n "s/^${name}=//p" | tail -n 1
}

service_installed() {
  command -v systemctl >/dev/null 2>&1 && systemctl cat visora.service >/dev/null 2>&1
}

wait_until_healthy() {
  local host="$1"
  local port="$2"
  local url attempt
  case "$host" in
    0.0.0.0 | :: | "") host="127.0.0.1" ;;
  esac
  url="http://${host}:${port}/api/health"
  for ((attempt = 1; attempt <= 30; attempt++)); do
    if node --input-type=module -e 'const response = await fetch(process.argv[1], { signal: AbortSignal.timeout(2000) }); if (!response.ok) process.exit(1); process.stdout.write((await response.text()).trim() + "\n")' "$url"; then
      say "后端已就绪 ${url}"
      return 0
    fi
    sleep 1
  done
  echo "visora: 后端未在 30 秒内通过健康检查 ${url}" >&2
  if command -v journalctl >/dev/null 2>&1; then
    journalctl -u visora.service -n 40 --no-pager >&2 || true
  fi
  return 1
}

start_backend() {
  local host port
  if [[ "$mode" == "build" ]]; then
    say "已跳过启动"
    return
  fi
  if [[ "$mode" == "auto" ]] && service_installed; then
    say "重启 visora.service"
    if ! systemctl restart visora.service; then
      echo "visora: 重启 visora.service 失败。可改用 --foreground 在前台启动" >&2
      exit 1
    fi
    host="$(unit_env HOST)"
    port="$(unit_env PORT)"
    if [[ -z "$port" ]]; then
      echo "visora: visora.service 未设置 PORT" >&2
      exit 1
    fi
    wait_until_healthy "$host" "$port"
    return
  fi
  say "前台启动后端"
  release_lock
  exec 9>&-
  export NODE_ENV="${NODE_ENV:-production}"
  exec pnpm start
}

require_node
require_pnpm
acquire_lock
say "安装依赖"
pnpm install --frozen-lockfile
build_frontend
migrate_database
publish_frontend
start_backend
say "发布完成"
