import type { Language } from './types';

export const LANGUAGE_LABELS: Record<Language, string> = {
  fon: 'Fon',
  yoruba: 'Yoruba',
  fr: 'Français',
};

export const INTENT_LABELS: Record<string, string> = {
  consulter_solde: 'Solde',
  comprendre_frais: 'Frais',
  consulter_budget: 'Budget',
  preparer_transfert: 'Transfert',
  confirmation: 'Confirmation',
  hors_sujet: 'Hors sujet',
};

export function intentLabel(intent: string): string {
  return INTENT_LABELS[intent] ?? intent;
}

export function genderLabel(value: string): string {
  if (value === 'femme') return 'Femme';
  if (value === 'homme') return 'Homme';
  // Valeur encore présente sur d'anciennes prises.
  if (value === 'non_dit') return 'Je ne précise pas';
  return '';
}
