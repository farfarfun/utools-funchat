import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { agentFormValues } from '../src/features/agents/agent-form.js';
import { loadAgents } from '../src/services/storage.js';
import { host } from '../src/services/utools.js';
import { useChatStore } from '../src/stores/chat.js';

const store = useChatStore();
const seed = JSON.parse(fs.readFileSync(new URL('../public/data/agents.json', import.meta.url), 'utf8'));

function stripRev({ _rev, ...rest }) {
  return rest;
}

async function seedAgents() {
  for (const document of host.db.allDocs('')) host.db.remove(document._id);
  host.dbStorage.removeItem('sortAiIds');
  for (const source of seed) {
    const document = JSON.parse(JSON.stringify(source));
    delete document._rev;
    host.db.put(document);
  }
  return loadAgents();
}

function findAgent(agents, id) {
  return agents.find((agent) => agent._id === id);
}

test('seed data really is the original plugin export', () => {
  assert.equal(seed.length, 24);
  assert.equal(seed.filter((agent) => agent.params?.model === undefined).length, 16);
  assert.equal(seed.filter((agent) => agent.params?.top_p === undefined).length, 23);
});

test('opening and saving an agent unchanged leaves every document byte-identical', async () => {
  const before = (await seedAgents()).map(stripRev);
  store.state.agents = await seedAgents();
  for (const agent of store.state.agents) store.updateAgent(agent, agentFormValues(agent));
  const after = (await loadAgents()).map(stripRev);
  assert.deepEqual(after, before);
});

test('an agent without params.model keeps following the global model setting', async () => {
  const agents = await seedAgents();
  const agent = agents.find((item) => item.params?.model === undefined);
  assert.ok(agent, '种子数据里应存在不带 model 的角色');
  store.state.agents = agents;
  store.updateAgent(agent, agentFormValues(agent));
  assert.equal('model' in host.db.get(agent._id).params, false);
});

test('the image agent keeps its own params schema after an edit', async () => {
  const agents = await seedAgents();
  const painter = findAgent(agents, 'ai@0000000000004');
  assert.deepEqual(Object.keys(painter.params).sort(), ['messages', 'model', 'n', 'size']);
  store.state.agents = agents;
  store.updateAgent(painter, agentFormValues(painter));
  const saved = host.db.get('ai@0000000000004');
  assert.deepEqual(Object.keys(saved.params).sort(), ['messages', 'model', 'n', 'size']);
  assert.equal(saved.params.size, '1024x1024');
  assert.equal(saved.params.n, 1);
});

test('the few-shot preset survives editing the role prompt', async () => {
  const agents = await seedAgents();
  const helper = findAgent(agents, 'ai@0000000000005');
  assert.equal(helper.params.messages.length, 12);
  assert.equal(helper.params.messages[0].role, 'user');
  const original = helper.params.messages.map((message) => message.content);

  store.state.agents = agents;
  store.updateAgent(helper, { ...agentFormValues(helper), prompt: '你是帮助助手' });

  const saved = (await loadAgents()).find((item) => item._id === 'ai@0000000000005');
  assert.equal(saved.params.messages.length, 13);
  assert.deepEqual(saved.params.messages[0], { role: 'system', content: '你是帮助助手' });
  assert.deepEqual(saved.params.messages.slice(1).map((message) => message.content), original);
});

test('editing does not inject fields the original document never had', async () => {
  const agents = await seedAgents();
  const target = agents.find((item) => !('isFly' in item) && !('quick_questions' in item));
  assert.ok(target, '种子数据里应存在不带 isFly 的角色');
  store.state.agents = agents;
  store.updateAgent(target, agentFormValues(target));
  const saved = host.db.get(target._id);
  for (const key of ['isFly', 'isOverall', 'quick_questions', 'autoPrefix', 'status', 'api_id', 'un_stream', 'callback']) {
    assert.equal(key in saved, false, `不应注入字段 ${key}`);
  }
});

test('a real edit is still written back', async () => {
  const agents = await seedAgents();
  const agent = agents[0];
  store.state.agents = agents;
  store.updateAgent(agent, { ...agentFormValues(agent), nickname: '改过的名字', temperature: 1.5, autoPrefix: '请翻译:' });
  const saved = (await loadAgents()).find((item) => item._id === agent._id);
  assert.equal(saved.nickname, '改过的名字');
  assert.equal(saved.params.temperature, 1.5);
  assert.equal(saved.autoPrefix, '请翻译:');
});
