import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgents, loadHistories, removeAgent, saveAgent, saveHistory } from '../src/services/storage.js';
import { host } from '../src/services/utools.js';

function resetDatabase() {
  for (const document of host.db.allDocs('')) host.db.remove(document._id);
  host.dbStorage.removeItem('sortAiIds');
}

function makeAgent(id, extra = {}) {
  return { _id: id, nickname: id, params: { messages: [{ role: 'system', content: '角色指令' }] }, ...extra };
}

test('stores the role prompt encrypted and reads it back intact', async () => {
  resetDatabase();
  saveAgent(makeAgent('ai@1'));
  assert.ok(host.db.get('ai@1').params.messages[0].content.startsWith('U2FsdGVkX1'));
  const [agent] = await loadAgents();
  assert.equal(agent.params.messages[0].content, '角色指令');
});

test('keeps an empty role prompt empty instead of falling back to its ciphertext', async () => {
  resetDatabase();
  saveAgent(makeAgent('ai@1', { params: { messages: [{ role: 'system', content: '' }] } }));
  const [agent] = await loadAgents();
  assert.equal(agent.params.messages[0].content, '');
});

test('pins agents ahead of the rest whether is_top is false or missing entirely', async () => {
  resetDatabase();
  host.dbStorage.setItem('sortAiIds', ['ai@a', 'ai@b', 'ai@c']);
  saveAgent(makeAgent('ai@a'));
  saveAgent(makeAgent('ai@b', { is_top: false }));
  saveAgent(makeAgent('ai@c', { is_top: true }));
  assert.deepEqual((await loadAgents()).map((agent) => agent._id), ['ai@c', 'ai@a', 'ai@b']);
});

test('round-trips history messages and sorts the newest topic first', () => {
  resetDatabase();
  saveHistory({ id: 'chat@ai@1#1000', title: '旧话题', messages: [{ role: 'user', content: '你好' }] });
  saveHistory({ id: 'chat@ai@1#2000', title: '新话题', messages: [{ role: 'user', content: '再见' }] });
  const histories = loadHistories();
  assert.deepEqual(histories.map((history) => history.title), ['新话题', '旧话题']);
  assert.deepEqual(histories[1].messages, [{ role: 'user', content: '你好' }]);
  assert.equal(histories[0].agentId, 'ai@1');
  assert.equal(histories[0].sortKey, 2000);
});

test('recovers the agent id from a history id that has no # separator', () => {
  resetDatabase();
  saveHistory({ id: 'chat@ai@legacy', title: '旧记录', messages: [] });
  const [history] = loadHistories();
  assert.equal(history.agentId, 'ai@legacy');
  assert.equal(history.sortKey, 0);
});

test('preserves the original creation date when a topic is re-saved', () => {
  resetDatabase();
  saveHistory({ id: 'chat@ai@1#1000', title: '话题', messages: [] });
  host.db.put({ ...host.db.get('chat@ai@1#1000'), createdDate: '2020/1/1 00:00:00' });
  saveHistory({ id: 'chat@ai@1#1000', title: '话题', messages: [], favorite: true });
  const stored = host.db.get('chat@ai@1#1000');
  assert.equal(stored.createdDate, '2020/1/1 00:00:00');
  assert.equal(stored.isFavorite, true);
  assert.notEqual(stored.updatedDate, undefined);
});

test('deleting an agent also deletes its topics', () => {
  resetDatabase();
  saveAgent(makeAgent('ai@1'));
  saveHistory({ id: 'chat@ai@1#1000', title: '话题', messages: [] });
  saveHistory({ id: 'chat@ai@2#1000', title: '别人的话题', messages: [] });
  removeAgent('ai@1');
  assert.equal(host.db.get('ai@1'), null);
  assert.deepEqual(loadHistories().map((history) => history._id), ['chat@ai@2#1000']);
});
