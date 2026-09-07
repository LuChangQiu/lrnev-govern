# 运行时配置说明

lrnev 的可调阈值集中在一个文件：项目根的 **`.lrnev/config/lrnev.json`**。不存在该文件时全部使用默认值；存在时按**子集覆盖**合并——只写你要改的键，其余仍走默认。

规则：

- 覆盖按**类型匹配**合并：类型不符的值（比如给数字键写了字符串）会被忽略、回退默认，不报错。
- 同类型的"非法值"（如负数）大多会被原样接受，只有明确标注防御的键（如 `agent.gc_retention_days`）会在使用处回退默认。
- 改配置**无需重启 CLI**（每次命令按需读取）；MCP 服务进程长驻时，改配置后**重启 MCP 生效**——`loadConfig` 每次按需读文件、无连接期缓存，个别在长驻进程实例构造期读取的键（如 hook 日志轮转阈值）也随重启收敛到新值。
- 协议契约（ID 格式、状态机、目录名、错误码）**不可配置**，写死在代码里。

> 唯一权威来源是 [`src/shared/config.ts`](../src/shared/config.ts) 的 `DEFAULT_CONFIG`；本文与其同步维护，若有出入以代码为准。

最小示例（只改两个键）：

```json
{
  "agent": { "gc_retention_days": 14 },
  "task": { "max_batch_create": 100 }
}
```

完整键示例见 [`docs/examples/lrnev.json`](examples/lrnev.json)（列出全部键与默认值，可整份复制后按需修改）。

## 全部配置键

### `lock` — 内部目录锁

| 键 | 默认 | 说明 |
|---|---|---|
| `directory_lock_retries` | `200` | 目录锁获取重试次数 |
| `directory_lock_delay_ms` | `5` | 重试间隔（毫秒） |

### `doctor` — 工作区体检阈值

| 键 | 默认 | 说明 |
|---|---|---|
| `stale_task_days` | `7` | Task 停留 in_progress 超过 N 天报陈旧 |
| `stale_lock_minutes` | `60` | `.lrnev/locks` 下锁目录超龄报陈旧 |

### `search` — context_search

| 键 | 默认 | 说明 |
|---|---|---|
| `max_depth` | `3` | 递归扫描最大目录深度 |
| `top_k` | `10` | 单次最多返回条数 |
| `snippet_length` | `240` | 摘要片段最大字符数 |
| `use_l0_ranking` | `true` | 是否用 L0/L1 摘要加权排序 |

### `auto_analyzer` — init 时的代码库探测

| 键 | 默认 | 说明 |
|---|---|---|
| `max_manifest_depth` | `3` | 搜索构建清单的最大目录深度 |
| `max_sample_files` | `20` | 最多抽样源码文件数 |
| `ignore_dirs` | `node_modules`、`dist`、`.git` 等 | 探测与检索跳过的目录名列表 |

### `errorbook`

| 键 | 默认 | 说明 |
|---|---|---|
| `fingerprint_length` | `12` | 错误指纹 hash 前缀长度（去重键） |

### `memory`

| 键 | 默认 | 说明 |
|---|---|---|
| `dedup_similarity_threshold` | `0.8` | 同类记忆去重的相似度阈值 |
| `max_candidates_per_commit` | `20` | 单次 session_commit 最多处理条数 |

### `spec`

| 键 | 默认 | 说明 |
|---|---|---|
| `file_size_warning_kb` | `200` | Spec 文档超过该大小时 doctor 告警 |
| `create_max_attempts` | `10` | 并发创建冲突时的最大重试次数 |

### `task`

| 键 | 默认 | 说明 |
|---|---|---|
| `max_batch_create` | `50` | `task_create_many` 单批最多创建条数（v2.3） |

### `scene`

| 键 | 默认 | 说明 |
|---|---|---|
| `create_max_attempts` | `10` | 并发创建冲突时的最大重试次数 |

### `project_status`

| 键 | 默认 | 说明 |
|---|---|---|
| `recent_limit` | `5` | 返回最近 ADR / error 的最大条数 |
| `claimable_preview` | `5` | 每个 Spec 的 `claimable_next` 预览条数（全量数量看 `free_tasks_count`） |

### `claim` — Task 软占用

| 键 | 默认 | 说明 |
|---|---|---|
| `default_ttl_seconds` | `120` | 默认租约秒数（heartbeat 会续租） |
| `max_ttl_seconds` | `86400` | 允许的最大租约秒数 |

### `agent` — 会话存活与自动 GC

| 键 | 默认 | 说明 |
|---|---|---|
| `heartbeat_dead_ms` | `90000` | 跨主机兜底：心跳超龄判 dead（同主机以 pid 探活为准，不看此值） |
| `auto_gc` | `true` | register 时机会式清理死 agent/过期 claim（v2.3）；`false` 完全关闭 |
| `gc_retention_days` | `7` | 跨主机判死记录/孤儿过期 claim 的保留天数；非正数/NaN 按 7 防御回退 |

### `hooks`

| 键 | 默认 | 说明 |
|---|---|---|
| `default_timeout_ms` | `30000` | hook 未配置 timeout_ms 时的默认超时 |
| `max_timeout_ms` | `600000` | 单个 hook 允许的最大超时 |
| `output_tail_bytes` | `2048` | stdout/stderr 保留的尾部字节数 |
| `log_rotate_bytes` | `10485760` | hook 日志超过该字节数后轮转 |
| `recent_list_limit` | `5` | hook list 默认读取的最近日志条数 |
| `health_scan_limit` | `100` | doctor 扫描 hook 健康时读取的日志条数 |
| `chronic_timeout_threshold` | `3` | 连续 N 次 timeout 报慢性超时 |
| `chronic_failure_threshold` | `5` | 连续 N 次非 success 报慢性失败 |

### `storage`

| 键 | 默认 | 说明 |
|---|---|---|
| `frontmatter_read_bytes` | `65536` | 只读 frontmatter 时的最大预读字节数 |
