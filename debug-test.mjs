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

try {
  await client.callTool({ name: 'lrnev_init', arguments: { root: testDir, project_name: 'demo' } });
  await client.callTool({ name: 'scene_create', arguments: { name: 'user-management' } });
  await client.callTool({ name: 'spec_create', arguments: { scene: 'user-management', name: 'user-login' } });

  const result = await client.callTool({
    name: 'spec_gate_check',
    arguments: { scene: 'user-management', spec: 'user-login', gate: 'ready' },
  });

  console.log('=== Result ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n=== Content Text ===');
  const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
  console.log(text);
} catch (err) {
  console.error('Error:', err);
}

await client.close();
await server.close();
