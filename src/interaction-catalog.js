/*
 * Interaction catalog.
 *
 * Estes são componentes que a plataforma poderá montar.
 * O conteúdo da interação pode vir estruturado do provedor de texto,
 * mas a implementação visual/comportamental permanece na plataforma.
 */

export const INTERACTION_CATALOG = Object.freeze({
  calculator: {
    label: 'Calculadora',
    slot: 'interactions',
    requires: ['inputs', 'formula'],
    renderer: 'platform'
  },
  checklist: {
    label: 'Checklist',
    slot: 'interactions',
    requires: ['items'],
    renderer: 'platform'
  },
  quiz: {
    label: 'Quiz',
    slot: 'interactions',
    requires: ['questions'],
    renderer: 'platform'
  },
  comparison: {
    label: 'Comparação',
    slot: 'interactions',
    requires: ['items'],
    renderer: 'platform'
  },
  timeline: {
    label: 'Linha do tempo',
    slot: 'interactions',
    requires: ['items'],
    renderer: 'platform'
  },
  steps: {
    label: 'Passo a passo',
    slot: 'interactions',
    requires: ['steps'],
    renderer: 'platform'
  },
  cta: {
    label: 'Chamada para ação',
    slot: 'interactions',
    requires: ['label', 'target'],
    renderer: 'platform'
  }
});

export function normalizeInteractions(interactions = []) {
  if (!Array.isArray(interactions)) return [];

  return interactions
    .filter(item => item && INTERACTION_CATALOG[item.type])
    .slice(0, 4)
    .map(item => ({
      type: item.type,
      title: String(item.title || INTERACTION_CATALOG[item.type].label),
      data: item.data && typeof item.data === 'object'
        ? item.data
        : {}
    }));
}
