import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFilename, escapeHtml, withSessionMetadata } from '../src/utils/formatters.js';

test('buildFilename normalizes extensions and rejects paths', () => {
    assert.deepEqual(buildFilename(' chat.JSON ', 'json'), {
        basename: 'chat',
        filename: 'chat.json',
    });
    assert.throws(() => buildFilename('../chat', 'json'), /非法字符/);
    assert.throws(() => buildFilename('.png', 'png'), /不能为空/);
});

test('escapeHtml makes plain text safe for HTML templates', () => {
    assert.equal(escapeHtml(`<img src="x" onerror='alert(1)'>&`), '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;');
});

test('withSessionMetadata identifies Agent sessions and tolerates invalid JSON', async () => {
    const files = [{ path: '/valid.json' }, { path: '/invalid.json' }];
    const result = await withSessionMetadata(files, async path => path === '/valid.json'
        ? JSON.stringify({ funchat_history: true, CODE: 'Writer' })
        : 'invalid');

    assert.deepEqual(result.map(({ isChatSession, agentCode }) => ({ isChatSession, agentCode })), [
        { isChatSession: true, agentCode: 'Writer' },
        { isChatSession: false, agentCode: '' },
    ]);
});
