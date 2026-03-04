declare module 'xlsx' {
  export interface WorkSheet {
    '!cols'?: Array<{ wch?: number }>;
    [key: string]: unknown;
  }

  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [key: string]: WorkSheet };
  }

  export const utils: {
    json_to_sheet<T>(data: T[]): WorkSheet;
    sheet_to_json<T>(sheet: WorkSheet): T[];
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void;
  };

  export function read(data: ArrayBuffer): WorkBook;
  export function writeFile(wb: WorkBook, filename: string): void;
}
