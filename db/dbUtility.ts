import Database from 'better-sqlite3';
import { readExcelSheet } from "../support/excelUtil"; 
import { TESTDATA } from "../globals" 

interface MarkdownValidationItem {
  id: number,
  sno: number,
  size_notes: string,
  price_notes: string,
  catalog_ops_notes: string,
  photo_notes:string, 
  wwmt_notes: string,
  others_notes: string,
  md_price_correct: number
}

// Export the interface so the test file can use it
export type { MarkdownValidationItem};

// create db with just comment columns, and sno for excel mapping
export function createDB(){
    const db = new Database('products.db');
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sno INTEGER UNIQUE,
                'size_notes' TEXT,
                'price_notes' TEXT,
                'catalog_ops_notes' TEXT, 
                'photo_notes' TEXT, 
                'wwmt_notes' TEXT,
                'others_notes' TEXT,
                'md_price_correct' INTEGER DEFAULT 1
            )
        `;
        db.exec(query);

    } catch (error) {
        console.error("Error loading data from Excel/DB:", error);
    } finally {
        // Ensure the connection is always closed
        db.close();
    }
}

export function setMdPriceCorrect(sno: number, isCorrect: boolean) {
    console.log("setting to 0");
    
  const db = new Database('products.db');
  try {
    const query = `
      UPDATE products
      SET md_price_correct = ?
      WHERE sno = ?
    `;
    db.prepare(query).run(isCorrect ? 1 : 0, sno);
  } finally {
    db.close();
  }
}


export function upsertAndAppendProductData(
  productId: number,
  columnName: string,
  newValue: string
) {
  const allowedColumns = ['size_notes', 'catalog_ops_notes', 'price_notes','photo_notes','wwmt_notes', 'others_notes'];
  if (!allowedColumns.includes(columnName)) {
    throw new Error(`Invalid column name: ${columnName}`);
  }

  const db = new Database('products.db');  
  const valueWithSpace = ' ' + newValue;
  try{
  const query = `
    INSERT INTO products (sno, ${columnName})
    VALUES (?, ?)
    ON CONFLICT(sno)
    DO UPDATE SET
      ${columnName} = COALESCE(products.${columnName}, '') || excluded.${columnName};
  `;

  const updateStmt = db.prepare(query);
  console.log("Inside upsert", productId, valueWithSpace);
  updateStmt.run(productId, valueWithSpace);
}catch (error) {
        console.error("Error executing updateDB:", error);
        throw error;
    } finally {
        db.close();
    }
}
 
export function readAllMarkdownDataFromDB(): MarkdownValidationItem[] {
    const db = new Database('products.db', { readonly: true });
    try {
        const selectQuery = `
            SELECT 
                id, sno, size_notes, price_notes, catalog_ops_notes,photo_notes, wwmt_notes, others_notes,md_price_correct FROM products
        `;
        return db.prepare(selectQuery).all() as MarkdownValidationItem[];

    } catch (error) {
        console.error("Error reading data from DB:", error);
        // You might want to re-throw the error or return an empty array depending on your test's needs
        return []; 
    } finally {
        db.close();
    }
}