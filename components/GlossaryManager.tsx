import React, { useState } from 'react';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Save, Trash2, Lock, Unlock, Search } from 'lucide-react';
import { Term, TermCategory } from '../types';

interface Props {
  novelId: number;
  onBack: () => void;
}

export const GlossaryManager: React.FC<Props> = ({ novelId, onBack }) => {
  const terms = useLiveQuery(() => db.glossary.where({ novelId }).toArray(), [novelId]);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Term>>({});

  const startEdit = (term: Term) => {
    setEditingId(term.id!);
    setEditForm({ ...term });
  };

  const saveEdit = async () => {
    if (editingId && editForm) {
      await db.glossary.update(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const deleteTerm = async (id: number) => {
    if (confirm('Delete this term?')) {
      await db.glossary.delete(id);
    }
  };

  const toggleLock = async (term: Term) => {
    await db.glossary.update(term.id!, { isLocked: !term.isLocked });
  };

  const addEmptyTerm = async () => {
    const id = await db.glossary.add({
      novelId,
      original: 'New Term',
      translation: 'Translation',
      category: TermCategory.OTHER,
      isLocked: false
    });
    setEditingId(id as number);
    setEditForm({ 
      original: 'New Term', 
      translation: 'Translation', 
      category: TermCategory.OTHER,
      isLocked: false 
    });
  };

  const filteredTerms = terms?.filter(t => 
    t.original.toLowerCase().includes(filter.toLowerCase()) || 
    t.translation.includes(filter)
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Glossary Manager</h1>
          </div>
          <button 
            onClick={addEmptyTerm}
            className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={18} /> Add Term
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search terms..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Original Term</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Arabic Translation</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTerms?.map(term => (
                <tr key={term.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  
                  {/* --- Original --- */}
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">
                    {editingId === term.id ? (
                      <input 
                        className="w-full border border-primary rounded px-2 py-1 bg-white dark:bg-slate-700"
                        value={editForm.original}
                        onChange={e => setEditForm({...editForm, original: e.target.value})}
                      />
                    ) : (
                      <span className="font-medium">{term.original}</span>
                    )}
                  </td>

                  {/* --- Category --- */}
                  <td className="px-6 py-4">
                     {editingId === term.id ? (
                      <select 
                        className="w-full border border-primary rounded px-2 py-1 bg-white dark:bg-slate-700 dark:text-white"
                        value={editForm.category}
                        onChange={e => setEditForm({...editForm, category: e.target.value as TermCategory})}
                      >
                        {Object.values(TermCategory).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold
                        ${term.category === TermCategory.PERSON ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' : 
                          term.category === TermCategory.SKILL ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200' :
                          term.category === TermCategory.LOCATION ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}
                      `}>
                        {term.category}
                      </span>
                    )}
                  </td>

                  {/* --- Translation --- */}
                  <td className="px-6 py-4 text-right">
                    {editingId === term.id ? (
                      <input 
                        dir="rtl"
                        className="w-full border border-primary rounded px-2 py-1 font-arabic bg-white dark:bg-slate-700 dark:text-white"
                        value={editForm.translation}
                        onChange={e => setEditForm({...editForm, translation: e.target.value})}
                      />
                    ) : (
                      <span className="font-arabic text-lg text-emerald-700 dark:text-emerald-400">{term.translation}</span>
                    )}
                  </td>

                  {/* --- Actions --- */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {editingId === term.id ? (
                        <button onClick={saveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded">
                          <Save size={18} />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => startEdit(term)} className="text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded">
                             Edit
                          </button>
                          <button 
                            onClick={() => toggleLock(term)} 
                            className={`p-1 rounded ${term.isLocked ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-300 hover:text-slate-500'}`}
                            title={term.isLocked ? "Locked (AI won't overwrite)" : "Unlocked"}
                          >
                             {term.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                          </button>
                          <button onClick={() => deleteTerm(term.id!)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTerms?.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              No terms found. Run a Deep Scan or add one manually.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
