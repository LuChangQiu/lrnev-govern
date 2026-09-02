import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './dist/mcp/server.js';
import { tmpdir } from 'os';
import { mkdirSync } from 'fs';
import { join } from 'path';

const testDir = join(tmpdir(), 'lrnev-debug-' + Date.now());
mkdirSync(testDir, { recursive: true });
process.env.LRNEV_WORKSPACE = testDir;

const server = createMcpServer();
const client = new Client({ name: 'debug-client', version: '0.0.1' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

await Promise.all([
  server.connect(serverTransport),
  client.connect(clientTransport),
]);

await client.callTool({ name: 'lrnev_init', arguments: { root: testDir, project_name: 'demo' } });
await client.callTool({ name: 'scene_create', arguments: { name: 'test-scene' } });
await client.callTool({ name: 'spec_create', arguments: { scene: 'test-scene', name: 'test-spec' } });
await client.callTool({ name: 'task_create', arguments: { scene: 'test-scene', spec: 'test-spec', title: 'test task' } });

const tools = [
  { name: 'spec_get', args: { scene: 'test-scene', spec: 'test-spec' } },
  { name: 'project_status', args: {} },
  { name: 'task_list', args: { scene: 'test-scene', spec: 'test-spec', view: 'readable' } },
  { name: 'task_claim', args: { scene: 'test-scene', spec: 'test-spec', task: 'T-001', agent_id: 'test-agent' } },
  { name: 'scene_list', args: {} },
  { name: 'spec_list', args: { scene: 'test-scene' } },
  { name: 'adr_list', args: { scope: 'global' } },
  { name: 'error_search', args: { query: 'test', scope: 'global' } },
  { name: 'memory_search', args: { query: 'test', scope: 'global' } },
  { name: 'agent_list', args: {} },
  { name: 'lrnev_doctor', args: {} },
];

for (const tool of tools) {
  try {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    if (text.startsWith('MCP error')) {
      console.log(`\n❌ ${tool.name}:`);
      console.log(text.substring(0, 500));
    } else {
      console.log(`✓ ${tool.name}`);
    }
  } catch (err) {
    console.log(`\n❌ ${tool.name} threw:`);
    console.log(err.message);
  }
}

await client.close();
await server.close();
