import React, { useState } from 'react';
import { Download, Sparkles, RefreshCw, Layers, Calendar, CheckSquare, Archive } from 'lucide-react';
import { motion } from 'motion/react';
import JSZip from 'jszip';
import { ProcessedClip } from '../types';
import { formatBytes, formatSeconds } from '../utils/time';

interface DownloadSectionProps {
  processedClips: ProcessedClip[];
  onReset: () => void;
}

export default function DownloadSection({ processedClips, onReset }: DownloadSectionProps) {
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  if (processedClips.length === 0) return null;

  const downloadAllAsZip = async () => {
    setIsZipping(true);
    setZipProgress(0);

    try {
      const zip = new JSZip();

      // Read each clip's blob through client local memory fetch
      for (let i = 0; i < processedClips.length; i++) {
        const clip = processedClips[i];
        const response = await fetch(clip.url);
        if (!response.ok) {
          throw new Error(`Failed to load segment data for "${clip.name}"`);
        }
        const blob = await response.blob();
        
        // Add file with natural custom filename
        zip.file(clip.fileName, blob);
      }

      // Generate the package ZIP blob
      // Using 'STORE' compression is highly recommended here, since clips (MP4/WebM/MP3) are
      // already highly compressed container streams. This produces instantaneous zip results on the CPU.
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (metadata) => {
        setZipProgress(Math.round(metadata.percent));
      });

      // Package and fire standard client download routine
      const downloadUrl = URL.createObjectURL(zipBlob);
      const tempLink = document.createElement('a');
      tempLink.href = downloadUrl;
      
      const cleanDate = new Date().toISOString().slice(0, 10);
      tempLink.download = `Clipped_Segments_Package_${cleanDate}.zip`;
      
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('ZIP compilation failed:', err);
      alert('Unable to pack ZIP: ' + err.message);
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-panel p-6 flex flex-col gap-6"
      id="completed-downloads-container"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-display tracking-[3px] text-[#4d88ff] flex items-center gap-2">
            <span className="bg-[#1a4aff] text-white text-[11px] px-2 py-0.5 rounded font-mono font-bold">03</span>
            DOWNLOAD EXTRACTED SNIPPETS
          </h2>
          <p className="text-xs text-white/35 mt-1 w-full max-w-xl">
            Clips have been compiled! Click on individual files below to save them individually, or packaging them into a single `.zip` file for convenience.
          </p>
        </div>
        
        {/* Actions Button Row */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isZipping}
            onClick={downloadAllAsZip}
            className={`flex items-center gap-2 text-xs py-2.5 px-4 rounded-xl font-extrabold transition shadow-md duration-200 ${
              isZipping
                ? 'bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 cursor-wait'
                : 'bg-gradient-to-r from-[#00ff87] to-[#60efff] hover:scale-105 text-[#03071a] cursor-pointer shadow-[#00ff87]/20 hover:shadow-[#00ff87]/40 active:scale-95'
            }`}
            id="btn-download-all-zip"
          >
            {isZipping ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
                <span>Creating ZIP Archive ({zipProgress}%)</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 shrink-0" />
                <span>Package All as ZIP ({processedClips.length} clips)</span>
              </>
            )}
          </button>

          {/* Reset / Cut More Action Button */}
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs bg-[#0a1540] hover:bg-[#0d1a52] border border-white/10 hover:border-[#2060ff]/40 text-[#4d88ff] hover:text-white px-4 py-2.5 rounded-xl transition font-semibold cursor-pointer"
            id="btn-reset-session"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#2060ff] animate-spin-slow" />
            Cut More Clips (Reset All)
          </button>
        </div>
      </div>

      {/* Grid of completed downloads */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {processedClips.map((clip, idx) => (
          <motion.div
            key={clip.id}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-[#20ff87]/[0.02] border border-[#20ff87]/[0.10] rounded-xl p-4 flex flex-col justify-between gap-5 relative overflow-hidden group shadow-md"
            id={`download-card-${clip.id}`}
          >
            {/* Visual badge highlight */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#20ff87]/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />

            {/* Render header details */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono tracking-widest uppercase font-bold text-[#20ff87] bg-black/40 border border-[#20ff87]/15 px-2 py-0.5 rounded-full">
                  Clip #{idx + 1} ({clip.format.toUpperCase()})
                </span>
                <span className="text-[10px] font-mono text-white/40">
                  {formatSeconds(clip.startTime)} - {formatSeconds(clip.endTime)}
                </span>
              </div>

              <h4 className="text-zinc-100 font-bold text-sm mt-2.5 truncate" title={clip.name}>
                {clip.name}
              </h4>

              <div className="flex items-center gap-4 text-xs font-mono text-white/40 mt-2">
                <div>
                  <span className="text-zinc-550 text-[10px] block font-sans">DURATION</span>
                  <strong className="text-zinc-200">{formatSeconds(clip.duration)}</strong>
                </div>
                <div className="w-[1px] h-6 bg-white/5" />
                <div>
                  <span className="text-zinc-555 text-[10px] block font-sans">FILE SIZES</span>
                  <strong className="text-zinc-200">{formatBytes(clip.fileSize)}</strong>
                </div>
              </div>
            </div>

            {/* Action download link button */}
            <a
              href={clip.url}
              download={clip.fileName}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#20ff87] hover:bg-[#00ff87] text-[#03071a] font-extrabold text-xs rounded-lg transition shadow-lg shadow-[#20ff87]/20 active:scale-98"
              id={`btn-download-clip-${clip.id}`}
            >
              <Download className="w-4 h-4" />
              Download Snippet File
            </a>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
