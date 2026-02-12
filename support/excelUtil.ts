import XLSX from "xlsx";
import ExcelJS from "exceljs";
import {TESTDATA} from '../globals'
import {MarkdownValidationItem}  from '../db/dbUtility'
import { loadHeaderMap } from '../utils/headerMap';
import type { HeaderRegion } from '../global-setup';

const REGION = process.env.CRAWL_REGION as 'USA' | 'CAN-EN' | 'CAN-FR';
const HEADER_REGION: HeaderRegion = REGION === 'USA' ? 'USA' : 'CAN';
const SECTION = process.env.SECTION as 'MARKDOWNS' | 'NEWNESS';

// const headerIndexMap = loadHeaderMap(SECTION,HEADER_REGION);

const safeTrim = (value: string | number | null | undefined) => value?.toString().trim() || "";

export const readExcelCell = (
  filePath: string,
  columnName: string,
  rowNumber: number,
  sheetName?: string
): any => {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
 
  const data: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  // console.log(data);
  
  const headers = data[1]; // second row
// console.log(headers);

  const rows = data.slice(2); // from third row onward
//  console.log(columnName);
 
  const colIndex = headers.indexOf(columnName);
  return colIndex !== -1 ? rows[rowNumber - 1]?.[colIndex] : undefined;
};
 

export function readExcelSheet(filePath: string, sheetName?: string): any[][] {
  const workbook = XLSX.readFile(filePath);
  // console.log(workbook);
  
  const targetSheet = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheet];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  return data.filter((row) => row.length > 0);
}

export function sheetExists(filePath: string, sheetName: string): boolean {
  const workbook = XLSX.readFile(filePath);
  return workbook.SheetNames.includes(sheetName);
}

export async function clearAllColorsAndColumnData(
  filePath: string,
  headerRowsToKeep = 2,
  clearColumns: string[] = ['M', 'N', 'O', 'P', 'Q'], // Columns to clear text and comments
  colorColumns: string[] = ['E'], // Columns to remove color (only E)
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Map columns to numbers
  const clearColumnNumbers = clearColumns.map((col) =>
    columnLetterToNumber(col),
  );
  const colorColumnNumbers = colorColumns.map((col) =>
    columnLetterToNumber(col),
  );

  workbook.worksheets.forEach((worksheet) => {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowsToKeep) return; // Skip header rows

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Clear fill color for specified color columns (E)
        if (colorColumnNumbers.includes(colNumber)) {
          (cell as any).fill = undefined;
        }

        // Clear data and comments for specified columns (M-Q)
        if (clearColumnNumbers.includes(colNumber)) {
          cell.value = undefined; // Clear data

          // Remove comments if present
          if (typeof (cell as any).note !== 'undefined') {
            (cell as any).note = undefined;
          }
        }
      });

      row.commit();
    });
  });

  await workbook.xlsx.writeFile(filePath);

  console.log(
    `Cleared all colors (except first ${headerRowsToKeep} header rows), and cleared all data from columns ${clearColumns.join(
      ', ',
    )}, except headers.`,
  );
}

// function appendCellValue(
//   cell: ExcelJS.Cell,
//   newValue?: string | null,
//   separator = '\n'
// ) {
//   if (!newValue) return;

//   const existingValue = cell.value
//     ? cell.value.toString().trim()
//     : '';

//   const incomingValue = newValue.toString().trim();

//   if (!incomingValue) return;

//   // Avoid duplicate appends
//   if (incomingValue.includes(existingValue)) {
//     return;
//   }

//   cell.value = existingValue
//     ? `${existingValue}${separator}${incomingValue}`
//     : incomingValue;
// }

function appendCellValue(
  cell: ExcelJS.Cell,
  newValue?: string | null,
  separator = '\n'
) {
  if (!newValue) return;

  const existingValue = cell.value
    ? cell.value.toString().trim()
    : '';

  const incomingValue = newValue.toString().trim();
  if (!incomingValue) return;

  // Split existing cell into individual messages
  const existingMessages = existingValue
    ? existingValue.split(/\n+/).map(v => v.trim())
    : [];

  // Normalize incoming message (remove region)
  const normalizedIncoming = incomingValue.replace(/\s*for CAN-FR$/i, '').trim();

  // 🔒 Rule 1: If same message (non-regional) already exists, suppress CAN-FR
  if (
    incomingValue.includes('for CAN-FR') &&
    existingMessages.some(
      msg => msg.replace(/\s*for CAN-FR$/i, '').trim() === normalizedIncoming
    )
  ) {
    return;
  }

  // 🔒 Rule 2: Prevent exact duplicates
  if (existingMessages.includes(incomingValue)) {
    return;
  }

  cell.value = existingValue
    ? `${existingValue}${separator}${incomingValue}`
    : incomingValue;
}

// const colIndex = (
//   headerName: string,
//   pick: 'first' | 'last' = 'first'
// ): number => {
//   console.log('inside this');
  
//   const key = headerName.trim().toLowerCase();
//   const indices = headerIndexMap[key];
//   console.log(key,indices);
  

//   if (!indices || indices.length === 0) {
//     return -1; 
//   }
// console.log('after THE if');

//   const zeroBased =
//     pick === 'last'
//       ? indices[indices.length - 1]
//       : indices[0];

//   // ExcelJS uses 1-based column numbers
//   return zeroBased + 1;
// };


// const colIndex = (name: string, occurrence = 0) => {
//   const key = name.trim().toLowerCase();
//   const indices = headerIndexMap[key];

//   if (!indices || indices.length === 0) {
//     throw new Error(`Header not found: ${name}`);
//   }

//   if (occurrence >= indices.length) {
//     throw new Error(
//       `Header "${name}" has ${indices.length} occurrence(s), requested ${occurrence}`
//     );
//   }

//   // ExcelJS columns are 1-based
//   return indices[occurrence] + 1;
// };



export async function updateExcelFromDB(dbRows: MarkdownValidationItem[], totalRows: number, sheetName?: "USA Markdowns" | "CAN Markdowns" | "USA Newness" | "CAN Newness") {
  const filePath = TESTDATA.Path;
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(filePath);
    console.log('✅ Excel file loaded for update.');
  } catch (error) {
    console.error('Error reading Excel file:', error);
    return;
  }

    let worksheet;
  if (sheetName && workbook.getWorksheet(sheetName)) {
    worksheet = workbook.getWorksheet(sheetName);
  } else {
    worksheet = workbook.worksheets[0]; // fallback
  }

  const headerIndexMap = loadHeaderMap(
    sheetName?.includes('Newness') ? 'NEWNESS' : 'MARKDOWNS',
    HEADER_REGION
);

const colIndex = (name: string, occurrence = 0) => {
  console.log("This is the colIndex at work",name, occurrence);
  
  const key = name.trim().toLowerCase();
  const indices = headerIndexMap[key];

  if (!indices || indices.length === 0) {
    throw new Error(`Header not found: ${key}`);
  }

  if (occurrence >= indices.length) {
    throw new Error(
      `Header "${name}" has ${indices.length} occurrence(s), requested ${occurrence}`
    );
  }

  // ExcelJS columns are 1-based
  return indices[occurrence] + 1;
};

  // Loop through all rows in Excel (after headers)
  for (let rowNumber = 3; rowNumber <= worksheet.actualRowCount; rowNumber++) { 
    const dbRow = dbRows.find(r => r.sno + 2 === rowNumber); // match Excel row
dbRow
    // --- Update comment columns if row exists in DB ---
    if (dbRow) {
      // const fields = [
      //   { value: dbRow.price_notes, column: TESTDATA.priceNotesColumn },
      //   { value: dbRow.size_notes, column: TESTDATA.sizeNotesColumn },
      //   { value: dbRow.catalog_ops_notes, column: TESTDATA.catalogOpsColumn},
      //   { value: dbRow.photo_notes, column: TESTDATA.photoNotesColumn},
      // ];

      const fields = [
  { value: dbRow.price_notes, header: 'Price Notes' },
  { value: dbRow.size_notes, header: 'Size Notes' },
  { value: dbRow.catalog_ops_notes, header: 'Catalogue Ops' },
  { value: dbRow.photo_notes, header: 'Photo studio' },
  { value: dbRow.wwmt_notes, header: 'WWMT Content' },
  { value: dbRow.others_notes, header: 'Other' },
];

     
      console.log('before the log');
      
//       console.log( worksheet.getCell(
//   rowNumber,
//   colIndex('MD Price')
// ));
// console.log( 
//  colIndex('Price Notes')
// );
      console.log('after the log');

      // for (const field of fields) {
      //   if (field.column) {
      //     // const cell = worksheet.getCell(`${field.column}${rowNumber}`);
      //     // cell.value = field.value || null;

      //     const cell = worksheet.getCell(`${field.column}${rowNumber}`);
      //     appendCellValue(cell, field.value);

      //   }
      // }

      for (const field of fields) {
        if (field.header) {
          const cell = SECTION=='MARKDOWNS'?worksheet.getCell(
            rowNumber,
            colIndex(field.header) // or colIndex(field.header, 1)
          ):worksheet.getCell(
            rowNumber,
            colIndex(field.header,1) // or colIndex(field.header, 1)
          );

          appendCellValue(cell, field.value);
        }
      }
    }

    // --- Color price cell green if row not in DB OR md_price_correct === 1 ---
    console.log(dbRow?.md_price_correct);
    
    if(!(REGION === 'CAN-FR')){
      if (!dbRow || dbRow.md_price_correct === 1) {
      console.log('checking the coloring logic');
      
      const priceCell = worksheet.getCell(
        rowNumber,
        colIndex('MD Price') // or ('MD Price', 1) if duplicated
      );

    


      // const priceCell = worksheet.getCell(`L${rowNumber}`);
      if (!priceCell) continue; 
      
      priceCell.style = {};
      priceCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF228B22' },
      };
    }
    //  const ecomCell = worksheet.getCell(`I${rowNumber}`);
      const ecomCell = worksheet.getCell(
        rowNumber,
        colIndex('Ecomm Name')
      );
     ecomCell.style={};
     ecomCell.font = { bold: true };
    }
  }

  try {
    await workbook.xlsx.writeFile(filePath);
    console.log('✅ Excel update complete.');
  } catch (error) {
    console.error('Error writing Excel file:', error);
  }
}



/**
 * Utility: convert column letter (e.g. "E") -> index (5)
 */
function columnLetterToNumber(letter: string): number {
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    const charCode = letter.charCodeAt(i);
    if (charCode < 65 || charCode > 90) {
      // 'A' to 'Z'
      throw new Error('Invalid column letter');
    }
    num = num * 26 + (charCode - 64);
  }
  return Math.min(num, 16384); // cap at Excel max column
}
