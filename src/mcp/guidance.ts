export const WORKFLOW_OVERVIEW = [
  'lrnev 是确定性的项目治理引擎：文件即真相，不调用 LLM。',
  '概念：Scene > Spec > Task；Gate 只查结构契约；ADR/Errorbook/Memory 是轻产物。',
  '新建特性：首次先 lrnev_init，再 spec_create；填 requirements 后跑 spec_gate_check(ready)，再 task_create、task_update，最后 spec_gate_check(completion)。',
  '接手项目：先调 project_status 拿全貌，从 in_progress task 继续。',
  '分流：先自问"这事能写出有意义的 WHEN…THEN 验收、且可独立交付吗"——是才 spec_create；踩坑→error_record，技术决策→adr_create，约定→memory_save；写不出独立验收的小改动(改文档/小重构/调参数/答问题等，只是举例不限于此)直接做、不要开 spec；拿不准先问用户。',
  '不确定下一步时调 lrnev_guide。',
].join('\n');

export const EARS_ACCEPTANCE_EXAMPLE =
  '验收标准建议写成可测形式(EARS)，例：WHEN 用户输错密码 THEN 系统返回 401 且不暴露用户是否存在。';

export const DESIGN_DECISION_EXAMPLE =
  'design.md 的关键决策可用表格示范：| 决策 | 选项 | 倾向 | 是否产 ADR |，并补一句“为什么这样做”；框架/存储/协议/安全等重大选择建议沉淀 ADR。';

export const TOOL_DESCRIPTIONS = {
  lrnev_guide: '返回 lrnev 工作流、工具速查、错误自救和核心概念。何时用：不确定下一步、刚接入 MCP、或 gate/状态机报错时。前置：无。例子：lrnev_guide{topic:"errors"} → 只看错误自救。',
  lrnev_init: '初始化 .lrnev 工作区。何时用：新项目首次接入。前置：项目根目录已确定。例子：lrnev_init{project_name:"demo"} → 创建默认治理骨架。',
  project_status: '返回接手快照。何时用：继续已有项目或新会话开头。前置：已 init。例子：project_status{} → 查看 active tasks、ADR 和 open errors。',
  scene_create: '创建业务 Scene，并生成 scene.md、architecture.md、roadmap.md。何时用：需要按业务域隔离一组 Specs 时；传 intent 可在 followup 获得单/多 Spec 拆分信号。',
  scene_list: '列出当前工作区中的所有 Scene。何时用：接手项目、选择工作场景或排查 broken Scene 时。',
  scene_get: '读取一个 Scene 的元信息和统计信息。何时用：需要确认某个 Scene 的文档与统计概况时。',
  spec_create: '创建 Spec 三文档。何时用：先自问"这是可独立交付、能写出 WHEN…THEN 验收的特性吗"——是才开 spec；做完没有独立验收可挂的小改动(改文档/排版/注释、小重构、调参数、答问题等，举例非穷举)直接做、不要开 spec；拿不准先问用户、别默认开。前置：已 init；scene 可省略。例子：spec_create{name:"login"}。',
  spec_list: '列出指定 Scene 下的所有 Spec。何时用：查看同 Scene 已有哪些特性、避免重复或找接手目标。',
  spec_get: '读取一个 Spec 的元信息和三文档存在性。何时用：进入某个 Spec 前确认 requirements/design/tasks 是否齐全。',
  spec_update: '按状态机更新 Spec 状态(draft→ready→in-progress→completed→archived)。何时用：gate 通过后回填状态，或开重写版后把被取代的旧版标 archived(归档后其待办不再进可领列表)。',
  spec_gate_check: '运行 Spec gate。何时用：创建后、需求填完或任务完成后验收。前置：spec 已存在；ready 前替换 FILL。例子：spec_gate_check{gate:"ready"} → 返回 checks。',
  task_create: '追加结构化 Task。何时用：ready gate 后拆执行项；大项可用 parent 拆子任务。前置：spec 已创建。例子：task_create{title:"实现登录",parent:"T-001"}。',
  task_update: '按状态机更新 Task。何时用：开始/完成/阻塞任务时。前置：task 已存在，遵守 pending→in_progress→completed。例子：task_update{task_id:"T-001",status:"completed"}。',
  task_list: '列出指定 Spec 的所有 Task。何时用：接手或收尾时查看 pending/in_progress/completed 状态。',
  task_claim: '登记 Task 运行态软占用。何时用：多窗口开始做某个 Task 前。前置：agent 已注册、task 已存在。例子：task_claim{task:"T-001",agent_id:"agent-a"}。',
  task_release: '释放 Task claim。何时用：放弃、交接或不再处理某个 Task 时。前置：该 claim 属于当前 agent_id。例子：task_release{task:"T-001",agent_id:"agent-a"}。',
  adr_create: '创建全局或 Scene 范围的 ADR，并更新对应索引。何时用：已有明确技术决策、选型或取舍需要留痕时。',
  adr_list: '按 scope 列出 ADR，默认 global。何时用：实施前回看既有决策或检查某个范围的决策历史。',
  adr_get: '读取指定 scope 下的 ADR。何时用：需要理解某个已定决策的背景、后果或替代方案时。',
  assess_goal: '用启发式规则评估目标复杂度，建议 single-spec / multi-spec-program / research-program。何时用：用户目标较模糊、需要先判断治理粒度时。',
  summarize_save: '保存指定 context:// URI 的 L0 / L1 摘要，不调用 LLM。何时用：完成阶段性工作后更新接手摘要时。',
  context_search: '目录优先检索 context:// 资源，优先使用 L0/L1 摘要。何时用：找相关 Spec、ADR、记忆或错误记录时。',
  error_record: '记录错误到 Errorbook incidents，并按指纹自动去重合并。何时用：遇到踩坑、回归或可复用故障经验时。',
  error_search: '搜索 incidents 和 promoted 错误手册。何时用：修类似问题前查历史根因、修法和验证证据时。',
  error_promote: '将 incidents 错误提升为 promoted，必须提供 verification。何时用：同类错误已验证可复用、需要沉淀为错误手册时。',
  memory_save: '保存一条项目记忆，source 必填，同类别内自动去重。何时用：一句约定、事实或偏好值得后续复用时。',
  memory_search: '搜索项目记忆，可按分类和 scope 过滤。何时用：需要回看项目约定、事实、模式或用户偏好时。',
  memory_forget: '删除指定记忆。何时用：确认某条记忆过期、错误或不应再影响后续判断时。',
  session_commit: '批量保存本轮对话抽取出的候选记忆。何时用：会话结束或上下文压缩前沉淀多条候选记忆时。',
  agent_register: '注册当前 Agent，返回 agent_id；未传 agent_id 时自动生成。何时用：通过 stdio 启动时会自动注册;脚本化或跨主机显式控制会话时手动调用。',
  agent_heartbeat: '更新 Agent last_heartbeat 并续租其 claim。何时用:通常无需(存活随进程自动判定);仅跨主机协作需要兜底续活时调用。',
  agent_list: '列出 Agent 注册表，并惰性计算 active/dead 状态。何时用：查看当前有哪些客户端会话在线时。',
  agent_unregister: '注销 Agent 会话。何时用：Agent 正常退出或交接完成后清理会话状态。',
  lrnev_doctor: '检查 .lrnev 工作区结构、Spec、Task、ADR、claim、hook 和 context；可迁移旧 TODO、清理遗留摘要。何时用：gate 失败、broken 条目、数据异常或接手前。',
  lrnev_hook_list: '列出 hook 配置和最近执行状态。何时用：确认 hooks.json 生效情况或排查自动化未触发时。',
  lrnev_hook_trigger: '手动触发 hook 事件，用于测试 hooks.json 配置。何时用：新增或修改 hook 后做本地验证时。',
  lrnev_hook_tail_log: '读取最近 hook 执行日志。何时用：hook 失败、超时、warning 或 trigger 后确认输出时。',
  lrnev_hook_enable: '启用 hooks.json 中指定 hook。何时用：临时关闭的自动化需要恢复时。',
  lrnev_hook_disable: '禁用 hooks.json 中指定 hook。何时用：某个 hook 失败、太慢或干扰主流程时。',
} as const;

export const GUIDE_TOPIC_VALUES = ['workflow', 'tools', 'errors', 'concepts'] as const;

export type GuideTopic = typeof GUIDE_TOPIC_VALUES[number];

type GuideSection = {
  title: string;
  content: string;
};

export interface GuideResult {
  ok: true;
  data: {
    topic: GuideTopic | 'all';
    content: string;
  };
  ai_followup: {
    instructions: string[];
  };
}

const GUIDE_SECTIONS: Record<GuideTopic, GuideSection> = {
  workflow: {
    title: '工作流',
    content: [
      '新项目或首次接入：调用 lrnev_init 初始化 .lrnev 工作区。',
      '新建可追踪特性：调用 spec_create 创建 requirements/design/tasks 三文档，先填 requirements，再跑 spec_gate_check(ready)。',
      EARS_ACCEPTANCE_EXAMPLE,
      'ready gate 通过后：按 design 拆 task_create，执行前用 task_update 标 in_progress，完成后标 completed。',
      '拆 Task 时自查：是否大到可分别认领/并行？子步骤是否要各自独立验收？否则保持单个 Task，别为拆而拆；需要拆时用 task_create(parent=父任务)。',
      DESIGN_DECISION_EXAMPLE,
      '收尾：所有任务完成后跑 spec_gate_check(completion)，再回看 L0 摘要与验收标准。',
      '接手已有项目：先调用 project_status，看 active_tasks、recent ADR、open errors，再从 in_progress task 继续。',
    ].join('\n'),
  },
  tools: {
    title: '工具速查',
    content: [
      '新建：lrnev_init、scene_create、spec_create、spec_gate_check、task_create、task_update。',
      '接手：project_status、scene_list、spec_list、task_list、context_search。',
      '轻产物：adr_create 记录小决策，error_record 记录踩坑，memory_save 保存一句约定，summarize_save 更新摘要。',
      '诊断：lrnev_doctor 查工作区结构、断链引用、stale claim、hook 与 agent 异常；需要时可迁移旧 TODO 占位或清理遗留摘要。',
      '并发：agent_register/agent_heartbeat/agent_unregister 管客户端会话；task_claim/task_release 记录谁声明正在做哪个 Task。',
      '自动化：lrnev_hook_list/trigger/tail_log/enable/disable 管本地 hooks。',
    ].join('\n'),
  },
  errors: {
    title: '错误自救',
    content: [
      'AMBIGUOUS_REF：从 candidates 里选完整 id，重新调用刚才的工具。',
      'ready gate 未过：按 checks 里的 name/message/hint 修 requirements；常见原因是 FILL 哨兵、缺必填章节或验收未勾选。',
      'completion gate 未过：先 task_list 找未 completed 的任务，继续 task_update，别强行标 spec completed。',
      'INVALID_STATUS_TRANSITION：按状态机走；pending 先到 in_progress，completed 是终态，返工请新建 task。',
      '文件缺失或 broken 条目：先运行 lrnev_doctor，必要时重新 spec_create 或恢复缺失文档。',
    ].join('\n'),
  },
  concepts: {
    title: '核心概念',
    content: [
      'Scene 是业务场景，Spec 是可交付特性，Task 是执行单元。',
      'Gate 是结构检查，不替 AI 判断需求质量或代码质量。',
      'Gate 各档边界：ready gate 校验 requirements 的必填章节(标题须与中文模板一致)与 FILL 哨兵；completion gate 只校验任务结构(tasks 可读/存在/全部 completed)，不检查 design.md / tasks.md 的 FILL。',
      '多 Agent：存活随进程自动判定(同主机 pid 探活,连接断开自动注销),无需定时心跳;跨主机回退到默认 90 秒心跳年龄阈值。',
      'EARS 是推荐写法，不是 gate 规则；简单 Spec 的自然语言验收仍可通过结构检查。',
      DESIGN_DECISION_EXAMPLE,
      'Spec id 里的 VV 是正式重写版号，不是修订号；修改现有需求/设计/任务时直接编辑原文件，git 记录历史。只有整体推翻重做且需要保留旧版对照时，才用 spec_create 的 version=1/2/... 开新版。',
      'ADR、Errorbook、Memory 是轻产物：小决策、踩坑和约定不必都开 Spec。',
      '不是所有事都要落治理。判据(让 AI 自己想，不要对着清单匹配)：先自问"这事能写出一条有意义的 WHEN…THEN 验收吗、是不是可独立交付"——能且是，才开 spec；否则(改文档/小重构/调参数/答问题等只是举例，不限于此)直接做。拿不准就问用户，别默认开 spec。',
      'lrnev 坚持确定性归代码、判断归 AI：工具列事实、给提示，不维护隐藏状态或模型推理结果。',
      '流程是 Scene > Spec > ADR（可选）> Task；ADR 只在有关键决策时出现。',
    ].join('\n'),
  },
};

export function buildGuide(topic?: GuideTopic): GuideResult {
  const content = topic
    ? sectionText(topic, GUIDE_SECTIONS[topic])
    : GUIDE_TOPIC_VALUES.map((key) => sectionText(key, GUIDE_SECTIONS[key])).join('\n\n');

  return {
    ok: true,
    data: {
      topic: topic ?? 'all',
      content,
    },
    ai_followup: {
      instructions: [
        topic
          ? `已返回 ${GUIDE_SECTIONS[topic].title} 小节；按其中的具体工具名继续调用。`
          : '已返回 lrnev 完整手册；先按工作流判断是新建、接手、诊断还是记录轻产物。',
      ],
    },
  };
}

function sectionText(topic: GuideTopic, section: GuideSection): string {
  return `## ${section.title} (${topic})\n${section.content}`;
}
