import React, { useState, useEffect } from 'react';
import { ViewState, ReaderSettings } from './types';
import { Library } from './components/Library';
import { NovelDashboard } from './components/NovelDashboard';
import { GlossaryManager } from './components/GlossaryManager';
import { Reader } from './components/Reader';
import { db } from './services/db';

export default function App() {
  const [viewState, setViewState] = useState<ViewState>({ view: 'library' });
  
  // Global Reader Settings (persisted in localStorage ideally, using state for now)
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    const saved = localStorage.getItem('readerSettings');
    return saved ? JSON.parse(saved) : {
      fontSize: 18,
      lineHeight: 1.8,
      fontFamily: 'sans',
      showOriginal: false,
      theme: 'light'
    };
  });

  // Apply Theme
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('readerSettings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Navigation Helpers
  const goHome = () => setViewState({ view: 'library' });
  
  const selectNovel = (id: number) => {
    setViewState({ view: 'novel', novelId: id });
  };

  const openGlossary = () => {
    setViewState(prev => ({ ...prev, view: 'glossary' }));
  };

  const openReader = (chapterId: number) => {
    setViewState(prev => ({ ...prev, view: 'reader', chapterId }));
  };

  const handleReaderNavigate = async (direction: 'next' | 'prev') => {
    if (!viewState.novelId || !viewState.chapterId) return;
    
    const currentChapter = await db.chapters.get(viewState.chapterId);
    if (!currentChapter) return;

    const targetOrder = direction === 'next' ? currentChapter.order + 1 : currentChapter.order - 1;
    const targetChapter = await db.chapters
      .where({ novelId: viewState.novelId, order: targetOrder })
      .first();

    if (targetChapter && targetChapter.id) {
      setViewState(prev => ({ ...prev, chapterId: targetChapter.id }));
    } 
  };

  // View Router
  let content;
  switch (viewState.view) {
    case 'library':
      content = <Library onSelectNovel={selectNovel} />;
      break;
    case 'novel':
      if (viewState.novelId) {
        content = (
          <NovelDashboard 
            novelId={viewState.novelId} 
            onBack={goHome}
            onOpenReader={openReader}
            onOpenGlossary={openGlossary}
          />
        );
      }
      break;
    case 'glossary':
      if (viewState.novelId) {
        content = (
          <GlossaryManager 
            novelId={viewState.novelId} 
            onBack={() => setViewState({ view: 'novel', novelId: viewState.novelId })} 
          />
        );
      }
      break;
    case 'reader':
      if (viewState.chapterId && viewState.novelId) {
        content = (
          <Reader 
            chapterId={viewState.chapterId}
            onBack={() => setViewState({ view: 'novel', novelId: viewState.novelId })}
            onNavigate={handleReaderNavigate}
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        );
      }
      break;
    default:
      content = <Library onSelectNovel={selectNovel} />;
  }

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {content}
    </div>
  );
}
