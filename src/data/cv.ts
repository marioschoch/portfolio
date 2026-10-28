/**
 * CV — single source of truth for the /cv page and the downloadable PDF (src/pages/[...lang]/cv/pdf.astro,
 * printed to public/cv/ by `npm run cv:pdf`). Re-run that script after every change here.
 *
 * Text fields accept either a plain string (same in all languages) or { en, de }.
 * Dates are 'YYYY-MM' strings, or just 'YYYY' when the month doesn't matter; omit `end`
 * for ongoing entries. Projects reference project folder names, so titles and links
 * stay in sync with the project pages automatically.
 *
 * Privacy: no address, phone number or date of birth, neither here nor on the PDF.
 */
import { locales, useTranslations, type Lang } from '@/i18n/utils';

export type Text = string | { en: string; de: string };

export interface CvEntry {
  title: Text;
  org: Text;
  location?: Text;
  start: string;
  end?: string;
  /** Bullet points: achievements, responsibilities, focus. */
  details?: Text[];
  /** A written thesis with its own project page, shown under the entry. */
  thesis?: { title: string; note: Text; project: string };
}

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Cv {
  headline: Text;
  /** A few sentences about you, shown under the name. */
  about: Text;
  education: CvEntry[];
  experience: CvEntry[];
  /** Project folder names from src/content/projects, in display order. */
  projects: string[];
  skills: { category: Text; items: Text[] }[];
  languages: { language: Text; level: Cefr | 'native' }[];
  awards: { title: Text; org?: Text; date: string }[];
  volunteering: CvEntry[];
}

export const cv: Cv = {
  headline: {
    en: 'Mechanical engineering student (BSc) at ETH Zürich.',
    de: 'Maschinenbaustudent (BSc) an der ETH Zürich.',
  },

  // Draft from the "Qualitäten" and "Hobbys" of the old CV. Rewrite it in your own voice.
  about: {
    en: 'I grew up between languages: school in English in Bangalore, then bilingual German and French in Biel. I am hard-working, do every job with care and precision, and enjoy work where I can use my hands. In my free time I am usually on my road bike, in the mountains or exploring a new country.',
    de: 'Ich bin mehrsprachig aufgewachsen: Schule auf Englisch in Bangalore, danach zweisprachig Deutsch und Französisch in Biel. Ich bin fleissig, erledige jede Arbeit sorgfältig und präzise und arbeite gerne mit den Händen. In meiner Freizeit bin ich am liebsten auf dem Rennrad, in den Bergen oder unterwegs in einem neuen Land.',
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
      title: {
        en: 'Bilingual Matura, German and French',
        de: 'Zweisprachige Matura Deutsch und Französisch',
      },
      org: 'Gymnasium Biel-Seeland',
      location: 'Biel/Bienne',
      start: '2020',
      end: '2024',
      details: [
        {
          en: 'Major: Italian · Supplementary subject: Computer Science',
          de: 'Schwerpunktfach: Italienisch · Ergänzungsfach: Informatik',
        },
      ],
      thesis: {
        title: 'Von Muskelkraft zu Strom',
        note: {
          en: 'a rowing ergometer turned into a generator',
          de: 'ein Ruderergometer als Stromgenerator',
        },
        project: 'maturarbeit',
      },
    },
    {
      title: {
        en: 'Bilingual secondary school, German and French',
        de: 'Zweisprachige Sekundarstufe Deutsch und Französisch',
      },
      org: 'Filière Bilingue',
      location: 'Biel/Bienne',
      start: '2018',
      end: '2020',
    },
    {
      title: {
        en: 'International school, taught in English',
        de: 'Internationale Schule, Unterrichtssprache Englisch',
      },
      org: 'Canadian International School',
      location: { en: 'Bangalore, India', de: 'Bangalore, Indien' },
      start: '2013',
      end: '2017',
    },
  ],

  experience: [
    {
      title: { en: 'R&D Intern', de: 'Praktikant Forschung & Entwicklung' },
      org: 'BMC Switzerland',
      start: '2026-06',
      end: '2026-06',
      details: [
        {
          en: 'One-month internship in the research & development department.',
          de: 'Einmonatiges Praktikum in der Abteilung Forschung & Entwicklung.',
        },
      ],
    },
    {
      title: { en: 'Sales and goods receipt', de: 'Verkauf und Wareneingang' },
      org: 'Veloplus',
      location: 'Ostermundigen',
      start: '2025',
      end: '2025',
    },
    {
      title: { en: 'Road construction', de: 'Strassenbau' },
      org: 'Seelandjob AG',
      start: '2024',
      end: '2024',
    },
    {
      title: { en: 'Production worker', de: 'Mitarbeiter Produktion' },
      org: 'Keldan GmbH',
      start: '2021',
      end: '2024',
    },
    {
      title: { en: 'Cashier', de: 'Kassierer' },
      org: 'Coop',
      start: '2020',
      end: '2021',
    },
  ],

  projects: [],

  skills: [
    { category: 'CAD', items: ['Onshape', 'Siemens NX'] },
    { category: { en: 'Programming', de: 'Programmierung' }, items: ['C++', 'Python'] },
    {
      category: 'Embedded',
      items: [
        'Arduino',
        'ESP32',
        { en: 'PID control', de: 'PID-Regelung' },
        { en: 'Sensors & actuators', de: 'Sensoren & Aktoren' },
      ],
    },
    {
      category: { en: 'Workshop', de: 'Werkstatt' },
      items: [
        { en: '3D printing', de: '3D-Druck' },
        { en: 'Bicycle mechanics', de: 'Velomechanik' },
      ],
    }, // TODO
  ],

  languages: [
    { language: { en: 'German', de: 'Deutsch' }, level: 'native' },
    { language: { en: 'English', de: 'Englisch' }, level: 'C2' },
    { language: { en: 'French', de: 'Französisch' }, level: 'B2' },
    { language: { en: 'Italian', de: 'Italienisch' }, level: 'A2' },
  ],

  awards: [
    // TODO: add awards, scholarships or competition results — or leave empty to hide the section.
  ],

  volunteering: [
    {
      title: { en: 'Board member', de: 'Vorstandsmitglied' },
      org: 'VELOVE Uni ZH',
      location: 'Zürich',
      start: '2025-09', // TODO: month
      details: [
        {
          en: 'Non-profit offering free bike repairs to students: organising repair sessions, mentoring volunteers and rebuilding the website.',
          de: 'Non-Profit-Verein mit kostenlosen Velo-Reparaturen für Studierende: Organisation von Reparaturtagen, Einarbeitung von Freiwilligen und Neuaufbau der Website.',
        },
      ],
    },
  ],
};

/** Resolve a `Text` for a language (a plain string is the same in every language). */
export function tx(text: Text | undefined, lang: Lang): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;
  return text[lang];
}

/** '2024-07' → 'Jul 2024' in the given language; a plain year stays as it is. */
export function cvDate(date: string, lang: Lang): string {
  if (/^\d{4}$/.test(date)) return date;
  return new Intl.DateTimeFormat(locales[lang], {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}-01T00:00:00Z`));
}

/** 'Sep 2025 – present', '2021 – 2024', or a single date when an entry starts and ends together. */
export function cvRange(e: { start: string; end?: string | undefined }, lang: Lang): string {
  if (e.end === e.start) return cvDate(e.start, lang);
  const end = e.end ? cvDate(e.end, lang) : useTranslations(lang)('spec.present');
  return `${cvDate(e.start, lang)} – ${end}`;
}

/** Position of a level on the six CEFR steps (A1 = 1 … C2 = 6); a native language fills all six. */
export function cefrStep(level: Cefr | 'native'): number {
  return level === 'native' ? 6 : ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(level) + 1;
}
