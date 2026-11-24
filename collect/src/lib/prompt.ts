import type { Language, Phrase } from './types';

export function promptFor(
  phrase: Phrase,
  language: Language,
): { text: string; hint: string; fallbackFr: boolean } {
  if (language === 'fr') {
    return {
      text: phrase.fr,
      hint: 'Lisez cette phrase en français, comme au téléphone.',
      fallbackFr: false,
    };
  }

  const translated = (language === 'fon' ? phrase.fon : phrase.yo).trim();
  const name = language === 'fon' ? 'fon' : 'yoruba';
  if (translated) {
    return {
      text: translated,
      hint: `Lisez cette phrase en ${name}.`,
      fallbackFr: false,
    };
  }

  return {
    text: phrase.fr,
    hint: `Dites cette phrase en ${name}. Le français indique seulement le sens.`,
    fallbackFr: true,
  };
}
