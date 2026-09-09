# 《lrnev-govern 深度分析报告》本地源码核查与补盲

**核查对象**：`C:\Users\xiqi\Desktop\lrnev-govern-深度分析报告.md`（对 GitHub `LuChangQiu/lrnev-govern` 的分析，基准 2026-09-08 / v3.0.0）
**核查依据**：本地完整源码仓库 `E:\project\.lrnev\lrnev-cli\product\lrnev-govern`（version 3.0.0；HEAD `f0ef518`，与 `origin/main` 零领先，2026-09-08 发布 3.0.0 后仅 docs 提交）＋ GitHub/npm 在线事实
**核查方式**：4 个并行只读核查（领域模型/并发、MCP 协议层、配置/Hooks/安全、文档/测试/版本史），证据分级：**src 源码 > templates/tests > docs/CHANGELOG（文档口径）> 报告断言**
**判定符**：✅CONFIRMED（成立）/ ⚠️PARTIAL（部分成立，有出入）/ ❌WRONG（不成立）/ ❓UNVERIFIABLE

> 全文证据引用为仓库相对路径 `文件:行号`，行号来自 read/grep 实测。未修改任何源码。

---

## 1. 结论速览

### 1.1 判定统计

| 核查域 | 条目数 | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| 领域模型 / ID / 状态机（§3.1–3.2） | 7 | 7 | 0 | 0 |
| Gate 语义（§3.3） | 1 | 0 | **1** | 0 |
| 锚点追溯（§3.4） | 2 | 2 | 0 | 0 |
| 并发与多 Agent（§4） | 6 | 6 | 0 | 0 |
| MCP 协议层（§5） | 8 | 8 | 0（含 10 条注记） | 0 |
| 配置系统（§6.1） | 6 | 3 | 2 | **1** |
| Hooks（§6.2–6.3） | 2 | 2 | 0 | 0 |
| 安全（§7） | 2 | 2 | 0 | 0 |
| 代码规范（§2.3） | 1 | 0 | 1 | 0 |
| 工程/版本/维护（§8–§10.3） | 13 | 9 | 3 | **1** |
| 外部事实（GitHub/npm） | 7 | 6 | 0 | **1** |
| **合计** | **55** | **45** | **7** | **3** |

**总体判断：报告可信度高、方向性结论全部成立；错误集中在 3 处具体数字/存在性硬伤和约 10 处表述级夸大，且报告自认的全部证据盲区现已被本地源码封闭（结论与报告的低风险预判一致，未发现被文档美化掩盖的实现缺陷）。**

### 1.2 三处硬伤（❌，建议原报告必改）

1. **§2.1「约 25 个 Manager/Runner 类」不成立**：`src/core/` 中以 Manager/Runner/Store 结尾的 `export class` 恰为 **11 个**（ADRManager、ClaimStore、ErrorbookManager、GateRunner、HookManager、HookRunner、MemoryManager、SceneManager、SpecManager、TaskManager、WorkspaceManager）。「25」恰好等于**全 src/ 的类总数**——报告疑似把两个口径张冠李戴。
2. **§6.1「13 个配置域、40+ 可调键」不成立**：`src/shared/config.ts`、`docs/CONFIG.md`、`docs/examples/lrnev.json` 三处权威源一致为 **14 个顶层域 / 34 个键**。其中点名提到的 **「context_search 的 BM25 排序开关」键不存在**——BM25（k1=1.2/b=0.75）自 v2.1 起硬编码在 `Searcher.ts:44-45,125-135`，从未提供开关；search 域实际只有 `max_depth/top_k/snippet_length/use_l0_ranking` 四键，`use_l0_ranking` 只是 L0/L1 摘要加权加分。
3. **§10.2「npm 包 `lrnev-govern`（独立 npm 包）在持续发版」不成立**：npm registry 查询 `lrnev-govern` 返回 **404 Not found**——该包不存在。发版活跃的是 `lrnev` 本体（11 次发布序列与报告 §9 完全一致）。疑似把 npm 搜索索引里的仓库同名条目误读成独立 npm 包。

### 1.3 高价值出入（⚠️，影响论断力度但非方向性错误）

| # | 报告表述 | 本地实况 | 影响 |
|---|---|---|---|
| 1 | §3.3：ready gate 通过条件含「验收清单项已勾选」（与章节齐全、无 FILL 并列） | `GateRunner.ts:103-115` 的 `requirements_acceptance_checked` 是 **`hard_fail:false` 软检查**——未勾选只提示、不阻断 ready 通过 | 「ready=结构契约」的论证反而更纯粹；按报告口径属于把软提示写成硬条件 |
| 2 | §5.1：content 文本含五角色前缀体系【事实】【建议】【决策边界】【执行约束】【下一步】 | 五词与全角格式逐字存在（`guidance-semantics.ts:161-167`），但全 src **只有 3 个前缀有运行时行产出**（【建议】【事实】【决策边界】；SpecGuidance.ts:36-41、SpecManager.ts:224-225、decision-context.ts:337-371）；【执行约束】【下一步】仅存于常量与注释，无产出路径 | README:174 的文档口径宽于实现；报告若暗示五种前缀行都会出现在 content 中则过强 |
| 3 | §2.1：「四层架构」分层表格 | `docs/ARCHITECTURE.md:32-131` 实际是**目录树+行内注释**呈现（core/storage/mcp/cli/types/shared），并无字面分层表；报告「四层」却列 6 模块自相矛盾；「接口层/契约层/横切层」是转写词；`schemas/` 目录被省略。真正存在且转述正确的是 everything 对照表（:157-172）与「core 是唯一业务逻辑层」原文（:13） | 表格式呈现（归并 shared+schemas 之类）与原文有偏差，但架构判断不受影响 |
| 4 | §6.1：deepMerge「structuredClone 做深拷贝」 | 行为摘录与源码一致（类型不匹配静默回退、数组整体替换、null/undefined 跳过），但 `deepClone = structuredClone`（config.ts:271-273）**只用于无 override 的两条路径**（:211、:237-239）；有 override 的 merge 结果中未被覆盖的嵌套子树与 `DEFAULT_CONFIG` 共享引用（:246,249,260）——**不是严格深拷贝** | 语义级出入；全库无对返回配置的写操作，无现实危害 |
| 5 | §6.1/§5.2 细节 | ①「个别构造期配置需重启 MCP 才生效」：全 src 31 处 `loadConfig()` 全按操作/短命实例求值，**不存在长驻配置快照**（CONFIG.md:9 该句是保守表述）；② guidance 纯函数实际 **4 个**导出（另有 `assertGuidancePublishable`:325、`normalizeRole`:46），非「三个」；③ `agent.heartbeat_dead_ms`（90s）语义是**跨主机/pid 缺失的兜底判死阈值**，同主机 pid 探活优先，非通用心跳超时 | 措辞精度 |
| 6 | §10.3：单人维护 + 「282 commits」 | git 实测 **283 commits**（HEAD 口径），`git shortlog` 单作者 luchangqiu 283 条（--all 下 gh-pages 另有 1 条大小写变体）；GitHub contributors API：LuChangQiu 283 contributions | 差 1，可忽略 |
| 7 | §9/§8.3 细节 | ① 11 次 npm/CHANGELOG 发布只对应 **8 个 git tag**（1.0.0/1.0.1/1.1.0 从未打 tag）；② v2.1.0 CHANGELOG 记 06-16，npm/tag 落 06-17（差 1 天）；③ README 只含 **3.0.0** 升级章节，v2.0 迁移指南在 CHANGELOG 2.0.0 条目内（:184-188）；④ CHANGELOG 的「### ⚠️」标题只用于 v2.0.0，3.0.0 以正文「破坏性变更」表达；⑤ AI-ADAPTATION 矩阵 6 行中 **Claude Opus 4.8 行分数为「—」**（未计分），「7.5–8/8」只覆盖已计分 5 行 | 报告「CHANGELOG 用 ⚠️ 标注、README 有专门升级指南章节」的表述需加限定 |
| 8 | §2.3：注释「一律使用中文注释」出自编码规范 | CONTRIBUTING.md:41 只明文「非显而易见的 WHY 要写、不复述 WHAT」，**全文未要求中文**——中文注释是实际实践而非明文规则；PascalCase 规则（:37）在 core/storage 存在小写模块文件例外（`core/decision-context.ts`、`core/guidance-semantics.ts`、`*/index.ts`） | 归因错误（把实践当明文） |
| 9 | §5.1：信封含 ok/data/errors/ai_followup | 属实，但完整信封还有可选 `anchor_context`/`summary_context`（response-envelope.ts:98,106） | 列举省略，不算错 |
| 10 | §5.3：`omitted` 标量 | 实际是三态对象 `{kind:'none'|'exact',count|'unknown'}`；且带同构元数据的不止查询类（task_create_many 的 data 也带 query_meta；project_status 用 claimable_meta） | 需细化 |

### 1.4 报告其余 45 项判定全部成立（✅），要点一览

- **状态机两张转换表与报告逐条一致**：`src/types/task.ts:28-34`（pending→in_progress/blocked、in_progress→completed/failed/blocked、blocked→pending/in_progress、completed 终态、failed→pending）；`src/types/spec.ts:25-31`（含 completed→in_progress|archived 维护增量语义）；spec_update 拒绝非法转换并提示可达状态（SpecManager.ts:150-161）。
- **ID 与序号分配**：Scene `{NN}-{kebab}`、Spec `{NN}-{VV}-{kebab}`（VV=重写版号非修订号，SpecManager.ts:356-365 重写沿用主序号只升版本位）、Task `T-{NNN}` Spec 内递增（TaskManager.ts:994-1012）；max+1 扫描 + `mkdirExclusive` 原子抢目录 + `withDirectoryLock` 临界区、无 scene-numbers.json 中心化计数器（SceneManager.ts:11）——序号复用风险与 GOVERNANCE-FLOW.md:81-83 的披露、doctor 深度悬空扫描「后续可选项」口径均属实。
- **Gate 其余语义全部命中**：ready 硬拦 FILL 哨兵与旧 TODO 占位、章节标题与中文模板逐字一致且无 alias；completion 硬拦 requirements/design FILL、design.md 缺失判失败（防删 design 绕过，GateRunner.ts:190-201）、tasks.md 自带模板 FILL 豁免（:174-176）；**Gate 与 spec.status 完全解耦**（GateRunner 全文不读 status，MCP/CLI 直调 gates.check）。
- **锚点体系**：`#### F-xx/D-xx` 锚点语法、`validates`/`depends_on`/`parent` 存在性硬校验（写盘前、锁内）、`ANCHOR_NOT_FOUND` 错误码、`design#3.2` 旧写法废弃（报 INVALID_INPUT）、anchor_context 结构化回填与 3.0.0 纯文本通道可见性修复（F-03）全部为真。
- **并发机制**：同主机 `process.kill(pid,0)` 探活 + 跨主机心跳兜底（90s）、惰性判定、**src 全文无 setInterval**（NFR-1 零后台线程属实）；claim 软占用（第二个 claim 返回 `claimed:false+conflict`，不抛错）；机会式 GC 挂在 register、本机判死即清/跨主机 7 天保留期、TOCTOU 按 claim 锁重读判据、doctor --gc-agents；`.lrnev/locks/*.lockdir` 仅作 `withDirectoryLock` 瞬时文件级互斥；不 spawn agent/不调度/不裁决冲突、touches_files 自愿声明——全部命中。
- **MCP 双通道**：42 工具注册（tools/index.ts:224-1072）、`--profile core/full`（裁 9 留 33，过滤在 tools/index.ts:216-220，argv 解析在 server.ts:78-99，属 **lrnev-mcp 服务进程**而非 CLI）；structuredContent 信封 `response_version:'1'` + ok/data/errors/ai_followup（response-envelope.ts:36-107）+ 每工具 outputSchema（42 处）；3.0.0 前裸 JSON.stringify（README:180）+ M1 回退路径仍在（model-visible-contract.ts:197-200，42 渲染器全注册故不触发）；guidance 字段已从 schema 删除（零消费+「+583 字符 ≈24.2% 纯重复税」，CHANGELOG:24）；text_status 三态、total_count 恒可得（先全量后截断）；decision_context 四工具、不落盘不阻断（不一致只加【决策边界】行）——全部命中。
- **Hooks/错误路径**：数组命令不走 shell、字符串经 cmd.exe/sh -c 兼容 + doctor HOOK_SHELL_FORM(info)；cwd 穿越校验（含 `..` 与越界解析，HookManager.ts:353-373）；sync abort/warn/silent、async 永不 reject；env 四变量在用户 env **之后**注入防伪装；ADR-0003 本体存在（`.lrnev/scenes/04-ai-guidance-standardization/decisions/adr/0003-hook-drain-boundary.md`）：先写 invoked→5s drain→timed_out 补写全落地（实现偏离草案一处：timed_out 保留原 event 而非 'drain'）；INTERNAL_ERROR 不回传原文只给 code/message（原文仍 console.error 本地），错误统一经 `__error__` 出口 + `</`→`<\/` 转义（D-04.1）。
- **工程/版本**：五个依赖精确匹配；四道发布门禁 scripts + CONTRIBUTING 0 容忍原文；tsconfig.test.json 独立门禁与「101 个游离类型错误」记载；CHANGELOG 测试数字 593→626→654→692→1079（81 文件）**逐条命中**，本地 `*.test.ts` 恰 81 个文件（静态用例近似 1052–1057，比 1079 少约 2%，实跑被沙箱限制无法复现，仅能确认与 CHANGELOG 记载一致）；mcp-stdio-lifecycle.test.ts 5 条用例覆盖自动注册/并发 active/touches 重叠/优雅断开注销+释放 claim；AI-ADAPTATION 6 模型矩阵、8 步链路、1/0.5/0 打分、38 vs 42 溯源注记全部为真；11 个 CHANGELOG 版本条目日期端点 v1.0.0=06-04 / v3.0.0=09-07 全对；xpaas 64/14 案例、dev-docs「11 份归档/73 份镜像/06-00 spec」表述均成文。

---

## 2. 盲区补盲（报告 §7/§12.6 自认未能直读的核心源码，现全部封闭）

报告当时受工具限制未能直读的模块，本次全部通读，结论如下——**没有发现「文档描述与实现不一致」的实质风险，报告 §12.6 的低风险预判被证实**。

### 2.1 存储与安全边界（报告 §7 打问号的两个问题）

**WorkspaceLocator.ts（163 行）——工作区定位**
- 定位优先级：env `LRNEV_WORKSPACE` → 自 startDir 向上逐层找含 `.lrnev/PROJECT.md` 的祖先目录（256 次迭代防环上限，`:87` 注释明言防软链死循环）→ cwd 兜底；server 生命周期内解析一次，误命中祖先 `.lrnev` 会警告并提示设 env 重启。
- **对「工作区定位是否有路径穿越防护」的明确回答**：定位层输入来自可信运行环境（env/cwd），本身无用户路径输入；规范化是词法 `resolve()`（**非 realpath，不做符号链接解析**）——env 指向符号链接属于「用户自选根」语义而非漏洞。**真正的穿越拦截不在此文件，而在 FileStorage**；本文件不是安全边界。

**FileStorage.ts（339 行）——写入范围（报告的核心盲区问题）**
- **对「写入是否逃逸到工作区之外」的明确回答：不存在常规逃逸路径。** 全部读写方法必经 `resolveSafe`（:54-75）：空路径拒绝、**绝对路径默认拒绝**、resolve 后必须 `abs === root || abs.startsWith(root + sep)`（sep 边界防 `/repo-x` 前缀误命中），`..` 越界在此抛 INVALID_INPUT；原子写 tmp 与目标同目录、rm/mv 同闸。用户可控字符串要触盘必先变 relPath 再过此闸。
- `withDirectoryLock`（:218-258）= 独占 mkdir 的 OS 原子锁（EEXIST/EPERM 判忙），默认 200 次×5ms 重试，finally 删锁目录；**跨进程互斥有效**；无 owner 信息、崩溃残留由 doctor `STALE_DIRECTORY_LOCK` 回收（60 分钟）。
- **残余面（如实列出）**：① resolveSafe 是纯词法校验——工作区内若已有用户自建的**指向 root 外的符号链接**，读写会经链接落在外（需攻击者先在磁盘造链；glob list 默认不 follow）；② `list()` 的 glob pattern 不走 resolveSafe，当前全部调用点 pattern 以 `.lrnev/` 字面开头、**无用户输入直拼的越界调用点**（纵深缺口而非现行漏洞）。

**URIRouter.ts（448 行）——context:// 路由**
- kind 8 类白名单 + scheme/level（L0|L1|L2）/ADR 正整数等校验，产出路径全部锚定 `.lrnev/` 子树；`..` 段不过滤但被 FileStorage 拦截（语法层不是安全边界）；畸形 percent 编码抛裸 URIError（:96）会被包成 INTERNAL_ERROR——健壮性残点，非安全问题。

### 2.2 core 实现质量（报告 §12.6 盲区清单）

- **GateRunner.ts**：三档分派清晰、零模型零源码读取；防绕过设计显式（「删 design.md 绕过 FILL」补丁 :192）；哨兵扫描排除代码块；ready 验收勾选确认为软提示（见 1.3#1）。章节匹配=任意 2~6 级标题的文本全等，「逐字一致」实际不限定标题层级。
- **TaskManager.ts**：校验链（parent→depends_on→validates→编号→写）全在锁内、失败不落盘；claim 随 in_progress 自动 claim、completed/failed 自动 release；anchor_context 400/1200 字符上限与残缺态处理；文件头注释「Scene 全局递增」措辞残留（:26）与实际 Spec 级递增矛盾，属注释噪声。
- **ClaimStore.ts**：claim 文件 `.lrnev/runtime/claims/{scene}__{spec}__{task}.json`（safePart 消毒）、TTL 默认 120s、可接手=TTL 过期或属主死、removeStale 按 claim 锁重读判据（TOCTOU 防护）、损坏文件静默跳过。
- **AgentRegistry.ts**：registry.json 平面映射、register 内机会式 GC（`agent.auto_gc` 默认 true 门控，**此开关报告未披露**）、pid 探活 EPERM 视为活、`sweepRegistry` 注释「目录锁不可重入」是易踩坑点、断开注销 `unregisterAndReleaseClaims` 由连接生命周期钩子直连调用（**不经 agent_register 工具**）。
- **SceneManager/SpecManager 序号分配**：max+1 扫描 + mkdirExclusive 抢目录（锁内、失败 number++ 重试，上限 99）；SceneManager.create() 注释残留 scene-numbers.json 陈旧步骤（:134-143），次要噪声。

### 2.3 MCP server 组装与生命周期

- server.ts（197 行）：`createMcpServer` → `registerTools(server, profile)`；**无 setConnectionHandler 式钩子**——自动注册/注销走 SDK 底层 `Server.oninitialized`（:115-119）+ `onclose`（:142）+ 显式 stdin end/close 监听（:143,190-193，注释说明 StdioServerTransport 不因 stdin 关闭触发 onclose）+ SIGINT/SIGTERM → 幂等 shutdown → `registry.unregisterAndReleaseClaims`；硬杀兜底由 pid 探活覆盖；hook drain 与 shutdown 同点挂载。
- 双通道组装单一出口 `tool-result-adapter.ts:79-111`（payload → 渲染 → content/structuredContent/isError=!ok）；43 项渲染器注册表（42 工具 + `__error__`）。
- 42 工具分组：lrnev_* 9（含 5 个 lrnev_hook_*）、scene_* 3、spec_* 5、task_* 6、adr_* 3、memory_* 3、error_* 3、单列 6（project_status/governance_map/assess_goal/summarize_save/context_search/session_commit）、agent_* 4（仅 full）＝ 42。

---

## 3. 报告结论层的复核

- **§11 优势八条**：全部经源码/文档复核**成立**。尤其「确定性归 lrnev、判断性归 AI」作为公理贯穿 Gate（软/硬分层）、claim（软占用）、decision_context（不落盘不阻断）、hooks（只引导）——未找到违反该原则的功能；「零模型依赖」在依赖清单与源码层面均兑现。
- **§12 局限**：国际化（ready 中文标题契约无 alias）✅；序号复用悬空引用（doctor 深扫未实现）✅；无认证（stdio 本地信任模型）✅；单点维护（单人 283 commits）✅；元治理开销 ✅。**§12.6 证据盲区 → 已封闭**，且盲区内未发现新风险；仅补充一处报告未提的细节：GC 有 `agent.auto_gc` 总开关、claim TTL 默认 120s。
- **§14 结论**：「定位清晰、执行严谨、工程质量超平均、风险在生态早期单点维护」——全部经本地实证支持。
- **新增正面证据（报告未覆盖）**：FileStorage `resolveSafe` 的 root+sep 词法边界、env 注入顺序防伪装、`omit` 三态、SDK 生命周期接线方式、drain 幂等标记——这些细节进一步支持报告「安全与并发意识超出同类平均」的判断。

---

## 4. 修订建议（给报告作者的精确改法）

1. §2.1：删「约 25 个 Manager/Runner 类」→「src/core 共 11 个 Manager/Runner/Store 类（另含若干函数模块，如 SpecGuidance/GateGuidance），全 src 共 25 个类」；「四层架构表」改为「目录树+行内注释（core/storage/mcp/cli/types/shared，另 src/schemas/）」，删「四层」措辞。
2. §3.3：ready 通过条件去掉「验收清单项已勾选」或注明「软提示（hard_fail:false），未勾选不阻断」；可补「旧 TODO 占位同样硬拦」。
3. §5.1：五角色前缀改为「五角色词汇体系已定义并随工具使用其中三色（事实/建议/决策边界）产出前缀行；执行约束/下一步前缀为词汇表预留」。
4. §6.1：13 域/40+ 键 → 14 域/34 键；删「BM25 排序开关」表述（BM25 硬编码、use_l0_ranking 仅 L0/L1 加分）；「structuredClone 做深拷贝」改为「仅无 override 时以 structuredClone 克隆；merge 结果部分子树与默认配置共享引用」；「需重启 MCP 才生效」改为「无长驻配置缓存，实际按需读取；文档『重启收敛』为保守表述」。
5. §10.2：删「npm 包 lrnev-govern 独立发版」→「npm 仅 lrnev 一个包（11 次发布），lrnev-govern 名称未在 npm 登记」。
6. §10.3/§8.3 等微差：282→283 commits；Opus 4.8 行注明未计分；「CHANGELOG 用 ⚠️ 标注」限定 v2.0.0；「README 升级指南」限定仅 3.0.0；v2.1.0 日期以 06-17（npm/tag）为准。
7. §2.3：中文注释改为「实践上以中文注释为主（规范明文仅要求写 WHY）」。

---

## 附录 A：外部事实核查（在线）

| 报告断言 | 事实 | 判定 |
|---|---|---|
| GitHub 16 stars / 2 forks | API：stargazers 16 / forks 2（核查时点） | ✅ |
| 仓库创建 2026-06-04、基准 2026-09-08 | API：created 2026-06-04 / pushed 2026-09-08 | ✅ |
| 单点维护 | contributors API 仅 LuChangQiu（283 contributions）；本地 shortlog 单作者 | ✅ |
| npm `lrnev` 11 次发布序列与日期 | registry：1.0.0(06-04)→1.0.1→1.1.0→1.2.0→1.3.0→1.3.1→2.0.0(06-12)→2.1.0(06-17)→2.2.0→2.3.0→3.0.0(09-07)，latest=3.0.0 | ✅（v2.1.0 差 1 天见 1.3#7） |
| npm `lrnev-govern` 为独立 npm 包且持续发版 | registry 返回 **404 Not found** | ❌ |
| §0「GitHub robots.txt 禁爬 /tree/、/commits/」 | robots.txt 对 `User-agent: *` 确有 `Disallow: /*/tree/` 与 `Disallow: /*/*/commits/` | ✅ |
| npm README 自带 42/33 工具、五角色前缀、response_version '1'、1079 条测试 | registry readme 全数对上 | ✅ |

## 附录 B：未能本地实证的两项（诚实边界）

1. **「1079 条全绿」实跑**：沙箱禁止 vitest 实跑（esbuild 子进程 spawn 被命名管道边界拦截）；已核 CHANGELOG 记载与 81 个测试文件数量、静态用例近似 1052–1057（差约 2%，可能来自统计口径）。如需实证，可在本机 `npm test` 直接验证。
2. **24.2% 体积测量**：属 3.0.0 开发期历史测量（真机三客户端 380 录制件），本地只有 CHANGELOG/注释记载（「+583 字符 ≈24.2% 纯重复税」），无法从代码复算。

---

*核查执行：4 个只读并行核查 + 在线事实抓取；判定证据全部可回溯到 `文件:行号`。本文件不修改任何源码。*
