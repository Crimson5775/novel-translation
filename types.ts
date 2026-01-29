export enum TermCategory {
  PERSON = 'Person',
  LOCATION = 'Location',
  SKILL = 'Martial Art/Skill',
  ITEM = 'Item',
  ORGANIZATION = 'Organization',
  OTHER = 'Other'
}

export interface Term {
  id?: number;
  novelId: number;
  original: string;
  translation: string;
  category: TermCategory;
  isLocked: boolean; // If true, AI scan won't overwrite it
}

export interface Chapter {
  id?: number;
  novelId: number;
  title: string;
  order: number;
  content: string;
  translatedContent?: string;
  lastTranslated?: Date;
}

export interface Novel {
  id?: number;
  title: string;
  author?: string;
  coverUrl?: string;
  description?: string;
  createdAt: Date;
}

export interface ViewState {
  view: 'library' | 'novel' | 'glossary' | 'reader';
  novelId?: number;
  chapterId?: number;
}

export interface ReaderSettings {
  fontSize: number; // px
  lineHeight: number; // relative
  fontFamily: 'sans' | 'serif' | 'mono';
  showOriginal: boolean; // Split view
  theme: 'light' | 'dark';
}
