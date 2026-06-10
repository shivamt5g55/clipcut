import React, { useRef, useState } from 'react';
import { Upload, HardDrive, Film, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { UserVideo } from '../types';
import { formatSeconds } from '../utils/time';

interface VideoUploadZoneProps {
  onVideoSelected: (video: UserVideo) => void;
  selectedVideo: UserVideo | null;
  onClearVideo: () => void;
}

export default function VideoUploadZone({ 
  onVideoSelected, 
  selectedVideo, 
  onClearVideo 
}: VideoUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const processVideoFile = (file: File) => {
    const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB limit
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMsg('This file exceeds the 2GB limit. Please upload a smaller video.');
      return;
    }

    setLoadingMetadata(true);
    setErrorMsg(null);

    try {
      const url = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.preload = 'metadata';

      tempVideo.onloadedmetadata = () => {
        const duration = tempVideo.duration;
        const width = tempVideo.videoWidth;
        const height = tempVideo.videoHeight;

        onVideoSelected({
          file,
          name: file.name,
          size: file.size,
          url,
          duration,
          width,
          height,
          isYoutube: false
        });
        setLoadingMetadata(false);
      };

      tempVideo.onerror = () => {
        setErrorMsg('Unable to parse video metadata. Standard video codecs (H.264/AAC MP4) are recommended.');
        setLoadingMetadata(false);
        URL.revokeObjectURL(url);
      };
    } catch (e: any) {
      setErrorMsg('Failed to process file: ' + e.message);
      setLoadingMetadata(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/') || file.name.endsWith('.mkv') || file.name.endsWith('.avi')) {
        processVideoFile(file);
      } else {
        setErrorMsg('Invalid file type! Please upload standard video formats (MP4, MOV, MKV, AVI).');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processVideoFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="glass-panel p-6" id="upload-zone-main">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-18px font-display tracking-[3px] text-[#4d88ff] flex items-center gap-2">
          <span className="bg-[#1a4aff] text-white text-[11px] px-2 py-0.5 rounded font-mono font-bold">01</span>
          {selectedVideo ? 'SOURCE VIDEO ACTIVE' : 'CHOOSE SOURCE VIDEO'}
        </h2>
        {selectedVideo && (
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={triggerFileInput}
              className="text-xs flex items-center gap-1.5 bg-[#0a1540] border border-white/10 hover:border-accent-light/50 hover:bg-accent-blue/10 text-white/60 hover:text-[#4d88ff] px-3 py-2 rounded-xl transition cursor-pointer font-medium shadow"
              id="btn-upload-another-video"
            >
              <Upload className="w-3.5 h-3.5 text-[#2060ff]" />
              Upload Another
            </button>
            <button 
              type="button"
              onClick={onClearVideo}
              className="text-xs flex items-center gap-1.5 bg-white/5 border border-white/5 hover:border-red-900/40 hover:bg-red-950/20 text-white/40 hover:text-red-400 px-3 py-2 rounded-xl transition cursor-pointer font-medium"
              id="btn-clear-video"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Source
            </button>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*"
        className="hidden"
      />

      {!selectedVideo ? (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            style={{
              borderColor: isDragging ? 'rgba(32,96,255,0.5)' : 'rgba(255,255,255,0.1)',
              background: isDragging ? 'rgba(32,96,255,0.04)' : 'rgba(255,255,255,0.02)',
              boxShadow: isDragging ? 'inset 0 0 40px rgba(32,96,255,0.05)' : 'none',
              borderWidth: '1.5px',
              borderRadius: '16px'
            }}
            className="relative p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[220px]"
            id="dropzone-video-upload"
          >
            {loadingMetadata ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#4d88ff] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-zinc-300 font-medium">Parsing local media file...</p>
                <p className="text-xs text-zinc-500">Checking streams &amp; codec metadata</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-[#0a1540] border border-white/5 rounded-2xl mb-4 text-[#2060ff]">
                  <Upload className="w-8 h-8 text-[#2060ff] animate-pulse" />
                </div>
                <p className="text-sm text-zinc-200 font-medium mb-1">
                  Drag &amp; drop video here, or <span className="text-[#4d88ff] hover:underline">browse files</span>
                </p>
                <p className="text-xs text-white/35 max-w-sm mb-4">
                  Supports MP4, MOV, MKV, AVI up to 2GB. Stream remains 100% locally client-safe.
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-[10px] text-zinc-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                  <span className="flex items-center gap-1 text-[#2060ff]"><HardDrive className="w-3" /> Max 2GB</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-700 mt-1"></span>
                  <span>H.264 MP4 Recommended</span>
                </div>
              </>
            )}

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-4 right-4 bg-[#ff3232]/5 border border-[#ff3232]/20 text-[#ff6b6b] text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-[#ff6b6b]" />
                <span className="truncate">{errorMsg}</span>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        /* Video Metadata Ready State Card */
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 border ${
            isDragging 
              ? 'border-[#2060ff] bg-[#2060ff]/10 shadow-[0_0_25px_rgba(32,96,255,0.15)]' 
              : 'bg-[#12205c]/40 border-white/5'
          }`}
          id="video-metadata-details"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 border rounded-xl bg-[#0a1540]/60 border-white/5 text-[#2060ff] shrink-0">
              <Film className="w-6 h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate max-w-[280px] md:max-w-md" title={selectedVideo.name}>
                {selectedVideo.name}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60 mt-1">
                <span>Type: <strong className="text-zinc-200">Local Video Stream</strong></span>
                <span className="text-zinc-700">•</span>
                <span>Duration: <strong className="text-zinc-200">{formatSeconds(selectedVideo.duration)}</strong></span>
                <span className="text-zinc-700">•</span>
                <span>Resolution: <strong className="text-zinc-200">{selectedVideo.width}x{selectedVideo.height} {selectedVideo.width >= 3840 && '🔥 4K UHD'}</strong></span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-lg shrink-0 font-medium font-mono">
              Original Master Ready {selectedVideo.width >= 3840 && '(4K)'}
            </div>
            <span className="text-[10px] text-white/30 hidden md:inline">Drag new video here to replace instantly</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
