export type CrawlRegion = 'USA' | 'CAN-EN' | 'CAN-FR';
export type Section = 'MARKDOWNS' | 'NEWNESS';

export const RuntimeEnv = {
  region: process.env.CRAWL_REGION as CrawlRegion,
  section: process.env.SECTION as Section,
};
