import path from "path";
import { fileURLToPath } from 'url';

// --- Fix for __dirname ---
const __filename = fileURLToPath(import.meta.url);
console.log("filename is",__filename);

const __dirname = path.dirname(__filename);
console.log("Dirname is", __dirname);

// globals.ts
export const TESTDATA = {
  Path: path.resolve(__dirname, 'testData', 'db_dummy.xlsx'),
  commentColumn: 'M',
  photoNotesColumn:'W',
  priceNotesColumn: 'Y',
  sizeNotesColumn: 'X',
  catalogOpsColumn: 'Z',
};
