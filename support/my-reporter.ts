/**
 * Custom Playwright Reporter
 *
 * Purpose:
 * This file defines a custom reporter for Playwright test execution. 
 * It is used to hook into various lifecycle events like test start, test end,
 * and the entire test suite lifecycle.
 *
 * Usage:
 * - Add this reporter to your Playwright configuration (`playwright.config.ts`)
 *   using the `reporter` property.
 *
 * Benefits:
 * - Useful for custom logging
 * - Debugging or auditing test executions
 */


import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import {  MarkdownValidationItem , readAllMarkdownDataFromDB} from '../db/dbUtility'
import {updateExcelFromDB} from './excelUtil';

const SECTION = process.env.SECTION as 'MARKDOWNS' | 'NEWNESS';

class MyReporter implements Reporter {
  // private startTime: number = 0;
  onBegin() {
    // this.startTime = Date.now();
    console.log('Test run started');
  }

  onTestBegin(test: TestCase) {
    console.log(`Starting test: ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    console.log(`Finished test: ${test.title} - Status: ${result.status}`);
  }

 async onEnd() {
    // 1. Check the worker index environment variable
    //    The primary worker (ID 0) is responsible for running final I/O.
     const workerIndex = process.env.PLAYWRIGHT_WORKER_INDEX;
    // In Playwright, the main process often has an index of '0' or is undefined/missing.
     const isMainWorker = workerIndex === '0' || workerIndex === undefined; 

    if (isMainWorker) {
      console.log('✅ Executing final Excel update logic (Main Worker only).');
      
      console.log('All parallel tests finished, starting serial Excel update...');
      
      try {
        // Read the final, updated data from the centralized DB
        let updatedArray = readAllMarkdownDataFromDB();
        console.log(updatedArray);

        // 2. Iterate and write to Excel SERIALLY
// let rowNo =  product.sno + 2;
          const totalRows = 4; // or calculate based on Excel sheet length
const REGION = process.env.CRAWL_REGION as 'USA' | 'CAN-EN' | 'CAN-FR';
if (!REGION) throw new Error("CRAWL_REGION env variable not set");
let sheetName= undefined;

if(SECTION=='MARKDOWNS'){
  sheetName = REGION === 'USA' ? "USA Markdowns" : "CAN Markdowns";
}else {
  sheetName = REGION === 'USA' ? "USA Newness" : "CAN Newness";
}


          await updateExcelFromDB(updatedArray, totalRows, sheetName);

        console.log('Successfully completed all Excel updates.');
      } catch (error) {
        console.error('*** FATAL ERROR during ONCE-OFF Excel Write ***');
        console.error('The final Excel file may be corrupted or not written.', error);
      }
    } else {
      // This log confirms that the other parallel workers are gracefully skipping the I/O.
      console.log(`Worker ID ${workerIndex} finished. Skipping final Excel update.`);
    }
    
    // console.log('All tests finished, updating excel');
    // let updatedArray = readAllMarkdownDataFromDB();
    // // console.log(updatedArray);
    
    // for(let product of updatedArray){
    //   console.log('Updating Excel');
      
    //   updateResultinExcel(product.id+2, product);
    // }

    // const endTime = Date.now();
    // const durationInSeconds = ((endTime - this.startTime) / 1000).toFixed(2);
    // // --- End of Update Logic ---
    
    // console.log(`📊 Excel/DB Update loop duration: ${durationInSeconds} seconds`);
    // console.log('Update logic finished.');
  }
}

export default MyReporter;   // This tells Playwright: "Here is the default class to use as the reporter."