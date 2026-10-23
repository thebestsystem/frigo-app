import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCerfaHtml } from '../js/cerfa.js';
import { aggregateBilan, buildBilanHtml } from '../js/bilan.js';
import { buildDraftBsffVariables, sendDraftBsff, GRAPHQL_CREATE_DRAFT_BSFF, ENDPOINTS } from '../js/trackdechets.js';
import { loadQueue } from '../js/model.js';

const intervention = { id: 'old_1', date: '2026-10-23', marque: 'Daikin', fluide: 'R32', chargeRecuperee: 2.35, nomSignataire: 'Camille Martin', client: 'Client A', status: 'pending' };
const company = { siret: '12345678901234', name: 'Frigoriste', contact: undefined };

test('buildCerfaHtml : équipement, signataire et mention obligatoire, HTML autonome', () => {
  const html = buildCerfaHtml(intervention, company);
  for (const value of ['Daikin', 'R32', '2.35', 'Camille Martin', 'Client A', company.siret, 'Document de travail généré par Frigo — ne remplace pas le Cerfa officiel signé.', 'A4 portrait', '12mm']) assert.ok(html.includes(value));
  const escaped = buildCerfaHtml({ ...intervention, client: '<script>alert(1)</script>', signatureDataUrl: '" onerror="alert(1)' });
  assert.ok(!escaped.includes('<script>'));
  assert.ok(!escaped.includes('onerror='));
});

test('aggregateBilan : filtre année, brouillons et fluides inconnus ; lignes et totaux exacts', () => {
  const items = [intervention, { ...intervention, fluide: 'R410A', chargeRecuperee: 1.25 }, { ...intervention, date: '2025-10-23' }];
  const bilan = aggregateBilan(items, 2026);
  assert.equal(bilan.year, 2026);
  assert.equal(bilan.count, 2);
  assert.deepEqual(bilan.byFluid, { R32: { n: 1, kg: 2.35 }, R410A: { n: 1, kg: 1.25 } });
  assert.equal(bilan.totalKg, 3.6);
  const html = buildBilanHtml(bilan, company);
  for (const value of ['2026-10-23', 'Client A', 'R410A', '3.60']) assert.ok(html.includes(value));
  assert.equal(aggregateBilan([...items, { ...intervention, status: 'draft' }, { ...intervention, fluide: 'R22' }], 2026).count, 2);
});

test('buildDraftBsffVariables : type BSFF, SIRET et aucune valeur undefined récursive', () => {
  function check(value) {
    assert.notEqual(value, undefined);
    if (value && typeof value === 'object') Object.values(value).forEach(check);
  }
  const variables = buildDraftBsffVariables(intervention, company);
  check(variables);
  check(buildDraftBsffVariables({}));
  assert.equal(variables.input.type, 'BSFF');
  assert.equal(variables.input.emitter.company.siret, company.siret);
  assert.ok(!Object.hasOwn(variables.input.emitter.company, 'contact'));
});

test('sendDraftBsff : simulation par défaut sans aucun appel réseau', async () => {
  let calls = 0;
  const result = await sendDraftBsff(intervention, company, { fetchImpl: () => { calls++; throw new Error('Réseau interdit'); } });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.body.query, GRAPHQL_CREATE_DRAFT_BSFF);
  assert.deepEqual(result.body.variables, buildDraftBsffVariables(intervention, company));
  assert.equal(calls, 0);
});

test('sendDraftBsff : mode réel sans jeton, erreur explicite et aucun réseau', async () => {
  let calls = 0;
  const result = await sendDraftBsff(intervention, company, { dryRun: false, fetchImpl: () => { calls++; } });
  assert.deepEqual(result, { ok: false, error: 'jeton TrackDéchets manquant' });
  assert.equal(calls, 0);
});

test('sendDraftBsff : POST GraphQL authentifié et identifiant retourné', async () => {
  let calls = 0;
  const result = await sendDraftBsff(intervention, company, { dryRun: false, token: 'secret', endpoint: ENDPOINTS.sandbox,
    fetchImpl: async (endpoint, options) => {
      calls++;
      assert.equal(endpoint, ENDPOINTS.sandbox);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer secret');
      assert.equal(options.headers['Content-Type'], 'application/json');
      const body = JSON.parse(options.body);
      assert.deepEqual(body, { query: GRAPHQL_CREATE_DRAFT_BSFF, variables: buildDraftBsffVariables(intervention, company) });
      assert.match(body.query, /createDraftBsff\(input: \$input\)\s*\{\s*id\s*\}/);
      return new Response(JSON.stringify({ data: { createDraftBsff: { id: 'bsff_1' } } }));
    } });
  assert.deepEqual(result, { ok: true, id: 'bsff_1' });
  assert.equal(calls, 1);
});

test('sendDraftBsff : erreurs GraphQL 200, HTTP et réseau remontées', async () => {
  const send = fetchImpl => sendDraftBsff(intervention, company, { dryRun: false, token: 'secret', fetchImpl });
  assert.deepEqual(await send(async () => new Response(JSON.stringify({ errors: [{ message: 'SIRET invalide' }] }))), { ok: false, error: 'SIRET invalide' });
  for (const status of [400, 401, 500]) {
    assert.deepEqual(await send(async () => new Response(JSON.stringify({ message: `Serveur ${status}` }), { status })), { ok: false, error: `Serveur ${status}` });
  }
  assert.deepEqual(await send(async () => { throw new Error('Hors connexion'); }), { ok: false, error: 'Hors connexion' });
});

test('migration : ancien format sans status relu pending, statuts persistés conservés', () => {
  const { status, ...old } = intervention;
  const items = [old, { ...intervention, id: 'created', status: 'draft-created', trackdechetsId: 'bsff_1', sentAt: '2026-10-23T10:00:00.000Z', lastError: null }, { ...intervention, id: 'error', status: 'error', lastError: 'SIRET invalide' }];
  const loaded = loadQueue({ getItem: () => JSON.stringify(items) });
  assert.equal(loaded[0].status, 'pending');
  assert.deepEqual(loaded.slice(1), items.slice(1));
});
