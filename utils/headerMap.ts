import fs from 'fs';
import path from 'path';
import type { HeaderIndexMap } from '../types/headerMap';
import { HeaderRegion } from '../global-setup';

// Generate a path based on the header region
const getHeaderMapPath = (section: 'MARKDOWNS' | 'NEWNESS',region: HeaderRegion) =>
  path.resolve(
    process.cwd(),
    `artifacts/${section}/header-index-map-${region.toLowerCase()}.json`
  );

export const headerMapExists = (section: 'MARKDOWNS' | 'NEWNESS',region: HeaderRegion): boolean => {
  const filePath = getHeaderMapPath(section,region);
  return fs.existsSync(filePath);
};

export const saveHeaderMap = (section: 'MARKDOWNS' | 'NEWNESS',region: HeaderRegion, map: HeaderIndexMap): void => {
  const filePath = getHeaderMapPath(section, region);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(map, null, 2), 'utf-8');
};

export const loadHeaderMap = (section: 'MARKDOWNS' | 'NEWNESS',region: HeaderRegion): HeaderIndexMap => {
  const filePath = getHeaderMapPath(section,region);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Header index map not found for ${region} in section ${section}. Did globalSetup run?`
    );
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};
