import React, { useState } from 'react';
import { db } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Book, Plus, Trash2 } from 'lucide-react';

interface Props {
  onSelectNovel: (id: number) => void;
}

export const Library: React.FC<Props> = ({ onSelectNovel }) => {
  const novels = useLiveQuery(() => db.novels.toArray());
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async () => {
    if (!newTitle) return;
    await db.novels.add({
      title: newTitle,
      createdAt: new Date(),
    });
    setNewTitle('');
    setIsAdding(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if(confirm('Delete this novel and all chapters?')) {
        await (db as any).transaction('rw', db.novels, db.chapters, db.glossary, async () => {
            await db.chapters.where({ novelId: id }).delete();
            await db.glossary.where({ novelId: id }).delete();
            await db.novels.delete(id);
        });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">My Library</h1>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} /> Add Novel
        </button>
      </div>

      {isAdding && (
        <div className="mb-8 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Novel Title</label>
          <div className="flex gap-4">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="e.g. Reverend Insanity"
            />
            <button
              onClick={handleAdd}
              className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800"
            >
              Create
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {novels?.map((novel) => (
          <div
            key={novel.id}
            onClick={() => novel.id && onSelectNovel(novel.id)}
            className="group bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-xl border border-slate-200 dark:border-slate-800 cursor-pointer transition-all duration-300 overflow-hidden"
          >
            <div className="h-32 bg-gradient-to-r from-primary to-indigo-400 flex items-center justify-center">
              <Book size={48} className="text-white opacity-80" />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2 group-hover:text-primary transition-colors">
                {novel.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                Added {novel.createdAt.toLocaleDateString()}
              </p>
              <div className="flex justify-between items-center border-t dark:border-slate-800 pt-4 border-slate-100">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Open Library
                </span>
                <button 
                    onClick={(e) => novel.id && handleDelete(e, novel.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                >
                    <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {novels?.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-400">
            <p>No novels found. Start by adding one!</p>
          </div>
        )}
      </div>
    </div>
  );
};
