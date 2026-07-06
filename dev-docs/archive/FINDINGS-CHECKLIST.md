# lrnev 测试发现清单（待逐条探讨）

> 来源：`CLAUDE-INTEGRATION-TEST-2026-06-11.md` 全部发现 + MCP 真机补测结果。
> 用途：逐条拍板「改 / 软提醒 / 只文档 / 维持」。**「Claude 倾向 / GPT 倾向」都是建议，非结论**——你可在每条「最终决定」栏批注。
> 图例：🔧 改代码 ｜ 💬 软提醒（只加 followup 不拦截）｜ 📄 只文档 ｜ ✅ 已验证无需改 ｜ 🤔 待定位

---

## 🅰 真 bug / 能力缺失 —— 都该修，无哲学争议

| 编号 | 一句话 | 严重 | Claude 倾向 | GPT 倾向 | 最终决定 |
|---|---|---|---|---|---|
| **I-1** | CLI `spec get` 对已完成 spec 缺“开新版”引导（MCP 有、CLI 无） | 中 | 🔧 **修**：把 `specGetWithGuidance` 从 `mcp/tools` **下沉到 core**（SpecManager 或共享 helper），CLI 和 MCP 都调它。理由：以后任何 followup 改动天然两路一致，根治这类不对等。工作量小，纯重构无行为变更。 | 🔧 **修**：同意下沉，但建议做成 core/shared 的 guidance builder，CLI/MCP 各自包装输出形态，语义共用。 | |
| **I-2** | CLI `task create` 无 `--depends-on`，传了静默忽略 | 中 | 🔧 **修**：CLI 加 `.option('--depends-on <ids...>')` 透传。对齐 MCP。注意：只解决“传得进”，depends_on 不拦截是 I-7，两件事分开。工作量极小（一行参数）。 | 🔧 **修**：补参数。`allowUnknownOption()` 不能简单删，现有测试依赖它支持标题以 `--` 开头；应加回归测试确保 `--depends-on` 被解析，同时保留 dash-title 能力。 | |
| **I-3** | CLI `adr create` 无 `--supersedes` | 低 | 🔧 **修但缓**：同 I-2 加参数。但 supersedes 当前传进去也不回写旧 ADR（=I-17），**先定 I-17 再补此参数**，否则补个“只记录”的空参数。工作量极小。 | 🔧 **直接修**：不必等 I-17。CLI 应先对齐 core/MCP；`supersedes` 只是记录也应可达，I-17 是后续语义增强。 | |

## 🅱 设计护栏缺口 —— 倾向已按「贴身提醒助理，不卡审批」定位收敛

| 编号 | 一句话 | 严重 | Claude 倾向 | GPT 倾向 | 最终决定 |
|---|---|---|---|---|---|
| **I-4** | completion gate 能被“需求全 FILL + 空任务标完成”骗过 | **中-高** | 💬 **软提醒，不硬拦**：completion gate **通过时**，若该 spec 从没过 ready / requirements 仍有 FILL，在 `ai_followup` 加警告“completion 只验证了任务结构，该 spec 还有 N 个 FILL/从未过 ready，请确认需求真的实现”。**不改 passed 结果**（保持只引导不强制），但把最危险的静默点显式化。**全清单性价比最高的一条**。 | 🔧 **复评后收窄硬查范围**：completion 应 hard check `requirements.md` / `design.md` 无 FILL；`tasks.md` 当前模板和 `task_create` 正常路径会残留 FILL，不能直接全文硬拦，除非先改模板/创建逻辑。 | |
| **I-5** | validates 锚点不校验存在性（F-99 照收，指向空气） | 中 | 💬 **软警示**：task_create/update 时，拿 validates 锚点和**已读到的** requirements 的 F-xx / design 章节做轻量比对（不额外 IO），找不到就在 followup 提“validates=F-99 在 requirements 里找不到，确认锚点”。**不报错阻断**。 | 💬 **create/update 时校验并 warning**：`validates` 的设计锚点语法并不完全形式化，先不要像 `parent` 一样硬拦；但 F-xx 等可识别锚点找不到时必须在 warnings/followup 里点名。 | |
| **I-6** | summarize_save 给不存在的 spec 存摘要会**凭空建孤儿文件** | 中 | 🔧 **修（这条该硬）**：存摘要前校验目标 spec/scene 目录真实存在，不存在直接报 `TARGET_NOT_FOUND`，**不凭空建目录**。理由：这不是“引导 vs 强制”哲学问题，是**写垃圾文件污染数据**。**唯一一条建议硬拦的。** | 🔧 **硬拦**：同意。URI 能映射路径不等于目标存在；写前校验 scene/spec/doc 文件，避免污染治理数据。 | |
| **I-7** | depends_on 即使传了也只记录、不拦截执行顺序 | 中 | 💬 **软 warning**：task_update→in_progress 时，若 depends_on 有未完成前置，followup warn“前置 T-00x 还没完成，确认是否可开始”。不硬 block。**依赖 I-2 先做**（CLI 能传进来）。 | 🔧+💬 **分层处理**：`depends_on` 指向不存在 task 应在 create/update 时硬拒绝；依赖未完成时只 warning，不硬 block 执行顺序。 | |
| **I-8** | 父子任务：parent 校验存在✅ 但完成顺序不强制（子 pending 父可 completed） | 低-中 | 📄 **维持 + 文档**：已有“子全完→提示父可收尾”软联动，够了。父先于子完成是合理场景（父是容器任务可先关）。文档写明“父子只联动不强制”即可，**不改代码**。 | 💬 **复评修正**：Claude 指出得对，completion 读取的是全量平铺任务，子 pending 已会导致 `all_tasks_completed` fail；无需 gate 新 check。只需在父任务 completed 但仍有未完成子任务时 warning，避免快照误读。 | |
| **I-9** | 序号复用（删 03 后新建拿回 03）无悬空引用检测 | 低 | 📄 **降为只文档**：doctor 扫全文档找序号引用成本高收益低；且 lrnev **根本没有删 spec 的工具**（用户手动 `rm`），属用户手动操作后果。文档强调“用完整 ID”即可。 | 📄 **同意低优先级**：不为手动删目录引入全局 counter；可在 doctor 增可选深扫，主路径继续强调完整 ID。 | |
| **I-17** | adr supersedes 单向只记录，旧 ADR 状态不变（原 🅴，MCP 真机已确认） | 低-中 | 🤔 **二选一**：① 轻量——`adr_list` 标注“已被 0005 取代”（读时计算，不改文件）；② 重——adr_create supersedes 时回写旧 ADR `status=superseded + superseded_by`。**Claude 倾向 ①**（轻、不破坏历史文件）。**定了它再决定 I-3 补不补参数**。 | 🔧 **先轻量读时标注**：旧 ADR 不回写可接受，但 `adr_list/get` 应计算 `superseded_by`；I-3 不需要等它。 | |

## 🅲 提示语 / 启发式打磨 —— 非阻塞

| 编号 | 一句话 | 严重 | Claude 倾向 | GPT 倾向 | 最终决定 |
|---|---|---|---|---|---|
| **I-10** | task_update(in_progress) 无条件追加“拆子任务并行”，小任务上是噪音 | 中 | 🔧 **加弱信号判断**：那两句改成**有条件**追加——`acceptance≥3` 或标题较长或**无 parent** 时才提；**小任务/已是子任务时不提**。消除噪音又不丢大任务的有效提示。 | 🔧 **修**：条件不要只看“无 parent”，顶层也可能是小任务。建议用 acceptance 数、描述长度、已有 children、validates 数量等弱信号；子任务默认不提示。 | |
| **I-11** | assess_goal 对明显多特性仍判 single-spec（reasons 识别了却不升级 kind） | 中 | 🔧 **升 kind**：当 reasons 命中“多个并列项”且 `score≥阈值`，把 `kind` 从 single-spec 升 `multi-spec-program`，**与 scene intent 路径口径统一**（现在两条路一个积极一个保守）。 | 🔧 **修**：`reasons` 和 `kind` 必须一致。枚举项达到 3 个时可以升 `multi-spec-program`，confidence 仍可保持 medium。 | |
| **I-12** | registry 的 dead agent 无自动 GC，反复硬关闭会单调增长 | 中 | 🔧 **惰性清**：在 `agent_register`/`agent_list` 时顺手清“已判 dead 且名下无活跃 claim”的 agent（保留刚崩溃、claim 待接手的）。用着用着自己清，不用专门跑 doctor。注意：E2 已证优雅关闭会自动清，**这条只针对硬崩溃残留**。 | 🔧 **显式 GC 优先**：不同意默认 register/list 自动删。跨主机、刚崩溃待接手、审计排障都需要可控；做 `doctor --gc-agents` 或 `agent gc`，只清 dead 且无活跃 claim。 | |

## 🅳 已知 by-design —— 只补文档，不改

| 编号 | 一句话 | Claude 倾向 | GPT 倾向 | 最终决定 |
|---|---|---|---|---|
| **I-13** | ready gate 章节标题硬依赖中文模板（改名即 fail） | 📄 维持，文档已说清（改名/翻译即 fail 是契约） | 📄 **同意维持**：这是模板契约。以后要国际化应做标题 alias 表，不要悄悄放宽。 | |
| **I-14** | error_search 无语义召回（近义词搜不到） | 📄 维持（零模型是卖点），工具描述加一句“用原文关键词，别改述” | 📄 **同意维持**：零模型检索是产品边界；工具描述和 followup 要明确“按原文关键词/错误码/文件名搜”。 | |

## ✅ 已 MCP 真机验证为健全 —— 不是问题，是加分项

| 原编号 | 结论 |
|---|---|
| **I-15** | ✅ MCP 长连接下自动注册 active、两并发连接 both active、touches_files overlap **正常触发**。CLI“测不出”纯属测试手段局限。**已固化为 `tests/e2e/mcp-stdio-lifecycle.test.ts`**。 |
| **I-16** | ✅ 优雅断开自动注销 agent + 释放 claim，他人无冲突接手。**同上已固化为 e2e**。 |

---

## 贯穿性判断

### GPT 评论

我和 Claude 的主要分歧在 **I-4、I-8、I-12、I-17**。我的判断边界是：lrnev 可以是“贴身提醒助理”，但不能让确定性治理数据自相矛盾。凡是本地数据能零模型判断、误伤低、且会污染 gate/引用/摘要结果的，应进入硬校验或至少让 gate fail；真正的业务语义和实现质量，才交给 AI/用户。

具体说：
- **FILL 哨兵、孤儿 summary、父 completed 但子未完成** 都是结构事实，不是哲学问题。它们继续 pass 会让用户误以为治理链闭环了。
- **validates / depends_on** 可以先软提醒，因为存在合理例外；但“引用目标不存在”不能继续静默，应至少 warning 且列出具体缺口。
- **CLI/MCP 能力对齐** 是工具契约，不应因为某个字段当前“只是记录”就让 CLI 缺入口。
- **agent registry GC** 不建议默认读写路径自动删。清理是维护动作，应显式、可审计、可解释。

**最终分布（GPT 初评）**：
- **该改代码 / gate 行为**：I-1、I-2、I-3、I-4、I-6、I-8、I-10、I-11、I-17
- **软提醒优先**：I-5、I-7
- **显式维护命令**：I-12
- **只文档 / 维持**：I-9、I-13、I-14
- **已验证健全**：I-15、I-16

### Claude 复评（看过 GPT 后）

先认一个分类错误：我初评把「引用/语义校验」一刀切归为「交给 AI、软提醒」。**错在混淆了两件事**。GPT 的边界更准，修正为两段：

> **确定性事实（本地数据零模型可判、误伤≈0、会让 gate/引用/摘要自相矛盾）→ 硬（fail 或拒绝写入）；有合理执行例外的 → 软 warning（不 block）。** 真正交给 AI 的是「需求好不好、代码质量、该不该拆」这类需判断的语义。

按这条边界逐条复评（**粗体=相对我初评有改动**）：

| 条 | 初评 | 复评后 | 说明 |
|---|---|---|---|
| **I-4** | 软提醒 | **🔧 硬查 FILL + 💬软提醒实现** | **被 GPT 说服**。「requirements/design 还有没有 FILL」是结构事实、非语义。且 ready 不是 completion 前置——用户没跑 ready 时分工落空；**design 的 FILL 现在没有任何 gate 查**（ready 只查 requirements、completion 只查 tasks 结构），是真空。completion 应加 `requirements/design 无 FILL` 的 hard check；「是否真实现」继续软提醒。**已代码确认**：completion 的 `all_tasks_completed` 不查 FILL。 |
| **I-12** | 惰性清 | **🔧 显式 GC 命令** | **被 GPT 说服**。我原方案让 `agent_list`（只读）顺手删 agent＝把无副作用读变成有锁写，违反 lrnev 惰性只读（NFR-1）；且跨主机/刚崩溃待接手/审计都需 dead 记录可见。改为显式 `doctor --gc-agents` / `agent gc`。（可折中：register 本就是写操作，清同 id 旧记录无妨；但绝不在 list 删别人。） |
| **I-8** | 纯文档 | **💬 加软提醒（拒绝 GPT 的 gate check）** | **GPT 此条前提有事实错误**。已读 `GateRunner.checkCompletion`：`tasks=taskManager.list()` 是**含子任务的全量平铺**，`all_tasks_completed` 对子任务同样生效——**只要有子 pending，completion 本来就 hard_fail**。GPT 担心的「父 completed 子 pending 让 completion 失真」不会发生，他提的 `parent_completed_with_incomplete_children` check 是**冗余**。但真实风险是 task_list 快照误导（瞥一眼父 completed 忽略 pending 子）→ 加一条软提醒即可，不改 gate。 |
| **I-3** | 等 I-17 | **🔧 直接补参数** | **被 GPT 说服**。CLI 缺 `--supersedes` 是工具契约缺失，即便当前只是「记录」也该能传（MCP 现在就只记录也给了参数）。与 I-17 正交，不互相阻塞。 |
| **I-5 / I-7** | followup warning | **💬 warning + create 时校验目标存在** | **GPT 补强，接受**。像 parent 那样在 task_create 时就校验 validates 锚点 / depends_on 目标存在（确定性），比只在 in_progress warning 更完整；执行顺序仍软、不 block。 |
| I-6 | 硬拦 | 硬拦（不变） | 俩一致：写孤儿文件是数据污染，存前校验目标存在、不存在报 `TARGET_NOT_FOUND`。 |
| I-1 / I-10 / I-11 | 不变 | 不变 | GPT 仅细化，无分歧。I-2 采纳 GPT 的「收紧 `allowUnknownOption()`」**但需先查该 flag 为何存在**（疑与 task title 位置参数处理有关），别误伤，先验证再动。 |

**复评后 Claude 最终分布**：
- **硬校验 / gate 行为**：I-4（FILL 硬查）、I-6
- **改代码（契约/能力对齐，无争议）**：I-1、I-2、I-3、I-10、I-11
- **软提醒（含 create 时校验存在）**：I-5、I-7、I-8
- **显式维护命令**：I-12
- **只文档 / 维持**：I-9、I-13、I-14
- **读时计算，不回写**：I-17（adr_list/get 算 `superseded_by`）
- **已验证健全**：I-15、I-16

**与 GPT 的最终差异收敛到 1 条**：I-8——GPT 要 completion 加 check，我已代码证明冗余，主张只加软提醒。其余分歧（I-4/I-12/I-3）我已采纳 GPT。

### GPT 复评（看过 Claude 复评后）

Claude 这次复评里有几处源码事实是对的，我修正初评：

| 条 | GPT 初评 | GPT 复评后 | 说明 |
|---|---|---|---|
| **I-8** | completion 加 `parent_completed_with_incomplete_children` check | **💬 不加 gate check，只加软提醒** | **接受 Claude 纠错**。`TaskManager.list()` 返回平铺全量任务，`children` 只是冗余视图；`GateRunner.checkCompletion` 的 `all_tasks_completed` 已覆盖子任务。父 completed + 子 pending 不会让 completion pass。真实问题只是中间态快照可能误导，所以在父任务 completed 但仍有未完成子任务时 warning 即可。 |
| **I-4** | requirements/design/tasks 全部 FILL hard check | **🔧 requirements/design hard check；tasks 暂不全文 hard check** | 复核模板后要收窄：`tasks.md.tmpl` 自带两个 FILL，`task_create` 只追加 task，不替换模板占位。直接 hard check tasks 全文会误伤正常路径。先硬查 requirements/design；若要查 tasks FILL，需先改模板或让首个 task_create 清理“使用 task_create 追加任务”占位。 |
| **I-2** | 补参数并收紧 `allowUnknownOption()` | **🔧 补参数，谨慎处理 unknown option** | 源码测试明确依赖 `task create` 支持标题以 `--` 开头（例如 `--scan 改占位`）。不能简单删 `allowUnknownOption()`；应补 `--depends-on` 并加回归，防止它继续被 title/unknown option 逻辑吞掉。 |
| **I-5** | 可解析锚点至少 warning | **💬 warning，不急硬拦** | `F-xx` 比较明确，但 `design#3.2` 的目标格式未完全制度化。先做“能识别的锚点不存在则 warning”，避免把设计文档写法锁死。后续若定义设计锚点规范，再升级硬校验。 |
| **I-7** | create 校验存在，in_progress warning | **🔧+💬 同此口径，但拆成两层** | `depends_on` 是 task ID 引用，存在性误伤低，应硬拒绝不存在 ID；依赖未完成是执行策略，有合理抢跑场景，只 warning。 |

我仍保留的判断：

- **I-4 不能只软提醒**。`<!-- FILL -->` 是模板哨兵，不是 prose 质量；requirements/design 仍有 FILL 时 completion pass 会制造“治理已闭环”的假象。
- **I-12 不做 list/register 默认 GC**。`agent_list` 是 readOnly 工具，不能悄悄写 registry；清理 dead agent 应是显式维护动作，例如 `doctor --gc-agents` 或 `agent gc`。
- **I-3 不等 I-17**。CLI/MCP 对等是架构原则，`--supersedes` 即便只记录也应可传。
- **I-17 先读时计算，不回写旧 ADR**。这符合文件历史可追溯，也能解决“单独读旧 ADR 不知道被替代”的可见性问题。

**GPT 复评后最终分布**：
- **硬校验 / 拒绝写入**：I-4（requirements/design FILL）、I-6、I-7（depends_on 不存在）
- **改代码（契约/能力对齐）**：I-1、I-2、I-3、I-10、I-11
- **软提醒 / warning**：I-5、I-7（依赖未完成）、I-8
- **显式维护命令**：I-12
- **读时计算，不回写**：I-17
- **只文档 / 维持**：I-9、I-13、I-14
- **已验证健全**：I-15、I-16

---

> **I-4 / I-5 / I-7 是同一类（引用/语义不校验）**，Claude 倾向统一走 💬 **软提醒**（followup 里 warn，不改 passed / 不阻断）——与 lrnev“贴身提醒的助理，不卡审批”定位自洽，既补盲区又不破坏“只引导”体验。
>
> **唯一例外 I-6**：不是哲学问题，是“凭空写一个永远没人读的孤儿文件”=纯数据污染，建议 🔧 **硬拦**，从“引用不校验”这组里单拎出来。
>
> ⚠️ 上面这段是 Claude **初评**的贯穿判断；复评后 I-4 已从「软提醒」改为「硬查 FILL + 软提醒实现」，以上方〈Claude 复评〉为准。

**最终分布（Claude 初评，存档对照）**：
- **该改代码（无争议）**：I-1、I-2、I-6、I-10、I-11、I-12
- **软提醒（补 followup，符合定位）**：I-4、I-5、I-7
- **只文档 / 维持**：I-8、I-9、I-13、I-14
- **先定方案再动**：I-17 →（定了才决定 I-3）
- **已验证健全**：I-15、I-16

---

## ✅ 最终决定（用户 2026-06-11 拍板）—— 以此为准执行

> 经 Claude 初评 → GPT 评论 → Claude 复评 → GPT 复评 → 用户裁决，全部事实主张已核对源码。三方对“怎么改”已收敛，用户裁决了 3 个产品取向问题。**全部条目都做，用 lrnev 自身建 scene+spec 治理推进（吃狗粮）。**

| 编号 | 最终决定 | 关键边界 / 备注 |
|---|---|---|
| **I-1** | 🔧 改 | `specGetWithGuidance` 下沉 core，CLI/MCP 共用 guidance builder |
| **I-2** | 🔧 改 | 补 CLI `--depends-on`；**不删 `allowUnknownOption()`**（`cli.test.ts:115` dashTitleTask 依赖标题可 `--` 开头），加回归测试确保 `--depends-on` 被解析 |
| **I-3** | 🔧 改 | 直接补 CLI `--supersedes`，不等 I-17（CLI/MCP 对等是契约） |
| **I-4** | 🔧 **硬拦（限定范围）** | completion gate hard_fail：**仅** `requirements.md` / `design.md` 残留 FILL。**不碰 tasks.md**（模板自带 FILL L14/L18，task_create 不替换）。判据=用户原话：“FILL 是表单必填项未填，确定性事实，不是语义判断；不算破‘只引导不强制’——后者保护需求拆分/设计好坏/代码质量/是否真解决，这些仍交 AI”。不判断写得好不好、是否真实现（那部分仍软提醒） |
| **I-5** | 🔧 **硬拒（口径翻转，并入 S6）** | **决定已从“软 warning”翻转为“硬拒”**：D-xx 规范定了之后，validates 的锚点语法也规范化（只认 F-xx/D-xx），“引用不存在的锚点”与 depends_on 同类，应硬校验存在性——消除原先 depends_on(硬)/validates(软) 的不一致。F-xx 去 requirements 找 `#### F-xx`、D-xx 去 design 找 `#### D-xx`，找不到硬拒；validates 只接受 F-xx/D-xx，其他（含 design#3.2）一律拒绝。**整体并入 S6 锚点体系规范化**，从 S3 移出 |
| **I-6** | 🔧 硬拦 | summarize_save 写前校验目标 scene/spec/doc 存在，不存在报 `TARGET_NOT_FOUND`，不凭空建目录 |
| **I-7** | 🔧+💬 **分层** | depends_on **指向不存在 task ID** → create 时硬拒绝（确定性、误伤低）；**依赖未完成** → in_progress 时 warning，不硬 block（有合理抢跑场景） |
| **I-8** | 💬 软提醒 | 不加 gate check（已证 completion 对子 pending 本就 fail，冗余）。父 completed 但有未完成子任务时 followup warning，防 task_list 快照误读 |
| **I-9** | 📄 文档 | 不引入全局 counter；文档强调用完整 ID；doctor 可选深扫留后续 |
| **I-10** | 🔧 改 | 并行提示改有条件：用 acceptance 数/描述长度/已有 children/validates 等弱信号；**子任务默认不提示** |
| **I-11** | 🔧 改 | assess_goal：reasons 命中“多并列项”且枚举≥3 时 kind 升 `multi-spec-program`，confidence 可保持 medium，与 scene intent 口径统一 |
| **I-12** | 🔧 显式 GC | 清**别人的** dead agent 只能走显式 `doctor --gc-agents`（或 `agent gc`），只清 dead 且无活跃 claim。**边界折中**：`agent_list` 等只读路径绝不删任何记录；`agent_register` 保持现状——它本就覆盖同 `agent_id` 的旧记录（含旧 dead），这是 register 的固有写语义、不算新增副作用、零实现成本。故 register 天然“清掉自己同 id 的旧记录”，无需改代码；要新写的只有清别人的显式 gc |
| **I-13** | 📄 维持 | 模板标题契约；国际化另做 alias 表 |
| **I-14** | 📄 维持 | 零模型是边界；工具描述强调“按原文关键词/错误码/文件名搜” |
| **I-17** | 🔧 读时计算 | adr_list/get 计算 `superseded_by`，**不回写旧 ADR 文件**（保历史可追溯） |
| **I-15/I-16** | ✅ 健全 | 已固化为 `tests/e2e/mcp-stdio-lifecycle.test.ts`，无需改 |

**待后续单独 spec 探讨**：`design#x.y` 设计锚点语法规范（卡着 I-5 的 design 锚点部分）。

### I-18（新增，用户 2026-06-11 决策）design 锚点规范化为 D-xx

**问题**：`design#3.2` 看着精确，实则无真相来源——design.md 里没有稳定的 `3.2` 标识，插段/改标题/换模板都会让它漂移；对 AI“像真的”，对工具无法确定性验证。

**决策**（用户）：design 锚点改用 **`D-xx` 显式编号**，与 requirements 的 `F-xx` 对称：
```
#### D-01 缓存索引结构
#### D-02 增量更新流程
```
task 写 `--validates F-01 D-02`。语义：
- `F-xx` = requirements 的功能需求锚点
- `D-xx` = design 的设计锚点（design.md 里的稳定 ID）
- `design#3.2` = 旧自由写法，**逐步废弃**

**不采用**：标题 slug（`design#缓存策略`——中文/重复/改名/slug 规则各异）、章节号（`3.2` 非文件内稳定 ID）。

**符合 lrnev 初衷**：仍不判断“设计好不好”，只判断“你说对应 D-02，design.md 里到底有没有 D-02”——确定性事实，非语义裁判。

**最终决策（用户 2026-06-11，与 GPT 二轮探讨 + Claude 核实源码后定稿）**：

核实结论：`design#3.2` 全仓只出现在工具描述/测试/文档的**例子**里（`cli/index.ts:219`、`mcp/tools/index.ts:256`、`types/task.ts:65`、`task-manager.test.ts` 多处、`GOVERNANCE-FLOW.md:170`），**无任何产品逻辑或用户数据依赖**。validates 实际用过的值只有 `F-xx` / `design#3.2` / `[]`，无其它自由字符串。故 `design#3.2` 不是 legacy 契约，是“未定型就被写进例子的草稿语法”，可直接清除、无兼容包袱。

**锚点体系规范（目标态，直接落地）**：
- `F-xx` = requirements 的功能需求锚点（`#### F-xx`）；`D-xx` = design 的设计锚点（`#### D-xx`）。两者对称。
- **validates 只接受 `^F-\d+$` 或 `^D-\d+$`，其它一律拒绝**（彻底去自由字符串化，让 validates 成为可支撑覆盖率/追溯/completion 自查的结构化治理能力）。
- **存在性硬校验**：`F-xx` 去 requirements 找、`D-xx` 去 design 找，找不到 → 硬拒绝、不落盘（与 depends_on=T-001 同类的坏引用处理）。
- `design#3.2` 等废弃格式 → 硬拒绝，报“格式已废弃/不支持，请用 D-xx”（不是“锚点不存在”）。
- **不做** `design#3.2 → 第3.2节` 的映射（design 无稳定章节号，映射是假确定性）。
- 清理：把测试/工具描述/文档里的 `design#3.2` 例子全部改成 `D-xx`（自己把草稿例子扶正，非兼容用户数据）。design 模板加 `#### D-xx` 锚点示范。
- 已有 `.lrnev` 数据：不自动迁移（design#3.2→D-xx 无确定映射，工具猜不了）；如担心存量，doctor 加检测列出让用户手改即可。

**这不背离 lrnev 初衷**：不判断设计质量，只防“引用一个不存在的设计点”——确定性治理。

**连带改动（已同步本清单）**：
- I-5 决定从“S3 软提醒”**翻转为“S6 硬拒”**（见上 I-5 行）。
- S3 移除 I-5（F-xx）部分，只保留 I-7（依赖未完成）+ I-8（父子）软提醒。
- S6 从“design 锚点规范化”扩展为“**锚点体系规范化**”：含 D-xx 定义、validates 格式硬校验、F-xx/D-xx 存在性硬校验、design# 拒绝、例子清理、模板更新。
- F-xx/D-xx/depends_on 三处硬校验实现集中在 `TaskManager.create`（同一处）。

**执行方式**：用 lrnev 在本项目 `.lrnev` 建 scene + 按特性拆 spec，走 requirements→ready→task→completion 流程推进以上改动。

### 执行过程决策（对话陆续确定，归档备查）

- **吃狗粮**：用 lrnev 自身治理这些改动——在 `product/lrnev-govern/.lrnev` init，建 scene `01-findings-remediation`，scene.md 钉住本清单 + 测试报告两份权威文档路径。
- **分支**：在 `fix/findings-checklist` 分支上做（避免占住 main）。
- **Spec 拆分（7 个）**：S1 cli-mcp-parity(I-1/2/3) / S2 deterministic-hard-checks(I-4/6/7存在性, P0) / S3 reference-soft-reminders(I-5 F-xx/7依赖/8父子) / S4 heuristic-polish(I-10/11) / S5 maintenance-visibility(I-12/17) / S6 design-anchor-d-xx(I-18, **搁置**) / S7 governance-boundary-docs(I-9/13/14)。S2 与 S3 故意拆开：验收语义相反（硬拦 vs 软提醒），合并会糊。
- **节奏**：先把全部 spec 的 requirements 填完并过 ready gate，再统一对照两份文档检查，**最后才统一进入实现**（避免一个 spec 走完整闭环时忘记其他）。design.md / tasks.md 留到实现阶段填，本阶段只检查 requirements。
- **S6 搁置**：`design#3.2` 经确认**此前并无人使用、无 legacy 数据需兼容**；D-xx 是全新规范。S6 的 requirements 暂不填，design 锚点的 legacy 处理与 D-xx 校验软/硬度，待与用户**详细探讨后**再定。其余 6 个 spec 不依赖 S6，先行推进。
- **映射核对结论**：除 S6 外，checklist 所有“该改/该文档”条目都被 6 个 spec 准确覆盖，无遗漏无错配；I-7 正确拆成 S2(存在性硬)+S3(依赖软)。
