/**
 * "Now" section on the home page: what you are currently working on.
 * Keep it to 2–4 short items and bump `updated` whenever you edit it.
 * TODO: replace the placeholder items.
 */
import type { Text } from './cv';

export const now: { updated: string; items: Text[] } = {
  updated: '2026-10-17',
  items: [
    {
      en: 'Autumn semester at ETH — currently deep into control systems and mechatronics.',
      de: 'Herbstsemester an der ETH — aktuell vertieft in Regelungstechnik und Mechatronik.',
    },
    {
      en: 'Finishing the VELOVE website rebuild and writing an editing guide for volunteers.',
      de: 'Abschluss des VELOVE-Website-Neuaufbaus und Bearbeitungsanleitung für Freiwillige.',
    },
    {
      en: 'Looking for an engineering internship in mechatronics or product development.',
      de: 'Auf der Suche nach einem Ingenieurpraktikum in Mechatronik oder Produktentwicklung.',
    },
  ],
};
