// Traduit un agregat de datasheet de l API vers la fiche que le panneau sait rendre
// Seul description.text est lu, jamais description.html : injecter le html exigerait
// innerHTML, que la revue a ferme

export function indexAbilities(items) {
  const index = new Map();
  for (const item of items ?? []) {
    if (item?.id) index.set(item.id, item);
  }
  return index;
}

function texte(description) {
  return typeof description?.text === 'string' ? description.text : '';
}

function suffixer(valeur) {
  const brut = String(valeur ?? '').trim();
  if (!brut || brut === '-') return null;
  return /^\d+$/.test(brut) ? `${brut}+` : brut;
}

function profils(models) {
  return (models ?? []).map((model) => ({
    name: model.name ?? '',
    m: model.M ?? '-',
    t: model.T ?? '-',
    sv: model.Sv ?? '-',
    w: model.W ?? '-',
    ld: model.Ld ?? '-',
    oc: model.OC ?? '-'
  }));
}

function invulnerable(models) {
  for (const model of models ?? []) {
    const valeur = suffixer(model.inv_sv);
    if (valeur) return valeur;
  }
  return null;
}

function portee(entry) {
  const brut = String(entry.range ?? '').trim();
  if (!brut) return '-';
  return /^\d+$/.test(brut) ? `${brut}"` : brut;
}

function armes(wargear) {
  return (wargear ?? []).map((entry) => ({
    name: entry.name ?? '',
    type: entry.type === 'Ranged' ? 'ranged' : 'melee',
    range: portee(entry),
    a: entry.A ?? '-',
    skill: suffixer(entry.BS_WS) ?? '-',
    s: entry.S ?? '-',
    ap: entry.AP ?? '-',
    d: entry.D ?? '-',
    keywords: String(entry.description ?? '')
      .split(',')
      .map((mot) => mot.trim())
      .filter(Boolean)
  }));
}

function aptitudes(entries, index) {
  return (entries ?? []).map((entry) => {
    const type = entry.type ?? '';
    if (entry.name) return { name: entry.name, type, text: texte(entry.description) };

    const resolue = entry.ability_id ? index.get(entry.ability_id) : undefined;
    if (resolue) return { name: resolue.name ?? type, type, text: texte(resolue.description) };

    // aptitude non resolvable : afficher son type sans texte est plus honnete
    // qu une entree fantome
    return { name: type, type, text: '' };
  });
}

function motsCles(keywords) {
  const tous = [...(keywords?.faction ?? []), ...(keywords?.other ?? [])];
  return [...new Set(tous.filter(Boolean))];
}

function paliers(costs) {
  return (costs ?? []).map((entry) => {
    const label = texte(entry.description);
    const nombre = Number.parseInt(label, 10);
    return {
      models: Number.isNaN(nombre) ? null : nombre,
      label,
      cost: entry.cost
    };
  });
}

export function mapDatasheet(aggregate, abilityIndex = new Map()) {
  if (!aggregate?.id || !aggregate?.name) return null;

  return {
    id: aggregate.id,
    name: aggregate.name,
    faction: aggregate.faction?.name ?? '',
    role: aggregate.role ?? '',
    profiles: profils(aggregate.models),
    invulnerable: invulnerable(aggregate.models),
    weapons: armes(aggregate.wargear),
    abilities: aptitudes(aggregate.abilities, abilityIndex),
    keywords: motsCles(aggregate.keywords),
    points: paliers(aggregate.costs),
    lore: aggregate.legend ?? '',
    books: [],
    source: { label: aggregate.source?.name ?? '', url: aggregate.link ?? '' }
  };
}
