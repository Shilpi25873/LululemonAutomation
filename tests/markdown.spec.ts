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

const SECTION = process.env.SECTION as 'MARKDOWNS' | 'NEWNESS';

// Accept the region from environment variable
const REGION = process.env.CRAWL_REGION as 'USA' | 'CAN-EN' | 'CAN-FR';
if (!REGION) throw new Error("Please provide CRAWL_REGION environment variable (USA, CAN-EN, CAN-FR)");

const HEADER_REGION: HeaderRegion = REGION === 'USA' ? 'USA' : 'CAN';
console.log('are we here?');

const headerIndexMap = loadHeaderMap(SECTION,HEADER_REGION);
// const h = (name: string) => headerIndexMap[name.trim().toLowerCase()];

const h = (name: string, occurrence = 0) => {
  const key = name.trim().toLowerCase();
  const indices = headerIndexMap[key];

  if (!indices || indices.length === 0) {
    throw new Error(`Header not found: ${name}`);
  }

  if (occurrence < 0 || occurrence >= indices.length) {
    throw new Error(
      `Header "${name}" has ${indices.length} occurrence(s), requested index ${occurrence}`
    );
  }

  return indices[occurrence];
};


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
  throw new Error(`Product JSON not found for region ${REGION}: ${jsonPath}`);
}
const productJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Load Excel sheet for this region
const markdownSheetName = HEADER_REGION === 'USA' ? 'USA Markdowns' : 'CAN Markdowns';
const data = readExcelSheet(TESTDATA.Path, markdownSheetName);

test.describe(`CDP Tests for ${REGION}`, () => {
  let poManager: POManager;

  test.beforeEach(async ({ page }) => {
    poManager = new POManager(page);
  });

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const ID = row[0];

    const Notes = safeTrim(row[h('Notes')]);
    const ProductName = safeTrim(row[h('Ecomm Name')]);
    // if(REGION=='CAN-FR'){
   
    // }
    const ColourDescription = safeTrim(row[h('Colour Description')]);
    const SizeRun = safeTrim(row[h('Size Run')]);
    const MarkdownPID = safeTrim(row[h('MD PID')]);
    const RegularPrice = formatPrice(row[h('Reg Price')]);
    const MarkdownPrice = formatPrice(row[h('MD Price')]);
        // const Images = safeTrim(row[h('images')]);
            //  const FREcommName = safeTrim(row[h('fr ecomm name')]);

    test(`[MD-P${ID}] Validate Markdown: ${ProductName} (${MarkdownPID})`, async () => {
      const timeStart = Date.now();
      const homePage = poManager.getHomePage();

      try {
        let productData;
        if(!(REGION==='CAN-FR')){
          productData = productJson.find((p: any) => normalizeName(p.name) === normalizeName(ProductName));
        } else {
           productData = productJson.find((p: any) => normalizeName(p.name) === normalizeName(FREcommName));
        }

        if (!productData) {
          let foundOnSearch;
            if(!(REGION==='CAN-FR')){
              console.log('entering here for', ProductName);
              
              foundOnSearch = await homePage.searchProductById(ID, MarkdownPID, ProductName);
              console.log('exiting for', ProductName);
              
          } else {
           await homePage.searchProductById(ID, MarkdownPID, FREcommName);
          }
          if (!foundOnSearch) return;
          console.log('made it past this for,', ProductName);
          
        } else {
          await homePage.crawlToProduct(productData.href);
        }

        if(!(REGION==='CAN-FR')){
          await homePage.verifyProduct(ID, ProductName, ColourDescription);
        } else {
           await homePage.verifyProduct(ID, FREcommName, ColourDescription);
        }
        
        await homePage.verifyMarkdProductPrice(ID, RegularPrice, MarkdownPrice);
        if(!(REGION==='CAN-FR')){
          await homePage.verifyProductSize(ID, SizeRun);
        }
        await homePage.verifyProductImages(ID,'');
        await homePage.verifyAccordions();
           await homePage.verifyAccordionBrokenLinks();

      } catch (error) {
        throw error;
      }

      const timeEnd = Date.now();
      console.log(`TimeTaken: ${((timeEnd - timeStart)/1000).toFixed(2)}s`);
    });
  }
});
