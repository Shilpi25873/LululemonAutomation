// File: global-setup.ts
import { createDB } from './db/dbUtility'; 
import { chromium, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { readExcelSheet } from './support/excelUtil';
import { fileURLToPath } from 'url';
import { saveHeaderMap, headerMapExists } from './utils/headerMap';
import type { HeaderIndexMap } from './types/headerMap';
import { TESTDATA } from './globals';
import { sheetExists } from './support/excelUtil';

console.log('GLOBAL SETUP RUNING.........');


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sectionToCrawl = process.env.SECTION as 'MARKDOWNS' | 'NEWNESS';

interface ProductInfo {
  id: number; 
  name: string;
  href: string;
}

// const buildHeaderIndexMap = (headers: unknown[]): HeaderIndexMap => {
//   const map: HeaderIndexMap = {};

//   headers.forEach((header, index) => {
//     if (header) {
//       map[String(header).trim().toLowerCase()] = index;
//     }
//   });

//   return map;
// };


const buildHeaderIndexMap = (headers: unknown[]): HeaderIndexMap => {
  console.log('are we here?');
  
  const map: HeaderIndexMap = {};

  headers.forEach((header, index) => {
    if (!header) return;

    const key = String(header).trim().toLowerCase();

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(index);
  });

  return map;
};
//   const map: HeaderIndexMap = {};

//   headers.forEach((header, index) => {
//     if (!header) return;

//     const key = String(header).trim().toLowerCase();

//     if (!map[key]) {
//       map[key] = [];
//     }

//     map[key].push(index);
//   });

//   return map;
// };

async function crawlAllProducts(page: Page, products: ProductInfo[], region:string) {
  console.log('🌐 Loading all products...');

  let lastCount = 0;
  let scrollCount = 0;

  while (true) {
    scrollCount++;

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new products to appear
    try {
      // Wait up to 5 seconds for at least one more product than before
      await page.waitForFunction(
        (lastCount) => document.querySelectorAll('.product-tile').length > lastCount,
        lastCount,
        { timeout: 5000 }
      );
    } catch {
      // No new products loaded in timeout
      await closeWelcomeModal(page);
      let viewMore;
      if(region === 'CAN-FR'){
        viewMore = page.getByRole('link', { name: 'Voir plus de produits' });
      }else {
        // viewMore = page.getByRole('link', { name: 'View More Products' });
        viewMore = page.getByText('View More Products' );
      }
      
      if ((await viewMore.count()) > 0) {
        console.log('⬇️ Clicking "View More Products" button...');
        try {
          console.log('inside');
          console.log(await viewMore.count());
          
          
          await viewMore.first().click();
          await closeWelcomeModal(page);
          await page.waitForTimeout(5000);
        } catch {
          console.log('⚠️ Could not click "View More Products", stopping...');
          break;
        }
      } else {
        console.log('🏁 All products loaded');
        break;
      }
    }

    const productContainers = page.locator('.product-tile');
    const count = await productContainers.count();
    console.log(`🛒 Found ${count} products on screen (scroll ${scrollCount})`);

    // Collect products
    for (let i = 0; i < count; i++) {
      const container = productContainers.nth(i);
      const aTag = container.locator('a[data-productid].link.lll-font-weight-medium');

      const name = await aTag.innerText().catch(() => null);
      const href = await aTag.getAttribute('href').catch(() => null);
      const idAttr = await aTag.getAttribute('data-productid').catch(() => null);
      const id = idAttr ? Number(idAttr) : scrollCount * 1000 + i;

      if (name && href && !products.find(p => p.href === href)) {
        products.push({ id, name, href });
        if (products.length % 50 === 0) {
          console.log(`📦 Collected ${products.length} products so far...`);
        }
      }
    }

    lastCount = products.length;
    await page.waitForTimeout(500); // small pause before next scroll
  }
}

export async function closeWelcomeModal(page: Page) {
  const modal = page.locator('dialog[open].welcome-offer-modal_modalContainer__1Dh3J');
  if (await modal.count() > 0) {
    console.log('🛑 Closing welcome modal...');
    const closeButton = modal.locator('button'); // adjust selector if necessary
    if (await closeButton.count() > 0) {
      await closeButton.first().click();
      await page.waitForTimeout(1000);
      console.log('✅ Welcome modal closed');
    } else {
      console.log('⚠️ Could not find close button for welcome modal');
    }
  }
}

// export type Region = 'USA' | 'CAN-EN' | 'CAN-FR';
type CrawlRegion = 'USA' | 'CAN-EN' | 'CAN-FR';
export type HeaderRegion = 'USA' | 'CAN';

// function detectRegionFromHeaders(headers: unknown[]): Region {
//   const normalizedHeaders = headers
//     .map(h => String(h).toLowerCase())
//     .join(' ');

//   if (normalizedHeaders.includes('can')) {
//     return 'CAN';
//   }

//   if (normalizedHeaders.includes('usa')) {
//     return 'USA';
//   }

//   throw new Error('❌ Could not determine region from Excel headers');
// }

export async function crawlAndStoreProducts(page: Page, outputFile: string, region: string) {
  const baseURL = 'https://preview.lululemon.com/c/we-made-too-much/n18mhd';
  const canURL = "https://preview.lululemon.com/en-ca/c/we-made-too-much/n18mhd";
  const canfrURL = "https://preview.lululemon.com/fr-ca/c/we-made-too-much/n18mhd"

   const urls: Record<string, Record<string, string>> = {
    'MARKDOWNS': {
      'USA': 'https://preview.lululemon.com/c/we-made-too-much/n18mhd',
      'CAN-EN': 'https://preview.lululemon.com/en-ca/c/we-made-too-much/n18mhd',
      'CAN-FR': 'https://preview.lululemon.com/fr-ca/c/we-made-too-much/n18mhd',
    },
    'NEWNESS': {
      'USA': 'https://preview.lululemon.com/c/whats-new/n1q0cf',
      'CAN-EN': 'https://preview.lululemon.com/en-ca/c/whats-new/n1q0cf',
      'CAN-FR': 'https://preview.lululemon.com/fr-ca/c/whats-new/n1q0cf',
    },
  };

  const url = urls[sectionToCrawl][region];
  sectionToCrawl=== 'MARKDOWNS'?console.log('🌐 Navigating to "We Made Too Much" section...'):console.log("🌐 Navigating to What's New section...");
  await page.goto(url);
  // if(region=== 'USA'){
  //   await page.goto(baseURL);
  // }else if(region=== 'CAN-EN'){
  //   await page.goto(canURL);
  // }else {
  //   await page.goto(canfrURL);
  // }
  
  await page.waitForLoadState('domcontentloaded');
  console.log('✅ Page loaded');

  const products: ProductInfo[] = [];

  await crawlAllProducts(page, products,region);

  fs.writeFileSync(path.resolve(outputFile), JSON.stringify(products, null, 2), 'utf-8');
  console.log(`✅ Stored ${products.length} products to JSON at ${outputFile}`);
}

function getHeaderRegion(region: CrawlRegion): HeaderRegion {
  return region === 'USA' ? 'USA' : 'CAN';
}



async function globalSetup() {
  console.log('--- GLOBAL SETUP START ---');

  createDB();
  console.log('🗄 DB initialized');

  const EXCEL_PATH = TESTDATA.Path;

  // 1️⃣ Determine which crawl regions exist
  const crawlRegions: CrawlRegion[] = [];

  if(sectionToCrawl == 'MARKDOWNS'){
      if (sheetExists(EXCEL_PATH, 'USA Markdowns')) {
          crawlRegions.push('USA');
        }

      if (sheetExists(EXCEL_PATH, 'CAN Markdowns')) {
        crawlRegions.push('CAN-EN', 'CAN-FR');
      }
  }else {
     if (sheetExists(EXCEL_PATH, 'USA Newness')) {
        crawlRegions.push('USA');
      }

      if (sheetExists(EXCEL_PATH, 'CAN Newness')) {
        crawlRegions.push('CAN-EN', 'CAN-FR');
      }
  }
 

  if (crawlRegions.length === 0) {
    console.warn('⚠️ No regions found in Excel. Skipping setup.');
    return;
  }

  console.log(`🌍 Crawl regions: ${crawlRegions.join(', ')}`);

  // 2️⃣ Build header maps (once per market)
  const headerRegions = new Set<HeaderRegion>(
    crawlRegions.map(getHeaderRegion)
  );

  for (const headerRegion of headerRegions) {
    if (headerMapExists(sectionToCrawl,headerRegion)) {
      console.log(`✅ Header map exists for ${headerRegion}`);
      continue;
    }

    let sheetName;
    if(sectionToCrawl==='MARKDOWNS'){
      sheetName = headerRegion === 'USA' ? 'USA Markdowns' : 'CAN Markdowns';
    }else {
       sheetName = headerRegion === 'USA' ? 'USA Newness' : 'CAN Newness';
    }
    

    const data = readExcelSheet(EXCEL_PATH, sheetName);
    const headerRow = data[1];

    if (!headerRow) {
      throw new Error(`Header row missing for ${headerRegion}`);
    }

    const headerIndexMap = buildHeaderIndexMap(headerRow);
    saveHeaderMap(sectionToCrawl,headerRegion, headerIndexMap);

    console.log(`💾 Header map saved for ${headerRegion}`);
  }

  // 3️⃣ Crawl products (can be isolated or shared browser)
  for (const region of crawlRegions) {
    const outputFile = path.resolve(
      __dirname,
      'data',
      sectionToCrawl,
      `products-${region.toLowerCase()}.json`
    );

    fs.mkdirSync(path.dirname(outputFile), { recursive: true });

    if (fs.existsSync(outputFile)) {
      console.log(`✅ Products already crawled for ${sectionToCrawl} - ${region}`);
      continue;
    }

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
      console.log(`🚀 Crawling ${sectionToCrawl} for ${region}`);
      await crawlAndStoreProducts(page, outputFile, region);
    } finally {
      await browser.close();
    }
  }

  console.log('✅ Global setup finished');
  console.log('--- GLOBAL SETUP END ---');
}


export default globalSetup;
