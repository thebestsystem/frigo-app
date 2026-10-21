export const QUEUE_KEY = 'frigo.interventions.v1';
export const OPERATIONS = ['Mise en service', 'Maintenance', 'Démontage'];
const present = value => typeof value === 'string' && value.trim().length > 0;
const numeric = value => (typeof value === 'number' || present(value)) && Number.isFinite(Number(value));

export function validateStep1(data) {
  const errors = {};
  if (!present(data.marque)) errors.marque = 'Indiquez la marque.';
  if (!present(data.modele)) errors.modele = 'Indiquez le modèle.';
  if (!['R32', 'R410A'].includes(data.fluide)) errors.fluide = 'Choisissez un fluide.';
  if (!numeric(data.chargeTotale) || Number(data.chargeTotale) <= 0) errors.chargeTotale = 'La charge totale doit être supérieure à 0 kg.';
  return errors;
}

export function validateStep2(data) {
  const errors = {};
  if (!OPERATIONS.includes(data.typeOperation)) errors.typeOperation = 'Choisissez une opération.';
  if (!numeric(data.poidsAvant) || Number(data.poidsAvant) <= 0) errors.poidsAvant = 'Le poids avant doit être supérieur à 0 kg.';
  if (!numeric(data.poidsApres) || Number(data.poidsApres) < 0) errors.poidsApres = 'Le poids après doit être positif ou nul.';
  else if (numeric(data.poidsAvant) && Number(data.poidsApres) > Number(data.poidsAvant)) errors.poidsApres = 'Le poids après ne peut pas dépasser le poids avant.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date ?? '') || !Number.isFinite(Date.parse(data.date))) errors.date = 'Indiquez une date valide.';
  if (data.longueurCircuit !== '' && data.longueurCircuit != null && (!numeric(data.longueurCircuit) || Number(data.longueurCircuit) < 0)) errors.longueurCircuit = 'La longueur doit être positive ou nulle.';
  return errors;
}

export function chargeRecuperee(avant, apres) {
  if (!numeric(avant) || !numeric(apres) || Number(avant) <= 0 || Number(apres) < 0 || Number(apres) > Number(avant)) throw new RangeError('Poids invalides.');
  return Math.round((Number(avant) - Number(apres) + Number.EPSILON) * 100) / 100;
}

export function createIntervention(data, signatureDataUrl, { id = globalThis.crypto.randomUUID(), createdAt = new Date().toISOString() } = {}) {
  const errors = { ...validateStep1(data), ...validateStep2(data) };
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
  if (!present(data.nomSignataire) || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signatureDataUrl)) throw new Error('Le nom et la signature sont obligatoires.');
  return {
    id, createdAt, marque: data.marque.trim(), modele: data.modele.trim(),
    numeroSerie: String(data.numeroSerie ?? '').trim(), fluide: data.fluide,
    chargeTotale: Number(data.chargeTotale), typeOperation: data.typeOperation, date: data.date,
    poidsAvant: Number(data.poidsAvant), poidsApres: Number(data.poidsApres),
    chargeRecuperee: chargeRecuperee(data.poidsAvant, data.poidsApres),
    longueurCircuit: data.longueurCircuit === '' || data.longueurCircuit == null ? null : Number(data.longueurCircuit),
    nomSignataire: data.nomSignataire.trim(), signatureDataUrl, status: 'pending'
  };
}

export function loadQueue(storage) {
  try {
    const queue = JSON.parse((storage ?? globalThis.localStorage).getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(queue) ? queue.filter(item => item && typeof item.id === 'string' && item.status === 'pending') : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue, storage = globalThis.localStorage) {
  storage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Sous-ensemble de BsffInput ; les acteurs et contenants seront ajoutés à l'intégration.
export function toBsffPayload(intervention) {
  const value = Number(intervention.chargeRecuperee ?? 0);
  return {
    type: 'COLLECTE_PETITES_QUANTITES',
    waste: { description: String(intervention.fluide ?? '') },
    weight: { value: Number.isFinite(value) ? Math.max(0, value) : 0, isEstimate: false }
  };
}

export function summaryEntries(data) {
  let recovered = '—';
  try { recovered = `${chargeRecuperee(data.poidsAvant, data.poidsApres).toFixed(2)} kg`; } catch { /* Saisie encore incomplète. */ }
  return [
    ['Marque', data.marque], ['Modèle', data.modele], ['Numéro de série', data.numeroSerie || 'Non renseigné'],
    ['Fluide', data.fluide], ['Charge totale', `${data.chargeTotale} kg`], ['Opération', data.typeOperation],
    ['Date', data.date], ['Poids avant', `${data.poidsAvant} kg`], ['Poids après', `${data.poidsApres} kg`],
    ['Charge récupérée', recovered], ['Longueur de circuit', data.longueurCircuit == null || data.longueurCircuit === '' ? 'Non renseignée' : `${data.longueurCircuit} m`],
    ['Signataire', data.nomSignataire || 'À renseigner']
  ];
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function toPrintableHtml(intervention) {
  const signature = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(intervention.signatureDataUrl ?? '') ? intervention.signatureDataUrl : '';
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Frigo — Document de travail</title><body style="font:18px/1.5 system-ui,sans-serif;color:#0b1c30;background:white;max-width:800px;margin:32px auto;padding:16px"><h1>Fiche d’intervention — fluides frigorigènes</h1><p>Document de travail — ne remplace pas le Cerfa officiel signé</p><p>Référence : ${escapeHtml(intervention.id)}<br>Enregistrée : ${escapeHtml(intervention.createdAt)}</p><dl>${summaryEntries(intervention).map(([key, value]) => `<dt style="font-weight:700">${escapeHtml(key)}</dt><dd style="margin:0 0 12px">${escapeHtml(value)}</dd>`).join('')}</dl><h2>Signature</h2><img style="width:100%;max-width:500px;border:1px solid #707881" alt="Signature de ${escapeHtml(intervention.nomSignataire)}" src="${signature}"></body></html>`;
}
