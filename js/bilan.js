import { documentHtml, escapeHtml } from './cerfa.js';

export function aggregateBilan(interventions, year) {
  year = Number(year);
  const rows = interventions.filter(i => i && i.status !== 'draft' &&
    String(i.date ?? '').startsWith(`${year}-`) && ['R32', 'R410A'].includes(i.fluide));
  const byFluid = { R32: { n: 0, kg: 0 }, R410A: { n: 0, kg: 0 } };
  const entries = rows.map(i => {
    const kg = Number(i.chargeRecuperee);
    return { date: i.date, client: i.client ?? '', fluide: i.fluide, kg: Number.isFinite(kg) ? Math.max(0, kg) : 0 };
  });
  for (const row of entries) {
    byFluid[row.fluide].n++;
    byFluid[row.fluide].kg += Math.round(row.kg * 100);
  }
  for (const total of Object.values(byFluid)) total.kg /= 100;
  return { year, count: entries.length, byFluid, totalKg: Math.round(Object.values(byFluid).reduce((sum, v) => sum + v.kg, 0) * 100) / 100, entries };
}

export function buildBilanHtml(bilan, company = {}) {
  return documentHtml(`Frigo — Bilan F-Gas ${bilan.year}`, `<h1>Bilan F-Gas ${escapeHtml(bilan.year)}</h1>
<p>${escapeHtml(company.name)} — SIRET : ${escapeHtml(company.siret)}<br>${escapeHtml(company.address)}</p>
<table><thead><tr><th>Date</th><th>Client</th><th>Fluide</th><th>kg récupérés</th></tr></thead><tbody>${(bilan.entries ?? []).map(row => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.client)}</td><td>${escapeHtml(row.fluide)}</td><td>${escapeHtml(row.kg.toFixed(2))}</td></tr>`).join('')}</tbody></table>
<h2>Totaux</h2><p>${escapeHtml(bilan.count)} intervention(s)</p><table><thead><tr><th>Fluide</th><th>Interventions</th><th>kg récupérés</th></tr></thead><tbody>${Object.entries(bilan.byFluid).map(([fluid, total]) => `<tr><th scope="row">${escapeHtml(fluid)}</th><td>${escapeHtml(total.n)}</td><td>${escapeHtml(total.kg.toFixed(2))}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="2">Total (kg)</th><td>${escapeHtml(bilan.totalKg.toFixed(2))}</td></tr></tfoot></table>`);
}
