import { Video, Sparkles, Shield, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Header() {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  return (
    <header className="border-b border-white/5 bg-[#060d2e]/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand logo & tagline */}
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="p-2 sm:p-2.5 bg-gradient-to-tr from-brand-blue to-accent-light text-white rounded-xl shadow-lg shadow-brand-blue/30"
            id="header-logo"
          >
            <Video className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h1 
              className="text-3xl font-display tracking-wider text-white leading-none" 
              id="header-title"
              style={{ textShadow: '0 0 30px rgba(32, 96, 255, 0.6), 0 0 60px rgba(32, 96, 255, 0.2)' }}
            >
              CLIP-CUT
            </h1>
            <p className="text-xs text-white/35 mt-1 flex items-center gap-1.5" id="header-subtitle">
              <Sparkles className="w-3.5 h-3.5 text-accent-light" />
              100% Browser-Based Video Clip Extractor
            </p>
          </div>
        </div>

        {/* Privacy & Browser Notice */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="bg-[#0a1540]/60 border border-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-zinc-300 backdrop-blur-sm shadow-inner">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Fully Local & Private (Your video never leaves your PC)</span>
          </div>

          {isSafari && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-amber-950/40 border border-amber-800/60 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-amber-300 max-w-sm"
              id="safari-warning"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Safari has limited support. Please use <strong>Chrome</strong> or <strong>Edge</strong> for best results.</span>
            </motion.div>
          )}

          {!isSafari && (
            <div className="hidden sm:flex bg-[#0a1540]/60 border border-white/5 px-3 py-1.5 rounded-lg items-center gap-2 text-xs text-emerald-400 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>Supported Explorer Core Active</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
