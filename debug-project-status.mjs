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

const result = await client.callTool({ name: 'project_status', arguments: {} });
console.log('Full result:', JSON.stringify(result, null, 2));
const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
console.log('\nContent text:', text.substring(0, 1000));

await client.close();
await server.close();
