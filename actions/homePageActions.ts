/*
This file is used for any action functions or methods that interact with the Home Page
 */
// pages/homePage.ts
import { Page, expect } from '@playwright/test';
import { HomePageLocator } from '../pages/homePageLocator';
import { Environment } from '../support/environment';
import {setMdPriceCorrect, upsertAndAppendProductData} from '../db/dbUtility'
import { RuntimeEnv } from '../support/runtimeEnv';

const { region, section } = RuntimeEnv;

const SIZE_NORMALIZATION_MAP: Record<string, string> = {
  '2XL': 'XXL',
  'XXL': 'XXL',
  '3XL': 'XXXL',
  'XXXL': 'XXXL',
  '4XL': 'XXXXL',
  'XXXXL': 'XXXXL',
  '5XL': 'XXXXXL',
  'XXXXXL': 'XXXXXL',
  'O/S': 'ONE SIZE',
  'OS': 'ONE SIZE',
  'ONE SIZE': 'ONE SIZE',
};

const normalizeSize = (rawSize: string): string => {
  const normalized = rawSize.trim().toUpperCase();
  return SIZE_NORMALIZATION_MAP[normalized] ?? normalized;
};



export class HomePage {
  private page: Page;
  private isColorVerified = false;
  colorFound: boolean;
  constructor(page: Page) {
    this.page = page;
    this.colorFound = false;
  }

  private async closeModalIfPresent() {
    const popup = this.page.locator(HomePageLocator.markdownHomePagePopUp);

    try {
      await popup.waitFor({ state: 'visible', timeout: 3000 });
      await this.page.locator(HomePageLocator.modalCloseButton).click();
    } catch {
      // intentionally ignored
    }
  }

 private getBaseUrl(): string {
  switch (region) {
    case 'USA':
      return 'https://preview.lululemon.com';
    case 'CAN-EN':
      return 'https://preview.lululemon.com/en-ca/';
    case 'CAN-FR':
      return 'https://preview.lululemon.com/fr-ca/';
    default:
      throw new Error(`Unsupported region: ${region}`);
  }
}

// HELPERS FOR verifyProduct FUNCTION
private normalizeColorName(raw: string): string {
  return raw
    .replace(/^New\s+/i, '')
    .replace(/\s*\(not available\)/i, '')
    .trim();
}

private async getColorLocatorAndTitle(expColor: string) {
  const locator = this.page.locator(HomePageLocator.expColor(expColor));
  await locator.first().waitFor({ state: 'visible' });
  const count = await locator.count();
  if (count === 0) {
    throw new Error(`Color "${expColor}" not found on PDP`);
  }
  if (count > 1) {
    throw new Error(`Multiple colors matched for "${expColor}"`);
  }
  const title = await locator.first().getAttribute('title');
  if (!title) {
    throw new Error('Color title missing');
  }
  return { locator, title };
}

private async verifyProductName(expectedName: string) {
  const actualName = await this.page
    .locator(HomePageLocator.expProductName)
    .textContent();

  if (!actualName) {
    throw new Error('Product name not found on PDP');
  }

  const cleanedExpected = expectedName
    .replace(/\*/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  const cleanedActual = actualName
    .trim()
    .replace(/\s+/g, ' ');

  expect(cleanedActual).toBe(cleanedExpected);
}

async hasFinalSaleBadge(): Promise<boolean> {
  try {
    const badge = this.page.locator(
      HomePageLocator.finalSaleBadge
    );

    if ((await badge.count()) === 0) {
      return false;
    }

    const text = await badge.first().textContent();
    return text?.trim() === 'Final Sale';
  } catch {
    return false;
  }
}

async verifyModelInformationVisible(ID: number) {
    const ModelInfo = this.page.locator(HomePageLocator.ModelInformationLocator);
 
    try {
      await ModelInfo.waitFor({ state: 'visible', timeout: 8000 });
      await expect(ModelInfo).toBeVisible();
    } catch {
      console.log("Model Information is not Available");
      upsertAndAppendProductData(ID, 'photo_notes', 'Model Information is not visible on PDP');
    }
  }

  // this function is for the checking breadcrumb is visible on PDP or not
  async verifyBreadCrumbVisible(ID: number) {
    const BreadCrumbContainer = this.page.locator(HomePageLocator.breadCrumbLocator);
 
    try {
      await BreadCrumbContainer.waitFor({ state: 'visible', timeout: 8000 });
      await expect(BreadCrumbContainer).toBeVisible()
    } catch {
      console.log("Breadcrumb not visible on PDP");
      upsertAndAppendProductData(ID, 'others_notes', 'BreadCrumb is not visible on PDP');
   
    }
 
  }
 
  // this function is for the Add to bag section is visible on PDP
  async verifyAddToBagVisible(ID: number) {
    const AddtoBag = this.page.locator(HomePageLocator.AddtoBagLocator);
 
    try {
      await AddtoBag.waitFor({ state: 'visible', timeout: 8000 });
      await expect(AddtoBag).toBeVisible();
    } catch {
      console.log("Add to Bag section is not visible");
      upsertAndAppendProductData(ID, 'others_notes', 'Add to Bag Section is not visible on PDP');
    }
 
  }

//HELPERS for verifyPrice FUNCTION
private normalizePrice(raw: string | null): string | null {
  if (!raw) return null;

  const cleaned = raw
    .trim()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ');

  if (region === 'CAN-FR') {
    const match = cleaned.match(/\$?\s*(\d+[.,]?\d*)/);
    return match ? `$${match[1].split(',')[0]}` : null;
  }

  return cleaned.split(' ')[0];
}

private async captureRegularPriceRange(ID: number) {
  let raw;

  if (section === 'MARKDOWNS') {
    raw = await this.page.locator(HomePageLocator.regularPrice).textContent();
  } else {
    raw = await this.page
      .locator(HomePageLocator.newnessRegularPrice)
      .first()
      .textContent();
  }

  if (!raw) return;

  const cleaned = raw.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ');

  if (cleaned.includes('-')) {
    const match = cleaned.match(/\$?\d+.*?\-\s*\$?\d+/);
    if (match) {
      const message =
        region === 'CAN-FR'
          ? `Regular Price Range ${match[0]} for CAN-FR`
          : `Regular Price Range ${match[0]}`;

      upsertAndAppendProductData(ID, 'price_notes', message);
    }
  }
}

private comparePrice(
  ID: number,
  actual: string | null,
  expected: string,
  type: 'MD' | 'REG'
) {
  try {
    expect(actual).toBe(expected);
    upsertAndAppendProductData(ID, 'price_notes', '');
    return true;
  } catch {
    let message;

    if (type === 'MD') {
      const placeholders = ['N/A', '-'];

      if (placeholders.some(p => expected.includes(p))) {
        message =
          region === 'CAN-FR'
            ? `Price avaialable on PDP: ${actual} for CAN-FR`
            : `Price avaialable on PDP: ${actual}`;
      } else {
        message =
          region === 'CAN-FR'
            ? `MD Price mismatch(${actual}) for CAN-FR`
            : `MD Price mismatch(${actual})`;
      }

      setMdPriceCorrect(ID, false);
    } else {
      message =
        region === 'CAN-FR'
          ? `Regular Price mismatch(${actual}) for CAN-FR`
          : `Regular Price mismatch(${actual})`;
    }

    upsertAndAppendProductData(ID, 'price_notes', message);
    return false;
  }
}


  async login(username: string, password: string) {
    await this.page.locator(HomePageLocator.username).fill(username);
    await this.page.locator(HomePageLocator.password).fill(password);
    await this.page.locator(HomePageLocator.loginButton).click();
  }

  async navigateToUrl(local: string) {
    let url = Environment.getEnvironment(local);
    console.log(`Navigate to URL: ${url}`);
    await this.page.goto(url);
    await this.closeModalIfPresent();
  }

  async acceptCookies() {
    await this.page.locator(HomePageLocator.homePagePopUp).click();
  }


  async crawlToProduct(href:string){
    const homePagePopUp = this.page.locator(
      HomePageLocator.markdownHomePagePopUp,
    );
    const link = "https://preview.lululemon.com" + href; // +href->/c/we-made-too-much/n18mhd
    if (href) {
      console.log('Navigating to:', link);//https://preview.lululemon.com/c/we-made-too-much/n18mhd"
      await this.page.goto(link);
      try {
      // Wait up to 5 seconds for popup to be visible
      await homePagePopUp.waitFor({ state: 'visible', timeout: 30000 });
      // If visible, click close button
      await this.page.locator(HomePageLocator.modalCloseButton).click();
    } catch {
      console.log('Popup not visible. continuing...');
    }
      // await closeWelcomeModal(this.page);
    } else {
      throw new Error(`No href found for locator: ${link}`);
    }
    return;
  }

  async colorUpdate(color: boolean) {
    this.colorFound = color;
  }

  async colorCheck() {
    return this.colorFound;
  }

  async colorUpdatenew(found: boolean) {
  this.isColorVerified = found;
}

  async colorChecknew() {
    return this.isColorVerified;
  }


  // async verifyProduct(ID: number, expProductName: string, expColor: string) {
  //   try {
  //     this.page.waitForSelector(HomePageLocator.expColor(expColor))
  //           const colorLocator = this.page.locator(
  //       HomePageLocator.expColor(expColor)
  //     );

  //     await colorLocator.first().waitFor({ state: 'visible' });

  //     const count = await colorLocator.count();
  //     console.log(`Color matches for "${expColor}":`, count);

  //     if (count === 0) {
  //       throw new Error(`Color "${expColor}" not found on PDP`);
  //     }

  //     if (count > 1) {
  //       // const allTitles = await colorLocator.allTextContents();
  //       // console.error(`Multiple colors matched for "${expColor}":`, allTitles);
  //       throw new Error(`Multiple colors matched for "${expColor}"`);
  //     }
  //     // await this.page.waitForSelector(HomePageLocator.expColor(expColor), { state: 'visible' });
      
  //     // const colorName = await this.page.locator(HomePageLocator.expColor(expColor)).getAttribute('title')
  //     const colorName = await colorLocator.first().getAttribute('title');
  //     console.log('Before check for truthy',colorName);
      
  //     expect(colorName).toBeTruthy();

  //     // Normalize UI title
  //     const normalizedColor = colorName!
  //       .replace(/^New\s+/i, '')
  //       .replace(/\s*\(not available\)/i, '')
  //       .trim();

  //     console.log('UI color:', colorName);
  //     console.log('Normalized:', normalizedColor);
  //     console.log('Expected:', expColor);

  //     expect(normalizedColor).toBe(expColor);
  //     await colorLocator.first().click();
  //     await this.colorUpdate(true);
  //   } catch (error) {
  //     let message;
  //     if(region==='CAN-FR'){
  //       message = `Not showing on PDP for CAN-FR`;
  //     }else {
  //       message = `Not showing on PDP`; 
  //     }
  //     upsertAndAppendProductData(ID, 'catalog_ops_notes', message);
  //     setMdPriceCorrect(ID, false);
  //     return;
  //   }

  //   try {
  //     // skipping validation if color not found
  //     if (!(await this.colorCheck())) {
  //       // console.log('Skipping product verification due to color not found.');
  //       return;
  //     }
  //    const productName = await this.page.locator(HomePageLocator.expProductName).textContent();
  //     // const productName = await this.page.locator('div.pdp-product-header h1').textContent();
  //     console.log('Actual product name:', productName);
  //     const currentProductUrl = this.page.url();
  //     console.log('Current product URL - ', currentProductUrl);
 
  //     // 1. Remove all '*' symbols (if they exist).
  //     const nameWithoutAsterisk = expProductName.replace(/\*/g, '');
 
  //     // 2. Clean up any excessive white spaces (including those potentially left by the replace)
  //     // and trim leading/trailing spaces.
  //     const expectedName = nameWithoutAsterisk.trim().replace(/\s+/g, ' ');
  //     console.log('Expected name after cleaning:', expectedName);
 
  //     expect(productName?.trim().replace(/\s+/g, ' ')).toBe(expectedName);
 
  //     let message = `Passed: ${expectedName}" is present.`;
  //   } catch (error) {
  //     const message = `Ecom name ${expProductName} not matched".`;
  //     console.error(message);
  //     return;
  //   }
  //   // If both pass then mark PASS
  //   const message = `Product "${expProductName}" with color "${expColor}" verified successfully.`;
  //   console.log(message);
  // }
  

  async verifyProduct(ID: number,expProductName: string,expColor: string) {
    const isFinalSale = await this.hasFinalSaleBadge();
   console.log(`Final Sale badge present: ${isFinalSale}`);
    await this.verifyModelInformationVisible(ID);
    console.log(`Model Information is visible on PDP ${ID}`);
    await this.verifyBreadCrumbVisible(ID);
    console.log(`BreadCrumb is visible on PDP ${ID}`);
 
    await this.verifyAddToBagVisible(ID);
    console.log(`Add to bag section is visible on PDP ${ID}`);

  let colorLocator;
  try {
    const result = await this.getColorLocatorAndTitle(expColor);
    const normalizedUIColor = this.normalizeColorName(result.title);
    expect(normalizedUIColor).toBe(expColor);

    // ✅ CLICK ONLY AFTER ASSERTION
    await result.locator.first().click();
    this.colorUpdate(true);

  } catch (error) {
    const message =
      region === 'CAN-FR'
        ? 'Not showing on PDP for CAN-FR'
        : 'Not showing on PDP';

    upsertAndAppendProductData(ID, 'catalog_ops_notes', message);
    setMdPriceCorrect(ID, false);
    return;
  }

  try {
    await this.verifyProductName(expProductName);
  } catch {
    console.error(`Ecom name ${expProductName} not matched.`);
    return;
  }

  console.log(
    `Product "${expProductName}" with color "${expColor}" verified successfully.`,
  );
}



async verifyProductSize(ID:number, expSize: string) {
    // skipping validation if color not found
    if (!(await this.colorCheck())) {
      console.log('skipping product size validation as color not found.'); 
      return;
    }

      // turn it into an array.
    const expectedSizes = expSize.split(',').map(s => normalizeSize(s));
    console.log("Expected Sizes:", expectedSizes);
   if(expectedSizes.includes('O/S')){
    expectedSizes[0] = "ONE SIZE"
   }
    // This returns an array of strings without looping manually.
    const sizeTexts = (await this.page.locator(HomePageLocator.sizes).allTextContents()).map(s=> normalizeSize(s));
    console.log("Sizes on Page: ", sizeTexts);

    // check size list length matches
    try {
      expect(sizeTexts.length).toBe(expectedSizes.length);      
    } catch {
      const message = "Sizes on UI " + sizeTexts + " not matched with expected sizes " + expectedSizes + " for this product.";
      console.log(message);
    }

    //Calculating missing sizes:Take each size on UI and check if sizes in excel contains it, otherwise add in sizeMissing array
    const sizeExtra:string[]=[];

    sizeTexts.forEach(size => {
      try {
        expect(expectedSizes).toContain(size);        
      }
      catch{
        sizeExtra.push(size)
      }
    });

    let message = "Extra sizes " + sizeExtra ; 
    if(sizeExtra.length>0){
      upsertAndAppendProductData(ID, 'size_notes', message);
    }
    

    //Calculating missing sizes:Take each size on Excel and check if sizes in UI contains it, otherwise add in sizeExtra array
    const sizeMissing:string[]=[];

    expectedSizes.forEach(size => {
      try {
        expect(sizeTexts).toContain(size);
      } catch {
        sizeMissing.push(size)
      }
    });
     let missingSizeMessage = `Missing Sizes(${sizeMissing})` ;
     if(sizeMissing.length>0){
upsertAndAppendProductData(ID, 'size_notes', missingSizeMessage);
     }

    // Get all size elements
    const sizeElements = await this.page.locator(HomePageLocator.sizes).allTextContents();
    console.log("Sizes on Page: ", sizeElements);
      const sizeUnavailableTexts = await this.page.locator(HomePageLocator.sizeNotAvailable).allTextContents();
    console.log("Unavailable Sizes on Page: ", sizeUnavailableTexts);
    if (section=='NEWNESS' && sizeUnavailableTexts.length>0) {
      let message = `Size OOS(${sizeUnavailableTexts})`;
      console.log(message);
      
      upsertAndAppendProductData(ID, 'size_notes', message);
    }else {
            try {
      if(await this.page.locator(HomePageLocator.activeSize).count()>0){
        
      // await newTab.locator(HomePageLocator.activeSize).first().click();
      //  await this.page.locator(HomePageLocator.sizes).first().click();
      // let message = `All sizes OOS.`;
      // console.log(message);
      
    }
    else {
      // await this.page.locator(HomePageLocator.sizes).first().click();
      let message = `All sizes OOS.`;
      console.log(message);
      
      upsertAndAppendProductData(ID, 'size_notes', message);
      console.log(message);
      // await updateResultinExcel(TESTDATA.Path, rowNumber, TESTDATA.sizeNotesColumn, message, false, false);
    }
    } catch (error) {
      console.log('Error in clicking size button',error);
    }
    }
}

// async verifyProductSizenew(ID: number, expSize: string) {
//   if (!(await this.colorCheck())) {
//     console.log('Skipping size validation — color not found.');
//     return;
//   }

//   // 1. Normalize expected sizes
//   let expectedSizes = expSize
//     .split(',')
//     .map(s => normalizeSize(s));

//   if (expectedSizes.includes('O/S')) {
//     expectedSizes = ['ONE SIZE'];
//   }

//   console.log('Expected Sizes:', expectedSizes);

//   // 2. Get UI sizes
//   const uiSizes = await this.getUISizes();
//   console.log('Sizes on UI:', uiSizes);

//   // 3. Length check
//   try {
//     expect(uiSizes.length).toBe(expectedSizes.length);
//   } catch {
//     console.log(
//       `Sizes mismatch. UI: ${uiSizes} | Expected: ${expectedSizes}`,
//     );
//   }

//   // 4. Compare extra & missing
//   const { extra, missing } = this.findExtraAndMissing(
//     uiSizes,
//     expectedSizes,
//   );

//   if (extra.length > 0) {
//     upsertAndAppendProductData(
//       ID,
//       'size_notes',
//       `Extra sizes ${extra}`,
//     );
//   }

//   if (missing.length > 0) {
//     upsertAndAppendProductData(
//       ID,
//       'size_notes',
//       `Missing Sizes(${missing})`,
//     );
//   }

//   // 5. Handle OOS scenarios
//   await this.handleOOSSizes(ID);
// }


async verifyMarkdProductPrice(ID: number, expRegPrice: string, expMarkPrice: string){
    // skipping validation if color not found
    if (!(await this.colorCheck())) return;
    // this.page.locator(HomePageLocator.activeSize).scrollIntoViewIfNeeded();

    console.log("Enter price component")
    let regularPriceRange
    if(section=='MARKDOWNS'){
       regularPriceRange = await this.page
      .locator(HomePageLocator.regularPrice)
      .textContent();
    }else {
      regularPriceRange = await this.page
      .locator(HomePageLocator.newnessRegularPrice).first()
      .textContent();
    }
   console.log('fIRST LOG OF REGULAR PRICE', regularPriceRange);
   
    let formattedRegularPriceRange = regularPriceRange
      ?.trim()//.TRIM() NOT IN THE CODE
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ');
    if (
      formattedRegularPriceRange &&
      formattedRegularPriceRange.includes('-')
    ) {
      const match = formattedRegularPriceRange.match(/\$?\d+.*?\-\s*\$?\d+/);
      if (match) {
        const finalPriceRange = match[0];
        let message;
      if(region==='CAN-FR'){
        message = `Regular Price Range ${finalPriceRange} for CAN-FR`;
      }else {
        message = `Regular Price Range ${finalPriceRange}`; 
      }
        console.log("Regular Price range", finalPriceRange)
        upsertAndAppendProductData(ID, 'price_notes', message);
      }
    }

    // await this.page.locator(HomePageLocator.activeSize).first().click();
   await this.page.locator(HomePageLocator.sizes).first().click();

  //   await expect(
  // this.page.locator(HomePageLocator.markdownPrice)).not.toContainText('-');
    // This returns an array of strings without looping manually.
        let markdownPrice = null;
      let regularPrice = null;
    if(section=='MARKDOWNS'){
      await this.page.waitForTimeout(2000)
      markdownPrice = await this.page.locator(HomePageLocator.markdownPrice).textContent();
      // markdownPrice = (await this.page.locator(HomePageLocator.markdownPrice).textContent())?.trim().split('-')[0].trim();
      console.log(`MD price before ${markdownPrice}`);
      
      regularPrice = await this.page.locator(HomePageLocator.regularPrice).textContent();
      if(region==='CAN-FR'){
        markdownPrice = `$${markdownPrice?.trim().replace(/\s+/g, ' ').split(' ')[1].split(',')[0]}`;
        regularPrice = `$${regularPrice?.trim().replace(/\s+/g, ' ').split(' ')[1].split(',')[0]}`;
      }else {
        markdownPrice = markdownPrice?.trim().replace(/\s+/g, ' ').split(' ')[0];
        regularPrice = regularPrice?.trim().replace(/\s+/g, ' ').split(' ')[0]; // the space there is a non-breaking space, not a regular space (" ").
      }
    }else {
          await this.page.waitForTimeout(2000)
          
          regularPrice = await this.page.locator(HomePageLocator.newnessRegularPrice).textContent();
          console.log('second log of regular price', regularPrice);
          
          if(region==='CAN-FR'){
            regularPrice = `$${regularPrice?.trim().replace(/\s+/g, ' ').split(' ')[1].split(',')[0]}`;
          }else {
            regularPrice = regularPrice?.trim().replace(/\s+/g, ' ').split(' ')[0]; // the space there is a non-breaking space, not a regular space (" ").
             console.log('third log of regular price', regularPrice);
             
          }
    }
 
    // 1. Check Markdown Price
     if(section=='MARKDOWNS'){
       console.log("Validating markdown price")
      try {
            console.log("-----------------------------------------------------",markdownPrice);
          expect(markdownPrice).toBe(expMarkPrice);
          let message = `Markdown Price matches (${markdownPrice}).`;
          upsertAndAppendProductData(ID, 'price_notes', "");
          
      } catch (err) {
        let message="";
      const placeholders = ['N/A', '-'];
        if (placeholders.some((val) => expMarkPrice.includes(val))) {
            if(region==='CAN-FR'){
              message = `Price avaialable on PDP: ${markdownPrice} for CAN-FR`;
            }else {
              message = `Price avaialable on PDP: ${markdownPrice}`; 
            }
        }else{
          if(region==='CAN-FR'){
              message = `MD Price mismatch(${markdownPrice})for CAN-FR`;
            }else {
              message = `MD Price mismatch(${markdownPrice})`; 
            }
        }
        upsertAndAppendProductData(ID, 'price_notes', message);
        setMdPriceCorrect(ID, false)
        console.log(message);
      }
     }


      // 2. Check Regular Price
      console.log("Validating regular price")
      try {
        expect(regularPrice).toBe(expRegPrice);
          let message = `Regular Price matches (${regularPrice}).`;
          upsertAndAppendProductData(ID, 'price_notes', "");
      } catch (err) {
        let message;
        if(region==='CAN-FR'){
              message = `Regular Price mismatch(${regularPrice}) for CAN-FR`;
            }else {
              message = `Regular Price mismatch(${regularPrice})`; 
            }
          upsertAndAppendProductData(ID, 'price_notes', message);
      }
  }

//   async verifyMarkdProductPricenew(
//   ID: number,
//   expRegPrice: string,
//   expMarkPrice: string
// ) {
//   if (!(await this.colorCheck())) return;

//   await this.captureRegularPriceRange(ID);

//   // Click size before price extraction (unchanged)
//   await this.page.locator(HomePageLocator.sizes).first().click();
//   await this.page.waitForTimeout(2000);

//   let rawRegular = null;
//   let rawMarkdown = null;

//   if (SECTION === 'MARKDOWNS') {
//     rawMarkdown = await this.page.locator(HomePageLocator.markdownPrice).textContent();
//     rawRegular = await this.page.locator(HomePageLocator.regularPrice).textContent();
//   } else {
//     rawRegular = await this.page.locator(HomePageLocator.newnessRegularPrice).textContent();
//   }

//   const regularPrice = this.normalizePrice(rawRegular);
//   const markdownPrice =
//     SECTION === 'MARKDOWNS'
//       ? this.normalizePrice(rawMarkdown)
//       : null;

//   if (SECTION === 'MARKDOWNS') {
//     this.comparePrice(ID, markdownPrice, expMarkPrice, 'MD');
//   }

//   this.comparePrice(ID, regularPrice, expRegPrice, 'REG');
// }

 

  async verifyProductAccordions(rowNumber: number) {
    // skipping validation if color not found
    if (!(await this.colorCheck())) return;
    // - use toHaveAttribute('aria-expanded') → checks functional state (accessibility, logic)
    // - use toHaveCSS('height', '0px') → checks visual state (UI actually collapsed/expanded)
    // WHY WE MADE THIS
    try {
      await expect(
        this.page.locator(HomePageLocator.whyWeMadeThisExpander),
      ).toHaveCSS('height', '0px');
      await this.page.locator(HomePageLocator.whyWeMadeThis).click();
      await expect(
        this.page.locator(HomePageLocator.whyWeMadeThisSummary),
      ).toHaveAttribute('aria-expanded', 'true');
      await expect(
        this.page.locator(HomePageLocator.whyWeMadeThisExpander),
      ).not.toHaveCSS('height', '0px');

      // PRODUCT DETAIL
      await expect(
        this.page.locator(HomePageLocator.ProductDetailExpander).first(),
      ).toHaveCSS('height', '0px');
      await this.page.locator(HomePageLocator.ProductDetail).click();
      await expect(
        this.page.locator(HomePageLocator.ProductDetailSummary).first(),
      ).toHaveAttribute('aria-expanded', 'true');
      await expect(
        this.page.locator(HomePageLocator.ProductDetailExpander).first(),
      ).not.toHaveCSS('height', '0px');

      // ITEM REVIEW
      await expect(
        this.page.locator(HomePageLocator.itemReviewExpander),
      ).toHaveCSS('height', '0px');
      await this.page.locator(HomePageLocator.itemReview).click();
      await expect(this.page.locator(HomePageLocator.itemReviewSummary)).toHaveAttribute('aria-expanded', 'true');
      await expect(this.page.locator(HomePageLocator.itemReviewExpander)).not.toHaveCSS('height', '0px');
    }catch (error){
        const message = "There is a issue with Accordions - "+error;
        console.log(message);
        // updateResultinExcel(TESTDATA.Path, rowNumber, TESTDATA.commentColumn, message);
    }
  }

  async verifyProductImages(ID: number, imageText:string) {
    // skipping validation if color not found
    if (!(await this.colorCheck())) return;

    const brokenImages: string[] = [];

    // Include all images, not just those with loading="lazy"
    // const images = await this.page.locator('img').all();
    const carouselmage = await this.page
      .locator(
        "//div[starts-with(@class,'carousel_thumbnailsContainer')]//button/picture//img",
      ).all();
      
    // const thumbImage = await this.page
    //   .getByRole('img', { name: 'Slide' })
    //   .all();
      
    // const whyWeMadeThisImage = await this.page
    //   .locator("//div[@data-testid='why-we-made-this']//picture/img")
    //   .all();
      
    // const images = [...carouselmage, ...thumbImage, ...whyWeMadeThisImage];
    if (carouselmage.length==0) {
      if(section=='NEWNESS'){
        if(imageText!='Images Delivered'){
               console.log('Pending images for',ID);
        upsertAndAppendProductData(ID, 'photo_notes', "Pending Images");
      }else {
         console.log('Missing Images for',ID);
        upsertAndAppendProductData(ID, 'photo_notes', "Missing Images");
      }
      }else {
        console.log('Missing Images for',ID);
        upsertAndAppendProductData(ID, 'photo_notes', "Missing Images");
      }
    }else {
      console.log('we have images for', ID);
      
    }
    
    // console.log(`Total images found: ${images.length}`);

    // for (const img of images) {
    //   const src =
    //     (await img.getAttribute('src')) || (await img.getAttribute('data-src'));
        
    //   const srcset =
    //     (await img.getAttribute('srcset')) ||
    //     (await img.getAttribute('data-srcset'));
    
    //   const urlsToCheck: string[] = [];

    //   // Check normal src
    //   if (src && !src.startsWith('data:')) {
    //     try {
    //       urlsToCheck.push(new URL(src, this.page.url()).toString());
    //     } catch {
    //       console.log(`Invalid src URL skipped: ${src}`);
    //     }
    //   }

    //   // Check srcset URLs
    //   if (srcset) {
    //     const srcsetUrls = srcset
    //       .split(',')
    //       .map((entry) => entry.trim().split(' ')[0])
    //       .filter((url) => url && !url.startsWith('data:'))
    //       .slice(0, 1); // only check the first srcset URL

    //     for (const url of srcsetUrls) {
    //       try {
    //         urlsToCheck.push(new URL(url, this.page.url()).toString());
    //       } catch {
    //         console.log(`Invalid srcset URL skipped: ${url}`);
    //       }
    //     }
    //   }

    //   // Validate all resolved URLs
    //   for (const url of urlsToCheck) {
    //     try {
    //       const response = await this.page.request.get(url);
    //       if (!response.ok()) {
    //         console.log(`Broken image: ${url} → Status: ${response.status()}`);
    //         brokenImages.push(url);
    //       }
    //     } catch (error) {
    //       console.log(`Error checking image: ${url} → ${error}`);
    //       brokenImages.push(url);
    //     }
    //   }
    // }

    // if (brokenImages.length > 0) {
    //   const message = brokenImages.join('\n'); // each on new line
    //   console.log(`Broken images found:\n${message}`);
    //   // await updateResultinExcel(TESTDATA.Path, rowNumber, TESTDATA.photoNotesColumn, message);
    // } else {
    //   console.log('No broken images');
    // }
  }

async searchProductById(ID: number, MarkdownPID: string, productName: string) {
  // await this.crawlToProduct("");
  // const homePagePopUp = this.page.locator(
  //     HomePageLocator.markdownHomePagePopUp,
  //   );
  //   let link;
  //   if(region === 'USA'){
  //     link = "https://preview.lululemon.com";
  //   }else if(region === 'CAN-EN') {
  //     link = "https://preview.lululemon.com/en-ca/"; 
  //   }else {
  //     link = "https://preview.lululemon.com/fr-ca/";
  //   }
    // +href->/c/we-made-too-much/n18mhd
      // console.log('Navigating to:', link);//https://preview.lululemon.com/c/we-made-too-much/n18mhd"
      await this.page.goto(this.getBaseUrl());
      await this.closeModalIfPresent();

  // await this.page.goto("https://preview.lululemon.com");
  //     await closeWelcomeModal(this.page);
 
  console.log(`Searching product by PID: ${MarkdownPID}`);
 
  try {
    const searchBox = this.page.locator("//input[@data-testid='nav-desktop-search']");
   
    // Ensure search box is ready
    await searchBox.waitFor({ state: 'visible' });
    await searchBox.click();
   
    // Fill PID and press Enter (more reliable than clicking the icon)
    await searchBox.fill(MarkdownPID);
    await searchBox.press('Enter');
 
    // Wait for the search results to appear
    const productTileSelector = `//div[contains(@class,'product-tile')]//a[@data-productid='${MarkdownPID}']`;
   
    try {
      await this.page.waitForSelector(productTileSelector, { timeout: 10000 });
    } catch (e) {
      console.log(`Timeout: Product tile for ${MarkdownPID} did not appear.`);
    }
 
    const productTiles = this.page.locator(productTileSelector);
    const totalProducts = await productTiles.count();
 
    if (totalProducts > 0) {
      await productTiles.first().click();
      console.log(`Successfully clicked product: ${productName}`);
      let message;
      if(region==='CAN-FR'){
          message = `Not showing on CDP for CAN-FR`;
       }else {
         message = "Not showing on CDP"; 
      }
      upsertAndAppendProductData(ID, 'catalog_ops_notes', message);
      return true;
    } else {
      console.log(`Product ${MarkdownPID} not found in search results.`);
      let message;
      if(region==='CAN-FR'){
          message = `Not showing on web for CAN-FR`;
       }else {
         message = "Not showing on web"; 
      }
      upsertAndAppendProductData(ID, 'catalog_ops_notes', message);
      setMdPriceCorrect(ID, false);
      return false;
    }
  } catch (error) {
    console.error(`Error during search process:`, error);
    return false;
  }
}
 async verifyAccordions(): Promise<void> {
   if (!(await this.colorCheck())) return;
   console.log('verifyAccordions: colorCheck passed');
    try {
      const summaries = this.page.locator(HomePageLocator.productPageAccordions);
      const total = await summaries.count();
      console.log(`verifyAccordions: found ${total} accordions`);
      if (total === 0) {
        console.log('verifyAccordions: no accordions found – exiting');
        return};
      const count = Math.min(total, 3);
      console.log(`verifyAccordions: will test ${count} accordion(s)`);
      for (let i = 0; i < count; i++) {
        console.log(`verifyAccordions: testing accordion ${i + 1}`);
        try {
          const s = summaries.nth(i);
          console.log(`Accordion ${i + 1}: scrolling into view`);
          await s.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await this.page.waitForTimeout(200);
          console.log(`Accordion ${i + 1}: first click (expand)`);
          await s.click({ force: true }).catch(() => s.evaluate((el) => (el as HTMLElement).click()));
         await this.page.waitForTimeout(200);
         console.log(`Accordion ${i + 1}: second click (collapse)`);
          await s.click({ force: true }).catch(() => s.evaluate((el) => (el as HTMLElement).click()));
          await this.page.waitForTimeout(200);
          console.log(`Accordion ${i + 1}: success`);
        } catch (e) {
          console.warn(`verifyAccordions: accordion ${i + 1} failed –`, (e as Error).message);
        }
      }
      console.log('verifyAccordions: completed successfully');
    } catch (e) {
      console.warn('verifyAccordions skipped or failed –', (e as Error).message);
    }
  }
 async verifyAccordionBrokenLinks(): Promise<void> {
    if (!(await this.colorCheck())) return;
    const summaries = this.page.locator(HomePageLocator.productPageAccordions);
    const count = Math.min(await summaries.count(), 3);
    for (let i = 0; i < count; i++) {
      await summaries.nth(i).scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(400);
    }
    const baseUrl = this.page.url();
    const baseOrigin = new URL(baseUrl).origin;
    const links = await this.page.locator("details[data-testid^='accordion-item-'] a[href^='http'], details[data-testid^='accordion-item-'] a[href^='/']").all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
      const url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
      try {
        if (new URL(url).origin !== baseOrigin) continue;
        const res = await this.page.request.get(url, { timeout: 8000 });
        if (!res.ok()) console.warn(`Broken link in accordion: ${url} returned ${res.status()}`);
      } catch {
  //Skip
      }
    }
    for (let i = 0; i < count; i++) {
      await summaries.nth(i).click({ force: true });
      await this.page.waitForTimeout(300);
    }
  }

// async searchProductByName(ID: number, MarkdownPID: string, productName: string) {
//   // await this.crawlToProduct("");
//   const homePagePopUp = this.page.locator(
//       HomePageLocator.markdownHomePagePopUp,
//     );
//     let link;
//     if(region === 'USA'){
//       link = "https://preview.lululemon.com";
//     }else if(region === 'CAN-EN') {
//       link = "https://preview.lululemon.com/en-ca/"; 
//     }else {
//       link = "https://preview.lululemon.com/fr-ca/";
//     }
//     // +href->/c/we-made-too-much/n18mhd
//       console.log('Navigating to:', link);//https://preview.lululemon.com/c/we-made-too-much/n18mhd"
//       await this.page.goto(link);
//       try {
//       // Wait up to 5 seconds for popup to be visible
//       await homePagePopUp.waitFor({ state: 'visible', timeout: 30000 });
//       // If visible, click close button
//       await this.page.locator(HomePageLocator.modalCloseButton).click();
//     } catch {
//       console.log('Popup not visible. continuing...');
//     }
//   // await this.page.goto("https://preview.lululemon.com");
//   //     await closeWelcomeModal(this.page);
 
//   console.log(`Searching product by Product Name: ${productName}`);
 
//   try {
//     const searchBox = this.page.locator("//input[@data-testid='nav-desktop-search']");
   
//     // Ensure search box is ready
//     await searchBox.waitFor({ state: 'visible' });
//     await searchBox.click();
   
//     // Fill PID and press Enter (more reliable than clicking the icon)
//     await searchBox.fill(MarkdownPID);
//     await searchBox.press('Enter');
 
//     // Wait for the search results to appear
//     const productTileSelector = `//div[contains(@class,'product-tile')]//a[@data-productid='${MarkdownPID}']`;
   
//     try {
//       await this.page.waitForSelector(productTileSelector, { timeout: 10000 });
//     } catch (e) {
//       console.log(`Timeout: Product tile for ${productName} did not appear.`);
//     }
 
//     const productTiles = this.page.locator(productTileSelector);
//     const totalProducts = await productTiles.count();
 
//     if (totalProducts > 0) {
//       await productTiles.first().click();
//       console.log(`Successfully clicked product: ${productName}`);
//       let message;
//       if(region==='CAN-FR'){
//           message = `Not showing on CDP for CAN-FR`;
//        }else {
//          message = "Not showing on CDP"; 
//       }
//       upsertAndAppendProductData(ID, 'catalog_ops_notes', message);
//       return true;
//     } else {
//       console.log(`Product ${MarkdownPID} not found in search results.`);
//       let message;
//       if(region==='CAN-FR'){
//           message = `Not showing on web for CAN-FR`;
//        }else {
//          message = "Not showing on web"; 
//       }
//       upsertAndAppendProductData(ID, 'catalog_ops_notes', message);
//       setMdPriceCorrect(ID, false);
//       return false;
//     }
//   } catch (error) {
//     console.error(`Error during search process:`, error);
//     return false;
//   }
// }
}

