import Dexie, { Table } from 'dexie';
import { Novel, Chapter, Term } from '../types';

export class WebNovelDB extends Dexie {
  novels!: Table<Novel, number>;
  chapters!: Table<Chapter, number>;
  glossary!: Table<Term, number>;

  constructor() {
    super('WebNovelDB');
    // Cast this to any to resolve TS error: Property 'version' does not exist on type 'WebNovelDB'.
    (this as any).version(1).stores({
      novels: '++id, title, createdAt',
      chapters: '++id, novelId, order, title', // compound index could be [novelId+order]
      glossary: '++id, novelId, original, category'
    });
  }
}

export const db = new WebNovelDB();

// Helper to bulk add chapters efficiently
export const bulkAddChapters = async (novelId: number, files: FileList) => {
  const chapters: Omit<Chapter, 'id'>[] = [];
  
  // Sort files by name loosely to try and get order (optimistic)
  const sortedFiles = Array.from(files).sort((a, b) => 
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    const text = await file.text();
    chapters.push({
      novelId,
      title: file.name.replace(/\.[^/.]+$/, ""), // remove extension
      order: i + 1,
      content: text,
    });
  }
  
  await db.chapters.bulkAdd(chapters);
};