import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Sparkles, AlertCircle, Wand2, List, FileText, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipItem } from '../types';
import { parseTimelineText } from '../utils/timelineParser';

interface ClipRowsListProps {
  clips: ClipItem[];
  activeRowIndex: number;
  onSetActiveRow: (idx: number) => void;
  onUpdateClip: (id: string, field: keyof ClipItem, value: string) => void;
  onAddClip: () => void;
  onRemoveClip: (id: string) => void;
  videoDuration: number | null;
  onBulkImport?: (newClips: ClipItem[]) => void;
}

export default function ClipRowsList({
  clips,
  activeRowIndex,
  onSetActiveRow,
  onUpdateClip,
  onAddClip,
  onRemoveClip,
  videoDuration,
  onBulkImport
}: ClipRowsListProps) {
  const [editorMode, setEditorMode] = useState<'manual' | 'batch'>('manual');
  const [timelineInput, setTimelineInput] = useState('');
  const [parsedStatus, setParsedStatus] = useState<string | null>(null);

  const handleParseTimeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineInput.trim()) {
      setParsedStatus('Please paste timeline text before parsing.');
      return;
    }

    try {
      const generatedClips = parseTimelineText(timelineInput, videoDuration);
      if (generatedClips.length === 0) {
        setParsedStatus('Could not identify any valid timestamps. Please ensure timestamps are in "mm:ss" or "hh:mm:ss" format.');
        return;
      }

      if (onBulkImport) {
        onBulkImport(generatedClips);
        setParsedStatus(`Success! Automatically imported ${generatedClips.length} clips.`);
        // Briefly delay switching tab to allow user to see success status
        setTimeout(() => {
          setEditorMode('manual');
          onSetActiveRow(0); // Focus the first imported row
          setParsedStatus(null);
        }, 1100);
      }
    } catch (err: any) {
      setParsedStatus('Failed to parse: ' + err.message);
    }
  };

  const loadSampleRange = () => {
    setTimelineInput(
      `00:00 - 00:15 Dynamic Intro Screen\n` +
      `00:30 - 01:25 Core Highlight and Commentary\n` +
      `01:50 - 02:40 Stunt sequence and funny reaction\n` +
      `04:10 - 04:55 Outro card & Call To Action`
    );
    setParsedStatus(null);
  };

  const loadSampleChapters = () => {
    setTimelineInput(
      `0:00 Introduction Segment\n` +
      `1:20 Behind the scenes setup\n` +
      `2:45 Main gameplay showcase\n` +
      `5:10 Epic bloopers reel`
    );
    setParsedStatus(null);
  };

  return (
    <div className="glass-panel p-6 flex flex-col gap-5" id="configure-clips-section">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-display tracking-[3px] text-[#4d88ff] flex items-center gap-2">
            <span className="bg-[#1a4aff] text-white text-[11px] px-2 py-0.5 rounded font-mono font-bold">02</span>
            CONFIGURE EXTRACTION CLIPS
          </h2>
          <p className="text-xs text-white/35 mt-1">
            Configure clipping time ranges. Use manual inputs or paste a pre-defined video timeline list below.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-white/5 border border-white/5 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditorMode('manual');
              setParsedStatus(null);
            }}
            className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition cursor-pointer ${
              editorMode === 'manual'
                ? 'bg-[#0a1540] text-[#4d88ff] border border-white/10 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Manual Table
          </button>
          <button
            type="button"
            onClick={() => {
              setEditorMode('batch');
              setParsedStatus(null);
            }}
            className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition cursor-pointer ${
              editorMode === 'batch'
                ? 'bg-gradient-to-tr from-[#1a4aff] to-[#0033cc] text-white shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-150'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Batch Text Timeline
          </button>
        </div>
      </div>

      {/* Manual Mode Layout */}
      {editorMode === 'manual' ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/35 font-medium">
              Manage individual clip bounds manually:
            </span>
            <button
              type="button"
              onClick={onAddClip}
              className="flex items-center gap-1.5 text-xs bg-transparent hover:bg-[#2060ff]/5 border border-white/10 hover:border-[#2060ff]/50 text-white/60 hover:text-[#4d88ff] px-3.5 py-2 rounded-xl transition font-semibold cursor-pointer"
              id="btn-add-clip-row"
            >
              <Plus className="w-4 h-4 text-[#4d88ff]" />
              Add Clip Row
            </button>
          </div>

          <div className="lg:block hidden bg-white/2 border-b border-white/5 px-4 py-2.5 rounded-lg text-[11px] font-mono font-medium text-white/30 tracking-wider">
            <div className="grid grid-cols-[auto_1fr_120px_120px_auto] gap-4 items-center">
              <div className="w-12 text-center">ACTIVE</div>
              <div>CLIP NAME / TITLE</div>
              <div>START TIMESTAMP</div>
              <div>END TIMESTAMP</div>
              <div className="w-10 text-center">DELETE</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {clips.map((clip, idx) => {
                const isActive = idx === activeRowIndex;
                return (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onSetActiveRow(idx)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#0a1540]/60 border-[#2060ff]/50 shadow-lg shadow-brand-blue/5' 
                        : 'bg-white/[0.02] border-white/5 hover:border-[#2060ff]/30 hover:bg-[#2060ff]/[0.03]'
                    }`}
                    id={`clip-row-${idx}`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_120px_120px_auto] gap-4 items-center">
                      {/* Select radio or status mark */}
                      <div className="flex items-center justify-between lg:justify-center w-full lg:w-12">
                        <span className="lg:hidden text-xs bg-black/40 font-mono px-2 py-1 rounded border border-white/5 text-zinc-400">
                          Row #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isActive ? 'border-[#2060ff] bg-[#2060ff]/10' : 'border-white/10'
                          }`}>
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#2060ff]" />}
                          </div>
                          <span className="hidden lg:inline text-xs font-mono text-white/30">#{idx + 1}</span>
                        </div>
                      </div>

                      {/* Clip description title */}
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={clip.name}
                          onChange={(e) => onUpdateClip(clip.id, 'name', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={`e.g. Social Highlight Part ${idx + 1}`}
                          className="bg-white/[0.03] border border-white/[0.08] focus:border-[#2060ff] focus:bg-[#2060ff]/5 focus:ring-3 focus:ring-[#2060ff]/10 text-white text-sm px-3 py-2 rounded-lg outline-none w-full font-medium transition placeholder-white/20"
                        />
                      </div>

                      {/* Start Duration Field */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] tracking-[2px] uppercase text-white/30 font-semibold lg:hidden">Start Time</label>
                        <input
                          type="text"
                          value={clip.startTime}
                          onChange={(e) => onUpdateClip(clip.id, 'startTime', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="0:00"
                          className="bg-white/[0.03] border border-white/[0.08] focus:border-[#2060ff] focus:bg-[#2060ff]/5 text-white font-mono text-xs px-3 py-2 rounded-lg outline-none w-full transition placeholder-white/20"
                        />
                      </div>

                      {/* End Duration Field */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] tracking-[2px] uppercase text-white/30 font-semibold lg:hidden">End Time</label>
                        <input
                          type="text"
                          value={clip.endTime}
                          onChange={(e) => onUpdateClip(clip.id, 'endTime', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="1:30"
                          className="bg-white/[0.03] border border-white/[0.08] focus:border-[#2060ff] focus:bg-[#2060ff]/5 text-white font-mono text-xs px-3 py-2 rounded-lg outline-none w-full transition placeholder-white/20"
                        />
                      </div>

                      {/* Removal Button */}
                      <div className="flex items-center justify-end lg:justify-center w-full lg:w-10">
                        <button
                          type="button"
                          disabled={clips.length <= 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveClip(clip.id);
                          }}
                          className={`p-2.5 rounded-lg border transition cursor-pointer ${
                            clips.length <= 1 
                              ? 'opacity-20 cursor-not-allowed border-white/5 text-white/10' 
                              : 'bg-white/[0.04] border-white/[0.08] rounded-lg text-white/30 hover:border-[#ff5050]/40 hover:text-[#ff5050] hover:bg-[#ff5050]/5'
                          }`}
                          title="Remove Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline validations */}
                    {clip.error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 bg-[#ff3232]/5 border border-[#ff3232]/20 text-[#ff6b6b] text-xs px-3 py-1.5 rounded-lg flex items-center gap-2"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#ff6b6b]" />
                        <span className="font-semibold">{clip.error}</span>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      ) : (
        /* Batch Timeline Parsing Mode Panel */
        <form onSubmit={handleParseTimeline} className="space-y-4" id="batch-timeline-form">
          <div className="bg-white/2 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-200 block">⚡ Smart Timeline Paste Space</span>
              <p className="text-xs text-white/40">
                Paste the video timeline chapters list (from YouTube descriptions, logs, or comments) and we will automatically map and clip all entries!
              </p>
            </div>
            {/* Sample loaders */}
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={loadSampleRange}
                className="text-[10px] font-bold bg-[#0a1540] hover:bg-[#0a1540]/80 border border-white/10 text-white/75 hover:text-white px-3 py-1.5 rounded-lg transition"
              >
                Sample Ranges
              </button>
              <button
                type="button"
                onClick={loadSampleChapters}
                className="text-[10px] font-bold bg-[#0a1540] hover:bg-[#0a1540]/80 border border-white/10 text-white/75 hover:text-white px-3 py-1.5 rounded-lg transition"
              >
                Sample Chapters
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              required
              rows={8}
              value={timelineInput}
              onChange={(e) => {
                setTimelineInput(e.target.value);
                setParsedStatus(null);
              }}
              placeholder={
                "Example Format 1 (Ranges):\n" +
                "0:00 - 0:15 Intro teaser section\n" +
                "1:30 - 2:05 Epic high fidelity clip\n\n" +
                "Example Format 2 (Chapters):\n" +
                "0:00 Introduction\n" +
                "1:25 Funny action reel\n" +
                "3:10 Behind the scene look"
              }
              className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/20 focus:border-[#2060ff] focus:bg-[#2060ff]/5 focus:ring-3 focus:ring-[#2060ff]/10 rounded-xl p-4 text-xs font-mono text-zinc-300 outline-none leading-relaxed transition placeholder-white/20"
            />
          </div>

          {parsedStatus && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs px-4 py-3 rounded-xl border flex items-center gap-2 ${
                parsedStatus.startsWith('Success')
                  ? 'bg-emerald-950/45 border-emerald-800 text-emerald-450 font-medium'
                  : 'bg-white/5 border-white/10 text-amber-400 font-medium'
              }`}
            >
              {parsedStatus.startsWith('Success') ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{parsedStatus}</span>
            </motion.div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setEditorMode('manual');
                setParsedStatus(null);
              }}
              className="text-xs bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/5 text-white/60 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!timelineInput.trim()}
              className="bg-gradient-to-tr from-[#1a4aff] to-[#0033cc] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#1a4aff]/20 transition"
            >
              <Wand2 className="w-4 h-4" />
              Parse &amp; Import Clips
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </form>
      )}

      {/* Timestamp guide stats card */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/30 bg-white/[0.01] rounded-xl p-3 border border-white/5 font-mono mt-1">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-white/20" />
          Formats: mm:ss (e.g. 2:46) or hh:mm:ss or seconds (e.g. 146)
        </span>
        {videoDuration && (
          <span>Source Duration Limit: <strong className="text-zinc-300">{Math.floor(videoDuration)}s</strong></span>
        )}
      </div>
    </div>
  );
}
