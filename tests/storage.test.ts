import { test } from 'vitest';
import { strict as assert } from 'node:assert';
import { loadAgents, loadHistories, removeAgent, saveAgent, saveHistory, stripImagesToFit } from '../src/services/storage.ts';
import { host } from '../src/services/utools.ts';

const LEGACY_DOCUMENTS_KEY = 'browser.db';
const MIGRATED_KEY = 'funchat.documents.migrated';

function resetDatabase() {
  for (const document of host.db.allDocs('')) host.db.remove(document._id);
  host.dbStorage.removeItem('sortAiIds');
  // 默认让搬迁处于「已完成」状态，只有专门测搬迁的用例才会把它放开
  host.dbStorage.removeItem(LEGACY_DOCUMENTS_KEY);
  host.dbStorage.setItem(MIGRATED_KEY, true);
}

function makeAgent(id, extra = {}) {
  return { _id: id, nickname: id, params: { messages: [{ role: 'system', content: '角色指令' }] }, ...extra };
}

test('stores the role prompt in uTools dbStorage and reads it back intact', async () => {
  resetDatabase();
  saveAgent(makeAgent('ai@1'));
  assert.equal(host.db.get('ai@1').params.messages[0].content, '角色指令');
  const [agent] = await loadAgents();
  assert.equal(agent.params.messages[0].content, '角色指令');
});

test('keeps an empty role prompt empty instead of falling back to its ciphertext', async () => {
  resetDatabase();
  saveAgent(makeAgent('ai@1', { params: { messages: [{ role: 'system', content: '' }] } }));
  const [agent] = await loadAgents();
  assert.equal(agent.params.messages[0].content, '');
});

test('loadAgents returns every stored agent regardless of pin state', async () => {
  resetDatabase();
  saveAgent(makeAgent('ai@a'));
  saveAgent(makeAgent('ai@b', { is_top: false }));
  saveAgent(makeAgent('ai@c', { is_top: true }));
  assert.deepEqual(new Set((await loadAgents()).map((agent) => agent._id)), new Set(['ai@a', 'ai@b', 'ai@c']));
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

/* ---------- 带图会话的体积兜底 ---------- */

function imageMessage(text, url) {
  return { role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url } }] };
}

test('keeps images untouched while the topic fits in the budget', () => {
  const messages = [imageMessage('看图', 'data:image/png;base64,AAAA')];
  assert.deepEqual(stripImagesToFit(messages, 10_000), messages);
});

test('drops the oldest image data first and keeps every message text', () => {
  const big = `data:image/png;base64,${'A'.repeat(4000)}`;
  const messages = [imageMessage('第一张', big), imageMessage('第二张', big)];

  const fitted = stripImagesToFit(messages, 5000);

  assert.equal(fitted[0].content[1].image_url.url, '', '最老的图先丢');
  assert.equal(fitted[1].content[1].image_url.url, big, '预算够了就不再往下丢');
  assert.deepEqual(fitted.map((message) => message.content[0].text), ['第一张', '第二张']);
  assert.equal(messages[0].content[1].image_url.url, big, '传入的消息不该被改写');
});

test('saveHistory writes image parts through unchanged', () => {
  resetDatabase();
  const url = 'data:image/png;base64,AAAA';
  saveHistory({ id: 'chat@ai@1#1000', title: '话题', messages: [imageMessage('看图', url)] });

  const stored = host.db.get('chat@ai@1#1000');
  assert.deepEqual(stored.messages[0].content[1], { type: 'image_url', image_url: { url } });
});

/* ---------- 文档库写入语义 ---------- */

test('rejects a write whose _rev no longer matches the stored document', () => {
  resetDatabase();
  host.db.put({ _id: 'ai@1', nickname: '甲' });
  const stale = host.db.get('ai@1');
  host.db.put({ ...stale, nickname: '乙' });

  const conflict = host.db.put({ ...stale, nickname: '丙' });
  assert.equal(conflict.error, true);
  assert.equal(conflict.name, 'conflict');
  assert.equal(host.db.get('ai@1').nickname, '乙');
});

test('saveAgent retries a stale write instead of dropping the edit', () => {
  resetDatabase();
  saveAgent(makeAgent('ai@1'));
  const agent = makeAgent('ai@1', { _rev: '1-outdated', nickname: '改过的名字' });
  saveAgent(agent);
  assert.equal(host.db.get('ai@1').nickname, '改过的名字');
  // 重试后的新 _rev 要写回传入对象，否则下一次保存又会撞一次冲突
  assert.equal(agent._rev, host.db.get('ai@1')._rev);
});

test('saveHistory keeps working when the topic was written behind its back', () => {
  resetDatabase();
  saveHistory({ id: 'chat@ai@1#1000', title: '原标题', messages: [] });
  host.db.put({ ...host.db.get('chat@ai@1#1000'), title: '别处改的' });
  saveHistory({ id: 'chat@ai@1#1000', title: '新标题', messages: [{ role: 'user', content: '你好' }] });
  assert.equal(host.db.get('chat@ai@1#1000').title, '新标题');
});

/* ---------- 0.1.x 单键存储的搬迁 ---------- */

function stageLegacyBlob(documents) {
  resetDatabase();
  host.dbStorage.setItem(LEGACY_DOCUMENTS_KEY, Object.fromEntries(documents.map((document) => [document._id, document])));
  host.dbStorage.removeItem(MIGRATED_KEY);
}

test('moves 0.1.x documents out of the single dbStorage blob into the document db', async () => {
  stageLegacyBlob([
    { _id: 'ai@1', _rev: '7-storage', nickname: '旧好友', params: { messages: [{ role: 'system', content: '角色指令' }] } },
    { _id: 'chat@ai@1#1000', _rev: '3-storage', title: '旧话题', messages: [{ role: 'user', content: '你好' }] },
  ]);

  const agents = await loadAgents();
  assert.deepEqual(agents.map((agent) => agent._id), ['ai@1']);
  assert.equal(agents[0].params.messages[0].content, '角色指令');
  // 旧库的 _rev 不能照搬进新库，否则后续写入永远冲突
  assert.equal(agents[0]._rev, '1-browser');
  assert.deepEqual(loadHistories().map((history) => history.title), ['旧话题']);
});

test('migration leaves the legacy blob untouched as a backup', async () => {
  stageLegacyBlob([{ _id: 'ai@1', nickname: '旧好友' }]);
  await loadAgents();
  assert.deepEqual(Object.keys(host.dbStorage.getItem(LEGACY_DOCUMENTS_KEY)), ['ai@1']);
});

test('migration runs once, so a deleted agent does not come back', async () => {
  stageLegacyBlob([{ _id: 'ai@1', nickname: '旧好友' }]);
  await loadAgents();
  removeAgent('ai@1');
  saveAgent(makeAgent('ai@2'));
  assert.deepEqual((await loadAgents()).map((agent) => agent._id), ['ai@2']);
});

test('migration skips documents the document db already has', async () => {
  stageLegacyBlob([{ _id: 'ai@1', nickname: '旧好友' }]);
  saveAgent(makeAgent('ai@1', { nickname: '新好友' }));
  const agents = await loadAgents();
  assert.deepEqual(agents.map((agent) => agent.nickname), ['新好友']);
});
