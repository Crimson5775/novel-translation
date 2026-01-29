import React, { useRef, useState, useEffect } from 'react';
import { db, bulkAddChapters } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { extractTermsFromText, findArabicTranslationForTerm, translateChapterWithGlossary } from '../services/geminiService';
import { Upload, FileText, Sparkles, Database, ArrowLeft, Play, Pause, Download, AlertCircle } from 'lucide-react';
import { Term, TermCategory } from '../types';
import jsPDF from 'jspdf';

interface Props {
  novelId: number;
  onBack: () => void;
  onOpenReader: (chapterId: number) => void;
  onOpenGlossary: () => void;
}

export const NovelDashboard: React.FC<Props> = ({ novelId, onBack, onOpenReader, onOpenGlossary }) => {
  const novel = useLiveQuery(() => db.novels.get(novelId), [novelId]);
  const chapters = useLiveQuery(() => db.chapters.where({ novelId }).sortBy('order'), [novelId]);
  const glossaryCount = useLiveQuery(() => db.glossary.where({ novelId }).count(), [novelId]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

  // Bulk Translation State
  const [isBulkTranslating, setIsBulkTranslating] = useState(false);
  const [bulkPaused, setBulkPaused] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, chapterName: '' });
  const stopSignal = useRef(false);

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await bulkAddChapters(novelId, e.target.files);
    }
  };

  // --- Deep Scan Logic (Existing) ---
  const runDeepScan = async () => {
    if (!chapters || chapters.length === 0) return;
    setIsScanning(true);
    setScanProgress('Initializing Deep Scan...');
    try {
      const sampleChapters = [
        ...chapters.slice(0, 3),
        chapters[Math.floor(chapters.length / 2)],
        ...chapters.slice(-3)
      ].filter(Boolean);

      const combinedText = sampleChapters.map(c => c.content).join('\n\n');
      setScanProgress('Extracting entities (AI)...');
      const rawTerms = await extractTermsFromText(combinedText);
      const existingTerms = await db.glossary.where({ novelId }).toArray();
      const existingOriginals = new Set(existingTerms.map(t => t.original.toLowerCase()));
      const uniqueNewTerms = rawTerms.filter(t => t.original && !existingOriginals.has(t.original.toLowerCase()));
      
      setScanProgress(`Found ${uniqueNewTerms.length} new terms. Translating...`);
      let completed = 0;
      for (const term of uniqueNewTerms) {
        if (!term.original) continue;
        const snippet = combinedText.substring(combinedText.indexOf(term.original), combinedText.indexOf(term.original) + 100);
        const translation = await findArabicTranslationForTerm(term.original, snippet);
        await db.glossary.add({
          novelId,
          original: term.original,
          category: (term.category as TermCategory) || TermCategory.OTHER,
          translation: translation,
          isLocked: false
        });
        completed++;
        setScanProgress(`Translating terms: ${completed}/${uniqueNewTerms.length}`);
      }
      setScanProgress('Scan Complete!');
      setTimeout(() => setIsScanning(false), 2000);
    } catch (err) {
      console.error(err);
      setScanProgress('Scan Failed.');
      setTimeout(() => setIsScanning(false), 3000);
    }
  };

  // --- Bulk Translation Logic (Queue) ---
  const startBulkTranslation = async () => {
    if (!chapters) return;
    const untranslated = chapters.filter(c => !c.translatedContent);
    if (untranslated.length === 0) {
        alert("All chapters are already translated!");
        return;
    }

    setIsBulkTranslating(true);
    setBulkPaused(false);
    stopSignal.current = false;
    setBulkProgress({ current: 0, total: untranslated.length, chapterName: '' });

    // Use a recursive-like async loop to handle the queue
    const glossary = await db.glossary.where({ novelId }).toArray();
    
    for (let i = 0; i < untranslated.length; i++) {
        // Check for Stop signal
        if (stopSignal.current) break;
        
        // Pause Logic: Wait while paused
        while (stopSignal.current === false && bulkPausedRef.current) { // Use ref for reading inside loop
           await new Promise(r => setTimeout(r, 500));
        }

        const chapter = untranslated[i];
        setBulkProgress({ current: i + 1, total: untranslated.length, chapterName: chapter.title });
        
        try {
            const result = await translateChapterWithGlossary(chapter.content, glossary);
            await db.chapters.update(chapter.id!, { 
                translatedContent: result,
                lastTranslated: new Date()
            });
            // Small delay to be nice to API
            await new Promise(r => setTimeout(r, 1000)); 
        } catch (e) {
            console.error(`Failed to translate ${chapter.title}`, e);
        }
    }

    setIsBulkTranslating(false);
    alert("Bulk translation process finished.");
  };

  // Ref trick to read state inside async loop
  const bulkPausedRef = useRef(false);
  useEffect(() => { bulkPausedRef.current = bulkPaused; }, [bulkPaused]);

  const togglePause = () => setBulkPaused(!bulkPaused);
  const stopBulk = () => { stopSignal.current = true; setIsBulkTranslating(false); };


  // --- Export Logic ---
  const handleExport = () => {
    if (!chapters || !novel) return;
    const doc = new jsPDF();
    
    // Configure font (Amiri for Arabic support) - standard jsPDF doesn't support Arabic well without custom fonts.
    // For this demo, we will stick to a simpler Text File download as fallback for robust Arabic support, 
    // or assume standard font. Let's do a Text File download for reliability in this env.
    
    const textContent = chapters.map(c => 
      `### ${c.title}\n\n${c.translatedContent || "[Not Translated]"}\n\n`
    ).join('***\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${novel.title}_Arabic.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };


  if (!novel) return <div className="dark:text-white">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{novel.title}</h1>
            <p className="text-slate-500 dark:text-slate-500 text-sm">
              {chapters?.length || 0} Chapters • {glossaryCount || 0} Glossary Terms
            </p>
          </div>
        </div>

        <div className="flex gap-3">
           <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <Upload size={18} /> Upload
            <input type="file" multiple accept=".txt" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          </button>

          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Download size={18} /> Export
          </button>

          <button onClick={onOpenGlossary} className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Database size={18} /> Glossary
          </button>
          
          <button 
            onClick={runDeepScan}
            disabled={isScanning || !chapters?.length}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium
              ${isScanning ? 'bg-slate-400 cursor-wait' : 'bg-accent hover:bg-rose-600'}
            `}
          >
            <Sparkles size={18} /> {isScanning ? 'Scanning...' : 'Deep Scan'}
          </button>
        </div>
      </div>

      {/* Progress Bars */}
      {isScanning && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 px-8 py-3 border-b border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
          <span className="text-indigo-700 dark:text-indigo-300 font-medium animate-pulse">{scanProgress}</span>
          <div className="h-2 w-48 bg-indigo-200 dark:bg-indigo-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 animate-progress-indeterminate"></div>
          </div>
        </div>
      )}

      {isBulkTranslating && (
         <div className="bg-emerald-50 dark:bg-emerald-900/20 px-8 py-4 border-b border-emerald-100 dark:border-emerald-800">
            <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
                    <Sparkles size={16} /> 
                    Translating: {bulkProgress.chapterName} ({bulkProgress.current}/{bulkProgress.total})
                </span>
                <div className="flex gap-2">
                    <button onClick={togglePause} className="px-3 py-1 bg-white dark:bg-slate-800 border rounded text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">
                        {bulkPaused ? <Play size={14} /> : <Pause size={14} />} {bulkPaused ? "Resume" : "Pause"}
                    </button>
                    <button onClick={stopBulk} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm font-medium hover:bg-red-200">
                        Stop
                    </button>
                </div>
            </div>
            <div className="w-full bg-emerald-200 dark:bg-emerald-900 rounded-full h-2.5">
                <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}></div>
            </div>
         </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        
        {/* Bulk Actions Banner */}
        {!isBulkTranslating && chapters && chapters.length > 0 && (
             <div className="mb-8 p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg text-white flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold mb-1">Bulk Translation Engine</h3>
                    <p className="opacity-90 text-sm">Translate all {chapters.filter(c => !c.translatedContent).length} untranslated chapters sequentially.</p>
                </div>
                <button 
                    onClick={startBulkTranslation}
                    className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-bold shadow-md hover:bg-indigo-50 transition-transform active:scale-95"
                >
                    Start Batch Translation
                </button>
             </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {chapters?.map((chapter) => (
            <div 
              key={chapter.id}
              onClick={() => chapter.id && onOpenReader(chapter.id)}
              className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary hover:shadow-md cursor-pointer group transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase">
                  Chapter {chapter.order}
                </span>
                {chapter.translatedContent ? (
                   <span className="w-2 h-2 rounded-full bg-emerald-500" title="Translated"></span>
                ) : (
                   <span className="w-2 h-2 rounded-full bg-slate-300" title="Not Translated"></span>
                )}
              </div>
              <h4 className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-primary transition-colors">
                {chapter.title}
              </h4>
              <div className="mt-4 flex items-center text-xs text-slate-400">
                <FileText size={14} className="mr-1" />
                {chapter.content.length.toLocaleString()} chars
              </div>
            </div>
          ))}
          
          {chapters?.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
              <Upload size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">No chapters uploaded yet</p>
              <p className="text-sm">Upload .txt files to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
