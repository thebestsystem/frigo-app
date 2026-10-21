import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStep1, validateStep2, chargeRecuperee, loadQueue, toBsffPayload, toPrintableHtml, createIntervention, saveQueue, QUEUE_KEY } from '../js/model.js';

const data = {
  marque: 'Daikin', modele: 'RXYQ12T', numeroSerie: 'SN-42', fluide: 'R32', chargeTotale: 4.5,
  typeOperation: 'Maintenance', date: '2026-10-21', poidsAvant: 12.34, poidsApres: 4.10,
  longueurCircuit: '', nomSignataire: 'Camille Martin'
};
const signature = 'data:image/png;base64,aGVsbG8=';

test('validation étape 1 : charge strictement positive et fluide obligatoire', () => {
  assert.deepEqual(validateStep1(data), {});
  for (const chargeTotale of [0, -1, '', NaN, Infinity]) assert.ok(validateStep1({ ...data, chargeTotale }).chargeTotale);
  for (const fluide of ['', undefined, 'R22']) assert.ok(validateStep1({ ...data, fluide }).fluide);
  for (const field of ['marque', 'modele']) assert.ok(validateStep1({ ...data, [field]: '  ' })[field]);
});

test('validation étape 2 : refuse un poids après supérieur au poids avant', () => {
  assert.deepEqual(validateStep2(data), {});
  assert.ok(validateStep2({ ...data, poidsApres: 13 }).poidsApres);
  assert.ok(validateStep2({ ...data, poidsApres: -1 }).poidsApres);
  assert.ok(validateStep2({ ...data, poidsAvant: 0 }).poidsAvant);
  assert.ok(validateStep2({ ...data, poidsApres: '' }).poidsApres);
  assert.ok(validateStep2({ ...data, typeOperation: '' }).typeOperation);
  assert.deepEqual(validateStep2({ ...data, poidsApres: 0 }), {});
});

test('chargeRecuperee : arrondit à deux décimales et interdit les poids invalides', () => {
  assert.equal(chargeRecuperee(12.34, 4.10), 8.24);
  assert.equal(chargeRecuperee(1, 0.995), 0.01);
  assert.equal(chargeRecuperee(10, 10), 0);
  assert.throws(() => chargeRecuperee(1, 2), RangeError);
  assert.throws(() => chargeRecuperee('', 0), RangeError);
});

test('loadQueue : tolère le JSON corrompu et relit une intervention persistée', () => {
  assert.deepEqual(loadQueue({ getItem: () => '{cassé' }), []);
  for (const value of ['null', '{}', '42', '[null]']) assert.deepEqual(loadQueue({ getItem: () => value }), []);
  assert.deepEqual(loadQueue({ getItem: () => { throw new Error('Stockage bloqué'); } }), []);
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const intervention = createIntervention(data, signature);
  assert.match(intervention.id, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i);
  assert.equal(new Date(intervention.createdAt).toISOString(), intervention.createdAt);
  assert.equal(intervention.status, 'pending');
  assert.equal(intervention.chargeRecuperee, 8.24);
  saveQueue([intervention], storage);
  assert.ok(values.has(QUEUE_KEY));
  assert.deepEqual(loadQueue(storage), [intervention]);
  assert.throws(() => createIntervention(data, ''), /signature/);
});

test('toBsffPayload : structure stable et aucune valeur undefined, même imbriquée', () => {
  function check(value) {
    assert.notEqual(value, undefined);
    if (value && typeof value === 'object') Object.values(value).forEach(check);
  }
  const intervention = createIntervention(data, signature);
  const payload = toBsffPayload(intervention);
  check(payload);
  check(toBsffPayload({}));
  assert.deepEqual(payload, { type: 'COLLECTE_PETITES_QUANTITES', waste: { description: 'R32' }, weight: { value: 8.24, isEstimate: false } });
  assert.deepEqual(payload, toBsffPayload(intervention));
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
});

test('toPrintableHtml : contient le signataire, la signature et la mention obligatoire', () => {
  const html = toPrintableHtml(createIntervention(data, signature));
  assert.ok(html.includes('Camille Martin'));
  assert.ok(html.includes(`<img `));
  assert.ok(html.includes(`src="${signature}"`));
  assert.ok(html.includes('Document de travail — ne remplace pas le Cerfa officiel signé'));
  assert.ok(html.includes('8.24 kg'));
  const escaped = toPrintableHtml({ ...data, nomSignataire: '<script>alert(1)</script>', signatureDataUrl: '" onerror="alert(1)' });
  assert.ok(!escaped.includes('<script>'));
  assert.ok(!escaped.includes('onerror='));
});
