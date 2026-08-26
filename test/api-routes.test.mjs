import assert from 'node:assert/strict';
import test from 'node:test';
import { activeRoute, loadSettings, routesFromLegacy, syncActiveRoute } from '../src/services/storage.js';
import { host } from '../src/services/utools.js';

function resetSettings() {
  host.dbStorage.removeItem('funchat.settings');
  host.dbStorage.removeItem('apiProxy');
  host.dbStorage.removeItem('isDark');
}

test('keeps every legacy route instead of only the open one', () => {
  // 这正是退化点：老实现只取 isOpen 那条，其余线路被永久丢弃
  const routes = routesFromLegacy([
    { url: 'https://a.example.com', apiKey: 'ka', isOpen: false },
    { url: 'https://b.example.com', apiKey: 'kb', isOpen: true },
    { url: 'https://c.example.com', apiKey: 'kc', isOpen: false },
  ]);
  assert.equal(routes.length, 3);
  assert.deepEqual(routes.map((route) => route.baseUrl), [
    'https://a.example.com',
    'https://b.example.com',
    'https://c.example.com',
  ]);
});

test('marks the previously open legacy route as active', () => {
  resetSettings();
  host.dbStorage.setItem('apiProxy', [
    { url: 'https://a.example.com', apiKey: 'ka', isOpen: false },
    { url: 'https://b.example.com', apiKey: 'kb', isOpen: true },
  ]);
  const settings = loadSettings();
  assert.equal(settings.apiRoutes.length, 2);
  assert.equal(settings.baseUrl, 'https://b.example.com');
  assert.equal(settings.apiKey, 'kb');
});

test('recognises the uTools AI entry in legacy data', () => {
  const [route] = routesFromLegacy([{ value: 200, isOpen: true }]);
  assert.equal(route.provider, 'utools');
  assert.equal(route.name, 'uTools AI');
});

test('skips blank legacy entries', () => {
  assert.deepEqual(routesFromLegacy([null, {}, { url: '' }]), []);
  assert.deepEqual(routesFromLegacy(undefined), []);
});

test('wraps a single-route legacy install into the list form', () => {
  resetSettings();
  host.dbStorage.setItem('funchat.settings', {
    provider: 'openai',
    baseUrl: 'https://old.example.com',
    apiKey: 'legacy-key',
    theme: 'dark',
  });
  const settings = loadSettings();
  assert.equal(settings.apiRoutes.length, 1);
  assert.equal(settings.apiRoutes[0].baseUrl, 'https://old.example.com');
  assert.equal(settings.activeRouteId, settings.apiRoutes[0].id);
});

test('leaves routes empty when there is nothing to migrate', () => {
  resetSettings();
  const settings = loadSettings();
  assert.deepEqual(settings.apiRoutes, []);
  assert.equal(settings.baseUrl, '');
});

test('mirrors the active route onto the flat fields', () => {
  const settings = {
    apiRoutes: [
      { id: 'r1', provider: 'openai', baseUrl: 'https://one.example.com', apiKey: 'k1' },
      { id: 'r2', provider: 'utools', baseUrl: '', apiKey: '' },
    ],
    activeRouteId: 'r2',
  };
  syncActiveRoute(settings);
  assert.equal(settings.provider, 'utools');
  assert.equal(settings.baseUrl, '');
});

test('falls back to the first route when the active id is stale', () => {
  const settings = {
    apiRoutes: [{ id: 'r1', provider: 'openai', baseUrl: 'https://one.example.com', apiKey: 'k1' }],
    activeRouteId: 'deleted-route',
  };
  assert.equal(activeRoute(settings).id, 'r1');
  syncActiveRoute(settings);
  assert.equal(settings.activeRouteId, 'r1');
  assert.equal(settings.baseUrl, 'https://one.example.com');
});
