// markdown.spec.ts
import { test, expect } from '@playwright/test';
import { POManager } from '../actions/POManager';
import { readExcelSheet, readExcelCell } from "../support/excelUtil";
import { TESTDATA } from '../globals';
import fs from 'fs';
import path from 'path';
import type { HeaderRegion } from '../global-setup';
import { loadHeaderMap } from '../utils/headerMap';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Accept the region from environment variable
const REGION = process.env.CRAWL_REGION as 'USA' | 'CAN-EN' | 'CAN-FR';
if (!REGION) throw new Error("Please provide CRAWL_REGION environment variable (USA, CAN-EN, CAN-FR)");

const HEADER_REGION: HeaderRegion = REGION === 'USA' ? 'USA' : 'CAN';

const SECTION = process.env.SECTION as 'MARKDOWNS' | 'NEWNESS';

const headerIndexMap = loadHeaderMap(SECTION,HEADER_REGION);
// const h = (name: string, pick: 'first' | 'last' = 'first'): number => {
//   const key = name.trim().toLowerCase();
//   const indices = headerIndexMap[key];

//   if (!indices || indices.length === 0) {
//     return 0;
//   }

//   const index = pick === 'last'
//     ? indices[indices.length - 1]
//     : indices[0];

//   return index;
// };
const h = (name: string) => headerIndexMap[name.trim().toLowerCase()];
// Normalize utilities
const normalizeName = (name: string) => name.replace(/[\/"*]/g, '').trim();
const safeTrim = (value: string | number | null | undefined) => value?.toString().trim() || "";
const formatPrice = (value: string | number | null | undefined) => {
  const v = value?.toString().trim() || "";
  return v.startsWith("$") ? v : v ? `$${v}` : "";
};

// Load product JSON for this region
const jsonPath = path.resolve(__dirname, `../data/${SECTION}/products-${REGION.toLowerCase()}.json`);
if (!fs.existsSync(jsonPath)) {
  throw new Error(`Product JSON not found for region ${SECTION} - ${REGION}: ${jsonPath}`);
}
const productJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Load Excel sheet for this region
const newnessSheetName = HEADER_REGION === 'USA' ? 'USA Newness' : 'CAN Newness';
const data = readExcelSheet(TESTDATA.Path, newnessSheetName);

test.describe(`CDP Tests for ${SECTION} - ${REGION}`, () => {
  let poManager: POManager;

  test.beforeEach(async ({ page }) => {
    poManager = new POManager(page);
  });

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const ID = row[0];

    const Notes = safeTrim(row[h('Notes')]);
    const ProductName = safeTrim(row[h('Ecomm Name')]);
    const FREcommName = safeTrim(row[h('fr ecomm name')]);
    const ColourDescription = safeTrim(row[h('Colour Description')]);
    const SizeRun = safeTrim(row[h('Size Run')]);
    const MarkdownPID = safeTrim(row[h('MD PID')]);
    const RegularPID = safeTrim(row[h('REG PID')]);
    const RegularPrice = formatPrice(row[h('Reg Price')]);
    const MarkdownPrice = formatPrice(row[h('MD Price')]);
    const Images = formatPrice(row[h('images')]);

    test(`[NS-P${ID}] Validate Newness: ${ProductName} (${RegularPID})`, async () => {
      const timeStart = Date.now();
      const homePage = poManager.getHomePage();

      try {
        let productData;
        if(!(REGION==='CAN-FR')){
          console.log('WE ARE SEARCHING IN JSON FOR NON-CAN-FR LOCALES');
          productData = productJson.find((p: any) => normalizeName(p.name) === normalizeName(ProductName));
        } else {
          console.log('WE ARE SEARCHING IN JSON');
          
           productData = productJson.find((p: any) => normalizeName(p.name) === normalizeName(FREcommName));
        }

        if (!productData) {
          let foundOnSearch;
            if(!(REGION==='CAN-FR')){
              console.log('entering here for', ProductName);
              
              foundOnSearch = await homePage.searchProductById(ID, RegularPID, ProductName);
              console.log('exiting for', ProductName);
              
          } else {
           await homePage.searchProductById(ID, RegularPID, FREcommName);
          }
          if (!foundOnSearch) return;
          console.log('made it past this for,', ProductName);
          
        } else {
          await homePage.crawlToProduct(productData.href);
        }

        if(!(REGION==='CAN-FR')){
          console.log('getting into veryfying product');
          
          await homePage.verifyProduct(ID, ProductName, ColourDescription);
        } else {
           await homePage.verifyProduct(ID, FREcommName, ColourDescription);
        }
        
        await homePage.verifyMarkdProductPrice(ID, RegularPrice, MarkdownPrice);
        if(!(REGION==='CAN-FR')){
          await homePage.verifyProductSize(ID, SizeRun);
        }
        await homePage.verifyProductImages(ID,Images);

      } catch (error) {
        throw error;
      }

      const timeEnd = Date.now();
      console.log(`TimeTaken: ${((timeEnd - timeStart)/1000).toFixed(2)}s`);
    });
  }
});
