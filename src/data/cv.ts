/**
 * CV — single source of truth for the /cv page (web + print version).
 *
 * Text fields accept either a plain string (same in all languages) or { en, de }.
 * Missing German text falls back to English. Dates are 'YYYY-MM' strings; omit `end`
 * for ongoing entries. Projects reference project folder names, so titles and links
 * stay in sync with the project pages automatically.
 *
 * TODO: everything marked TODO is a placeholder — replace it with your real CV data.
 */
import type { Lang } from '@/i18n/utils';

export type Text = string | { en: string; de?: string };

export interface CvEntry {
  title: Text;
  org: Text;
  location?: Text;
  start: string;
  end?: string;
  /** Bullet points: achievements, responsibilities, focus. */
  details?: Text[];
}

export interface Cv {
  headline: Text;
  education: CvEntry[];
  experience: CvEntry[];
  /** Project folder names from src/content/projects, in display order. */
  projects: string[];
  skills: { category: Text; items: string[] }[];
  languages: { language: Text; level: Text }[];
  awards: { title: Text; org?: Text; date: string }[];
  volunteering: CvEntry[];
}

export const cv: Cv = {
  headline: {
    en: 'Mechanical engineering student (BSc) at ETH Zürich with a focus on mechatronics and embedded systems.',
    de: 'Maschinenbaustudent (BSc) an der ETH Zürich mit Schwerpunkt Mechatronik und Embedded Systems.',
  },

  education: [
    {
      title: {
        en: 'BSc Mechanical Engineering',
        de: 'BSc Maschineningenieurwissenschaften',
      },
      org: 'ETH Zürich, D-MAVT',
      location: 'Zürich',
      start: '2025-09',
      details: [
        // TODO: focus areas / relevant courses / GPA if you want to show it
        {
          en: 'Relevant courses: Mechatronics, Control Systems, Machine Elements, Dynamics, Informatics',
          de: 'Relevante Fächer: Mechatronik, Regelungstechnik, Maschinenelemente, Dynamik, Informatik',
        },
      ],
    },
    {
      title: { en: 'Matura (Swiss baccalaureate)', de: 'Matura' }, // TODO
      org: 'TODO: Gymnasium name',
      location: 'TODO',
      start: '2019-08', // TODO
      end: '2023-06', // TODO
      details: [
        {
          en: 'Major: Physics and Applied Mathematics',
          de: 'Schwerpunkt: Physik und Anwendungen der Mathematik',
        },
      ], // TODO
    },
  ],

  experience: [
    {
      title: { en: 'R&D Intern', de: 'Praktikant Forschung & Entwicklung' },
      org: 'BMC Switzerland',
      start: '2025-06',
      end: '2025-06',
      details: [
        {
          en: 'One-month internship in the research & development department.',
          de: 'Einmonatiges Praktikum in der Abteilung Forschung & Entwicklung.',
        },
      ],
    },
  ],

  projects: [],

  skills: [
    { category: 'CAD', items: ['Onshape', 'Siemens NX'] },
    { category: { en: 'Programming', de: 'Programmierung' }, items: ['C++', 'Python'] },
    {
      category: 'Embedded',
      items: ['Arduino', 'ESP32', 'PID control', 'Sensors & actuators'],
    },
    { category: { en: 'Workshop', de: 'Werkstatt' }, items: ['3D printing', 'Bicycle mechanics'] }, // TODO
  ],

  languages: [
    { language: { en: 'German', de: 'Deutsch' }, level: { en: 'Native', de: 'Muttersprache' } }, // TODO
    { language: { en: 'English', de: 'Englisch' }, level: 'C2' },
    { language: { en: 'French', de: 'Französisch' }, level: 'B2' },
  ],

  awards: [
    // TODO: add awards, scholarships or competition results — or leave empty to hide the section.
  ],

  volunteering: [
    {
      title: { en: 'Board member', de: 'Vorstandsmitglied' },
      org: 'VELOVE Uni ZH',
      location: 'Zürich',
      start: '2024-09', // TODO
      details: [
        {
          en: 'Non-profit offering free bike repairs to students: organising repair sessions, mentoring volunteers and rebuilding the website.',
          de: 'Non-Profit-Verein mit kostenlosen Velo-Reparaturen für Studierende: Organisation von Reparaturtagen, Einarbeitung von Freiwilligen und Neuaufbau der Website.',
        },
      ],
    },
  ],
};

/** Resolve a `Text` for a language, falling back to English. */
export function tx(text: Text | undefined, lang: Lang): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;
  return (lang === 'de' ? text.de : undefined) ?? text.en;
}
