/** JSON-LD `Person` structured data (used on the home and about pages). */
import { site } from '@/data/site';

export const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: site.name,
  url: site.url,
  jobTitle: 'Mechanical Engineering Student',
  description: site.tagline.en,
  affiliation: { '@type': 'CollegeOrUniversity', name: 'ETH Zürich', url: 'https://ethz.ch' },
  memberOf: { '@type': 'Organization', name: 'VELOVE Uni ZH' },
  address: { '@type': 'PostalAddress', addressLocality: 'Zürich', addressCountry: 'CH' },
  knowsAbout: ['Mechatronics', 'Embedded systems', 'Mechanical design', 'CAD', 'Bicycle mechanics', 'Web development'],
  sameAs: [site.links.github, site.links.linkedin],
};
