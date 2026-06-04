/**
 * MCP 资源注册中心。
 *
 * 所有资源都以 `context://` URI 暴露；具体路径解析由 URIRouter 负责。
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { readContextResource } from './handlers.js';

export function registerResources(server: McpServer): void {
  registerStaticResources(server);
  registerTemplateResources(server);
}

function registerStaticResources(server: McpServer): void {
  registerFixed(server, 'project', 'context://project', '项目全局概述');
  registerFixed(server, 'project-architecture', 'context://project/architecture', '项目全局架构');
  registerFixed(server, 'auto-codebase', 'context://auto/codebase', '自动分析的代码库信息');
  registerFixed(server, 'steering-core', 'context://steering/core', 'AI 核心行为原则');
  registerFixed(server, 'steering-scope', 'context://steering/scope', 'global / scene scope 判定规则');
  registerFixed(server, 'steering-adr', 'context://steering/adr', 'ADR 触发规则');
  registerFixed(server, 'steering-memory', 'context://steering/memory', '记忆提取触发规则');
  registerFixed(server, 'scene-list', 'context://scene', 'Scene 列表');
  registerFixed(server, 'adr-list', 'context://adr', '全局 ADR 索引');
}

function registerTemplateResources(server: McpServer): void {
  registerTemplate(server, 'scene', 'context://scene/{scene}', 'Scene 主文档');
  registerTemplate(server, 'scene-architecture', 'context://scene/{scene}/architecture', 'Scene 架构文档');
  registerTemplate(server, 'scene-roadmap', 'context://scene/{scene}/roadmap', 'Scene 路线图');
  registerTemplate(server, 'spec-requirements', 'context://spec/{scene}/{spec}', 'Spec requirements.md');
  registerTemplate(server, 'spec-design', 'context://spec/{scene}/{spec}/design', 'Spec design.md');
  registerTemplate(server, 'spec-tasks', 'context://spec/{scene}/{spec}/tasks', 'Spec tasks.md');
  registerTemplate(server, 'adr', 'context://adr/{number}', '全局 ADR 文档');
  registerTemplate(server, 'scene-adr', 'context://scene/{scene}/adr/{number}', 'Scene ADR 文档');
}

function registerFixed(
  server: McpServer,
  name: string,
  uri: string,
  description: string,
): void {
  server.registerResource(
    name,
    uri,
    { description, mimeType: 'text/markdown' },
    async (resourceUri) => ({
      contents: [await readContextResource(resourceUri.toString())],
    }),
  );
  registerTemplate(server, `${name}-level`, `${uri}{?level}`, description);
}

function registerTemplate(
  server: McpServer,
  name: string,
  uriTemplate: string,
  description: string,
): void {
  server.registerResource(
    name,
    new ResourceTemplate(uriTemplate, { list: undefined }),
    { description, mimeType: 'text/markdown' },
    async (resourceUri) => ({
      contents: [await readContextResource(resourceUri.toString())],
    }),
  );
}
