export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function documentHtml(title, content) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; } body { margin: 0; font: 11pt/1.4 sans-serif; color: #000; background: #fff; overflow-wrap: anywhere; }
h1 { font-size: 18pt; } h2 { font-size: 13pt; margin: 5mm 0 2mm; } p { margin: 2mm 0; }
table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #000; padding: 2mm; text-align: left; } thead { display: table-header-group; } tr { break-inside: avoid; }
.signature { max-width: 75mm; max-height: 35mm; object-fit: contain; } footer { margin-top: 6mm; font-size: 9pt; } @media print { button { display: none; } }
</style></head><body>${content}<footer>Document de travail généré par Frigo — ne remplace pas le Cerfa officiel signé.</footer></body></html>`;
}

export function buildCerfaHtml(intervention, company = {}) {
  const i = intervention;
  const signature = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(i.signatureDataUrl ?? '') ? i.signatureDataUrl : '';
  const rows = [
    ['Marque', i.marque], ['Modèle', i.modele], ['Numéro de série', i.numeroSerie],
    ['Fluide', i.fluide], ['Charge totale (kg)', i.chargeTotale],
    ['Type d’intervention', i.typeOperation], ['Date', i.date], ['Poids avant (kg)', i.poidsAvant],
    ['Poids après (kg)', i.poidsApres], ['Charge récupérée (kg)', i.chargeRecuperee],
    ['Longueur circuit (m)', i.longueurCircuit]
  ];
  return documentHtml('Frigo — Document de travail', `<h1>Fiche d’intervention — fluides frigorigènes</h1>
<p>Référence : ${escapeHtml(i.id)}</p><h2>Détenteur de l’équipement</h2>
<p>${escapeHtml(i.client || 'Non renseigné')}<br>${escapeHtml(i.clientAdresse)}</p>
<h2>Opérateur</h2><p>${escapeHtml(company.name)} — SIRET : ${escapeHtml(company.siret)}<br>${escapeHtml(company.address)}</p>
<p>Contact : ${escapeHtml(company.contact)} · ${escapeHtml(company.phone)} · ${escapeHtml(company.mail)}</p>
<h2>Équipement et intervention</h2><table><tbody>${rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value ?? 'Non renseigné')}</td></tr>`).join('')}</tbody></table>
<h2>Signature</h2><p>${escapeHtml(i.nomSignataire)}</p>${signature ? `<img class="signature" alt="Signature de ${escapeHtml(i.nomSignataire)}" src="${signature}">` : '<p>Signature non renseignée</p>'}`);
}

export function printDoc(html) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Autorisez les fenêtres contextuelles pour imprimer le document.');
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  // Attend aussi le décodage de la signature avant d’ouvrir l’impression.
  const ready = () => Promise.all([...popup.document.images].map(img => img.decode().catch(() => false)))
    .then(() => { popup.focus(); popup.print(); });
  if (popup.document.readyState === 'complete') return ready();
  return new Promise(resolve => popup.addEventListener('load', resolve, { once: true })).then(ready);
}
