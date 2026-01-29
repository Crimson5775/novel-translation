import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { translateChapterWithGlossary } from '../services/geminiService';
import { 
  ArrowLeft, Wand2, ChevronLeft, ChevronRight, Save, 
  Settings, Type, Moon, Sun, Columns, FileText, PlusCircle 
} from 'lucide-react';
import { ReaderSettings, Term, TermCategory } from '../types';

interface Props {
  chapterId: number;
  onBack: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  settings: ReaderSettings;
  onUpdateSettings: (s: Partial<ReaderSettings>) => void;
}

export const Reader: React.FC<Props> = ({ chapterId, onBack, onNavigate, settings, onUpdateSettings }) => {
  const chapter = useLiveQuery(() => db.chapters.get(chapterId), [chapterId]);
  const [translation, setTranslation] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [editedTranslation, setEditedTranslation] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Selection / Popover State
  const [selection, setSelection] = useState<{ text: string, x: number, y: number } | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  // Sticky Header Logic
  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowNav(false); // Scrolling down
      } else {
        setShowNav(true); // Scrolling up
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onNavigate('next');
      if (e.key === 'ArrowLeft') onNavigate('prev');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  useEffect(() => {
    if (chapter) {
      setTranslation(chapter.translatedContent || '');
      setEditedTranslation(chapter.translatedContent || '');
      window.scrollTo(0, 0);
    }
  }, [chapter]);

  // Handle Text Selection for "Live Edit"
  const handleSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Only show if selection is within our reader container
    if (readerRef.current && readerRef.current.contains(range.commonAncestorContainer)) {
      setSelection({
        text: sel.toString().trim(),
        x: rect.left + window.scrollX + (rect.width / 2),
        y: rect.top + window.scrollY
      });
    }
  };

  const addToGlossary = async () => {
    if (!selection || !chapter) return;
    const arabicTrans = prompt(`Enter Arabic translation for "${selection.text}":`);
    if (arabicTrans) {
      await db.glossary.add({
        novelId: chapter.novelId,
        original: selection.text,
        translation: arabicTrans,
        category: TermCategory.OTHER,
        isLocked: true
      });
      alert(`Added "${selection.text}" -> "${arabicTrans}" to glossary. This will apply to future translations.`);
      setSelection(null);
      // Clear selection
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleTranslate = async () => {
    if (!chapter) return;
    setIsTranslating(true);
    try {
      const glossary = await db.glossary.where({ novelId: chapter.novelId }).toArray();
      const result = await translateChapterWithGlossary(chapter.content, glossary);
      setTranslation(result);
      setEditedTranslation(result);
      await db.chapters.update(chapter.id!, { 
        translatedContent: result,
        lastTranslated: new Date()
      });
    } catch (e) {
      alert('Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const saveManualEdits = async () => {
    if (chapter) {
      await db.chapters.update(chapter.id!, { translatedContent: editedTranslation });
      // Visual feedback could be added here
    }
  };

  if (!chapter) return <div className="p-10 text-center dark:text-slate-400">Loading Chapter...</div>;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
      
      {/* Sticky Navigation */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-md">{chapter.title}</span>
              <span className="text-xs text-slate-500 dark:text-slate-500">Chapter {chapter.order}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 relative">
              <Settings size={20} />
            </button>
            
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block"></div>

            <div className="hidden sm:flex items-center gap-1">
                <button onClick={() => onNavigate('prev')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                <ChevronLeft size={20} />
                </button>
                <button onClick={() => onNavigate('next')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                <ChevronRight size={20} />
                </button>
            </div>

            {settings.showOriginal && (
                <button 
                onClick={handleTranslate}
                disabled={isTranslating}
                className={`ml-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium shadow-sm transition-all
                    ${isTranslating ? 'bg-indigo-300 dark:bg-indigo-900 cursor-wait' : 'bg-primary hover:bg-indigo-600'}
                `}
                >
                <Wand2 size={16} className={isTranslating ? 'animate-spin' : ''} />
                <span className="hidden md:inline">{isTranslating ? 'Translating...' : 'Translate'}</span>
                </button>
            )}
          </div>
        </div>

        {/* Settings Dropdown */}
        {isSettingsOpen && (
            <div className="absolute top-full right-4 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 animate-in fade-in slide-in-from-top-2">
                
                {/* View Mode */}
                <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">View Mode</label>
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                        <button 
                            onClick={() => onUpdateSettings({ showOriginal: false })}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm rounded-md transition-all ${!settings.showOriginal ? 'bg-white dark:bg-slate-700 shadow text-primary' : 'text-slate-500'}`}
                        >
                            <FileText size={14} /> Reader
                        </button>
                        <button 
                            onClick={() => onUpdateSettings({ showOriginal: true })}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm rounded-md transition-all ${settings.showOriginal ? 'bg-white dark:bg-slate-700 shadow text-primary' : 'text-slate-500'}`}
                        >
                            <Columns size={14} /> Split
                        </button>
                    </div>
                </div>

                {/* Theme */}
                <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Theme</label>
                    <button 
                        onClick={() => onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {settings.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </span>
                        {settings.theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                    </button>
                </div>

                {/* Typography */}
                <div className="mb-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Typography</label>
                    
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={() => onUpdateSettings({ fontSize: Math.max(12, settings.fontSize - 2) })} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Type size={14} /></button>
                        <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{settings.fontSize}px</span>
                        <button onClick={() => onUpdateSettings({ fontSize: Math.min(32, settings.fontSize + 2) })} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Type size={18} /></button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {['sans', 'serif', 'mono'].map(font => (
                            <button
                                key={font}
                                onClick={() => onUpdateSettings({ fontFamily: font as any })}
                                className={`py-1 text-xs rounded border ${settings.fontFamily === font ? 'border-primary text-primary bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                            >
                                {font === 'sans' ? 'Inter' : font === 'serif' ? 'Serif' : 'Mono'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className={`pt-20 pb-20 px-4 min-h-screen ${settings.showOriginal ? 'flex gap-6 max-w-[1600px] mx-auto' : 'max-w-3xl mx-auto'}`} ref={readerRef}>
        
        {/* Original Text (Only in Split View) */}
        {settings.showOriginal && (
          <div className="flex-1 hidden lg:block" onMouseUp={handleSelection}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 sticky top-20 bg-slate-100 dark:bg-slate-950 py-2">Original</h3>
            <div 
                className={`prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed
                ${settings.fontFamily === 'serif' ? 'font-serif' : settings.fontFamily === 'mono' ? 'font-mono' : 'font-sans'}
                `}
                style={{ fontSize: `${settings.fontSize * 0.9}px` }}
            >
              {chapter.content}
            </div>
          </div>
        )}

        {/* Translated Text (Main Reader) */}
        <div className="flex-1 bg-white dark:bg-slate-900 sm:rounded-2xl sm:shadow-lg sm:p-8 min-h-[80vh] relative">
          {editedTranslation ? (
            <textarea
              dir="rtl"
              value={editedTranslation}
              onChange={(e) => {
                  setEditedTranslation(e.target.value);
                  saveManualEdits(); // In reality, debouncing this is better
              }}
              className={`w-full h-full bg-transparent border-none resize-none focus:ring-0 font-arabic text-slate-800 dark:text-slate-200
                ${settings.fontFamily === 'serif' ? 'font-serif' : settings.fontFamily === 'mono' ? 'font-mono' : 'font-sans'}
              `}
              style={{ 
                  fontSize: `${settings.fontSize}px`,
                  lineHeight: settings.lineHeight
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400 text-center">
              <Wand2 size={48} className="mb-4 opacity-20" />
              <p className="mb-4">No translation available yet.</p>
              <button 
                onClick={handleTranslate}
                className="bg-primary text-white px-6 py-2 rounded-full hover:bg-indigo-600 transition-colors"
              >
                Translate Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button for Selection */}
      {selection && (
        <div 
          className="fixed z-[100] flex flex-col items-center animate-in fade-in zoom-in duration-200"
          style={{ left: selection.x, top: selection.y - 50, transform: 'translateX(-50%)' }}
        >
          <button 
            onClick={addToGlossary}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl hover:bg-black transition-colors text-sm font-medium whitespace-nowrap"
          >
            <PlusCircle size={14} /> Add "{selection.text.length > 15 ? selection.text.slice(0, 12) + '...' : selection.text}" to Glossary
          </button>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 mt-[-1px]"></div>
        </div>
      )}

    </div>
  );
};
