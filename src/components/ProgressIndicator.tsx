import { Play, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ProcessingStatus } from '../types';

interface ProgressIndicatorProps {
  status: ProcessingStatus;
}

export default function ProgressIndicator({ status }: ProgressIndicatorProps) {
  if (!status.active) return null;

  const isCompleted = status.progress >= 99;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      className="glass-panel p-6 relative overflow-hidden"
      id="progress-indicator-container"
    >
      {/* Accent glow line inside background card container */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r transition-all duration-300 ${
        isCompleted 
          ? 'from-[#00e676] to-[#60efff]' 
          : 'from-[#1a4aff] to-[#4d88ff]'
      } animate-pulse`} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full font-mono border transition-all duration-300 ${
            isCompleted
              ? 'text-[#00e676] bg-[#00e676]/10 border-[#00e676]/20'
              : 'text-[#4d88ff] bg-[#1a4aff]/10 border-[#1a4aff]/20'
          }`}>
            {isCompleted ? 'Render Complete' : 'Renderer System Active'}
          </span>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mt-2">
            {isCompleted ? (
              <motion.div
                initial={{ scale: 0.5, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <CheckCircle2 className="w-5 h-5 text-[#00e676] shrink-0" />
              </motion.div>
            ) : (
              <Loader2 className="w-5 h-5 text-[#2060ff] animate-spin shrink-0" />
            )}
            {isCompleted ? (
              <span>Clip &ldquo;{status.clipName}&rdquo; Extracted!</span>
            ) : (
              <span>Extracting Clip &ldquo;{status.clipName}&rdquo;</span>
            )}
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Running in-browser WebAudio capture. Do not browse away or close this tab during processing.
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs font-mono text-white/20">Queue Index Status</p>
          <p className="text-sm font-semibold text-zinc-200" id="progress-clip-ration">
            Clip <strong className={isCompleted ? 'text-[#00e676]' : 'text-[#4d88ff]'}>{status.currentIndex + 1}</strong> of <strong>{status.totalClips}</strong>
          </p>
        </div>
      </div>

      {/* Progress bar visual container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-xs text-white/40">
          <span className="flex items-center gap-1">
            <Sparkles className={`w-3.5 h-3.5 transition-colors duration-300 ${isCompleted ? 'text-[#00e676]' : 'text-white/20'}`} />
            {isCompleted ? 'Pristine audio master segment captured successfully!' : status.statusText}
          </span>
          <span className={`font-bold transition-colors duration-300 text-sm ${isCompleted ? 'text-[#00e676]' : 'text-[#4d88ff]'}`}>
            {isCompleted ? 'Finished!' : `${Math.floor(status.progress)}%`}
          </span>
        </div>

        <div className={`h-3 bg-white/5 rounded-full overflow-hidden border p-[1px] relative transition-colors duration-300 ${
          isCompleted ? 'border-[#00e676]/30' : 'border-white/5'
        }`}>
          <motion.div
            className={`h-full rounded-full relative overflow-hidden transition-all duration-300 ${
              isCompleted 
                ? 'bg-gradient-to-r from-[#00e676] to-[#60efff]' 
                : 'bg-gradient-to-r from-[#1a4aff] to-[#4d88ff]'
            }`}
            style={{ 
              boxShadow: isCompleted 
                ? '0 0 15px rgba(0, 230, 118, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.3)' 
                : '0 0 10px rgba(26,74,255,0.6)' 
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${status.progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.1 }}
          >
            {/* Shimmer light effect running across the bar when finished */}
            {isCompleted && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              />
            )}
          </motion.div>
        </div>
      </div>

      <div className={`mt-4 flex items-center gap-2 text-[10px] font-mono border px-3 py-2 rounded-xl transition-all duration-300 ${
        isCompleted 
          ? 'text-[#00e676]/90 bg-[#00e676]/5 border-[#00e676]/20'
          : 'text-white/50 bg-[#2060ff]/5 border-[#2060ff]/10'
      }`}>
        <AlertCircle className={`w-3.5 h-3.5 shrink-0 transition-colors duration-300 ${isCompleted ? 'text-[#00e676]' : 'text-[#4d88ff]'}`} />
        {isCompleted ? (
          <span>Segment encoding finalized. Proceeding to bundle standard container headers.</span>
        ) : (
          <span>Hardware acceleration engaged. Processes audio and frame buffers at <strong className="text-[#4d88ff]">200% original speed</strong> with pitch locking.</span>
        )}
      </div>
    </motion.div>
  );
}
