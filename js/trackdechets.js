export const ENDPOINTS = Object.freeze({
  sandbox: 'https://api.sandbox.trackdechets.beta.gouv.fr',
  production: 'https://api.trackdechets.beta.gouv.fr'
});

export const GRAPHQL_CREATE_DRAFT_BSFF = `mutation CreateDraftBsff($input: BsffInput!) {
  createDraftBsff(input: $input) { id }
}`;

export function buildDraftBsffVariables(intervention, company = {}) {
  const fields = ['siret', 'name', 'contact', 'phone', 'mail', 'address'];
  const known = Object.fromEntries(fields.filter(key => typeof company[key] === 'string' && company[key].trim())
    .map(key => [key, company[key].trim()]));
  return { input: { type: 'BSFF', emitter: { company: known } } };
}

export async function sendDraftBsff(intervention, company, { token, endpoint = ENDPOINTS.sandbox, dryRun = true, fetchImpl } = {}) {
  const body = { query: GRAPHQL_CREATE_DRAFT_BSFF, variables: buildDraftBsffVariables(intervention, company) };
  if (dryRun) return { ok: true, dryRun: true, body };
  if (!token?.trim()) return { ok: false, error: 'jeton TrackDéchets manquant' };
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'Transport réseau TrackDéchets manquant' };
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    let raw = '';
    let data;
    if (typeof response.text === 'function') {
      raw = await response.text();
      try { data = JSON.parse(raw); } catch { data = {}; }
    } else {
      data = await response.json();
    }
    const message = data.errors?.map(error => error.message).filter(Boolean).join(' · ') || data.message || data.error;
    if (!response.ok || data.errors?.length) return { ok: false, error: String(message || raw || `Erreur HTTP ${response.status}`) };
    const id = data.data?.createDraftBsff?.id;
    if (!id) return { ok: false, error: 'Réponse TrackDéchets sans identifiant de brouillon' };
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error.message || 'Connexion TrackDéchets impossible' };
  }
}
