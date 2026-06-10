import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, AlertCircle, FileVideo, Plus, Sparkles, Wand2, Info } from 'lucide-react';

import { ClipItem, ProcessingStatus, ProcessedClip, UserVideo } from './types';
import { parseTimestamp, formatSeconds } from './utils/time';
import { cutVideoDirectCapture, extractAudioPreregistered } from './utils/cutterEngine';

import Header from './components/Header';
import VideoUploadZone from './components/VideoUploadZone';
import VideoScrubber from './components/VideoScrubber';
import ClipRowsList from './components/ClipRowsList';
import ProgressIndicator from './components/ProgressIndicator';
import DownloadSection from './components/DownloadSection';

// Helper to create uniquely identified initial empty rows
const createDefaultClips = (): ClipItem[] => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return [
      { id: crypto.randomUUID(), name: 'Intro Hook', startTime: '0:00', endTime: '0:15', validatedStart: 0, validatedEnd: 15, error: null },
      { id: crypto.randomUUID(), name: 'Middle Highlight', startTime: '', endTime: '', validatedStart: null, validatedEnd: null, error: null },
      { id: crypto.randomUUID(), name: 'Outro Segment', startTime: '', endTime: '', validatedStart: null, validatedEnd: null, error: null }
    ];
  } else {
    // Math.random fallback
    const mockId = () => Math.random().toString(36).substr(2, 9);
    return [
      { id: mockId(), name: 'Intro Hook', startTime: '0:00', endTime: '0:15', validatedStart: 0, validatedEnd: 15, error: null },
      { id: mockId(), name: 'Middle Highlight', startTime: '', endTime: '', validatedStart: null, validatedEnd: null, error: null },
      { id: mockId(), name: 'Outro Segment', startTime: '', endTime: '', validatedStart: null, validatedEnd: null, error: null }
    ];
  }
};

export default function App() {
  const [video, setVideo] = useState<UserVideo | null>(null);
  
  // Load initial clips config securely from localStorage to prevent loss
  const [clips, setClips] = useState<ClipItem[]>(() => {
    try {
      const saved = localStorage.getItem('vidcutter_saved_clips');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return createDefaultClips();
  });

  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  
  // Processing & compilation states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    active: false,
    currentIndex: 0,
    totalClips: 0,
    progress: 0,
    statusText: '',
    clipName: '',
  });
  const [processedClips, setProcessedClips] = useState<ProcessedClip[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Resolution and output format options with localStorage fallback
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm' | 'mp3'>(() => {
    try {
      const saved = localStorage.getItem('vidcutter_saved_format');
      if (saved === 'mp4' || saved === 'webm' || saved === 'mp3') {
        return saved;
      }
    } catch (e) {}
    return 'mp4';
  });

  const [resolutionPreset, setResolutionPreset] = useState<'original' | '1080p' | '720p'>(() => {
    try {
      const saved = localStorage.getItem('vidcutter_saved_resolution');
      if (saved === 'original' || saved === '1080p' || saved === '720p') {
        return saved;
      }
    } catch (e) {}
    return 'original';
  });

  // Persist session states reactively
  React.useEffect(() => {
    try {
      localStorage.setItem('vidcutter_saved_clips', JSON.stringify(clips));
    } catch (e) {}
  }, [clips]);

  React.useEffect(() => {
    try {
      localStorage.setItem('vidcutter_saved_format', exportFormat);
    } catch (e) {}
  }, [exportFormat]);

  React.useEffect(() => {
    try {
      localStorage.setItem('vidcutter_saved_resolution', resolutionPreset);
    } catch (e) {}
  }, [resolutionPreset]);

  // Triggered on video load
  const handleVideoSelected = (selectedVideo: UserVideo) => {
    setVideo(selectedVideo);
    setGeneralError(null);
    if (selectedVideo.isYoutube) {
      setResolutionPreset('original');
    }
    
    // Automatically pre-populate default row values inside duration boundary
    const nextClips = [...clips];
    if (nextClips[0]) {
      const endVal = Math.min(15, Math.floor(selectedVideo.duration));
      nextClips[0].endTime = formatSeconds(endVal);
      nextClips[0].validatedEnd = endVal;
    }
    setClips(nextClips);
  };

  const handleClearVideo = () => {
    // Revoke any existing object URLs to avoid memory leaks
    if (video && !video.url.startsWith('http://') && !video.url.startsWith('https://')) {
      URL.revokeObjectURL(video.url);
    }
    processedClips.forEach(clip => {
      if (clip.url && !clip.url.startsWith('http://') && !clip.url.startsWith('https://')) {
        URL.revokeObjectURL(clip.url);
      }
    });

    setVideo(null);
    setClips(createDefaultClips());
    setActiveRowIndex(0);
    setProcessedClips([]);
    setIsProcessing(false);
    setGeneralError(null);
    setProcessingStatus({
      active: false,
      currentIndex: 0,
      totalClips: 0,
      progress: 0,
      statusText: '',
      clipName: ''
    });
  };

  // Perform single-row validation & mapping state update
  const handleUpdateClip = (id: string, field: keyof ClipItem, value: string) => {
    const updated = clips.map((clip) => {
      if (clip.id !== id) return clip;

      const updatedClip = { ...clip, [field]: value };
      
      // Compute on-the-fly parsing when they change start/end fields
      if (field === 'startTime' || field === 'endTime') {
        const startSec = parseTimestamp(field === 'startTime' ? value : clip.startTime);
        const endSec = parseTimestamp(field === 'endTime' ? value : clip.endTime);

        updatedClip.validatedStart = startSec;
        updatedClip.validatedEnd = endSec;
        updatedClip.error = null; // reset initial error tag

        // If something was filled, run checking code
        if (field === 'startTime' && value !== '' && startSec === null) {
          updatedClip.error = 'Invalid start format';
        } else if (field === 'endTime' && value !== '' && endSec === null) {
          updatedClip.error = 'Invalid end format';
        } else if (startSec !== null && endSec !== null) {
          if (startSec >= endSec) {
            updatedClip.error = 'Start must be before End';
          } else if (video && startSec > video.duration) {
            updatedClip.error = `Start exceeds video length (${Math.floor(video.duration)}s)`;
          } else if (video && endSec > video.duration) {
            updatedClip.error = `End exceeds video length (${Math.floor(video.duration)}s)`;
          }
        }
      }
      return updatedClip;
    });

    setClips(updated);
  };

  // Set selected timestamp from VideoScrubber quick keys
  const handleSetTimestamp = (seconds: number, target: 'start' | 'end') => {
    if (clips.length === 0) return;
    const targetClip = clips[activeRowIndex];
    if (!targetClip) return;

    const formatted = formatSeconds(seconds);
    const id = targetClip.id;

    if (target === 'start') {
      handleUpdateClip(id, 'startTime', formatted);
    } else {
      handleUpdateClip(id, 'endTime', formatted);
    }
  };

  const handleAddClipRow = () => {
    const mockId = () => Math.random().toString(36).substr(2, 9);
    const newIdx = clips.length + 1;
    const newRow: ClipItem = {
      id: mockId(),
      name: `Clip Row ${newIdx}`,
      startTime: '',
      endTime: '',
      validatedStart: null,
      validatedEnd: null,
      error: null
    };
    setClips([...clips, newRow]);
    setActiveRowIndex(clips.length); // auto focus on new Row
  };

  const handleRemoveClipRow = (id: string) => {
    if (clips.length <= 1) return;
    const filtered = clips.filter(c => c.id !== id);
    setClips(filtered);
    
    // Safety check for active indicators index
    if (activeRowIndex >= filtered.length) {
      setActiveRowIndex(filtered.length - 1);
    }
  };

  const handleResetSession = () => {
    // revoke URLs
    processedClips.forEach(clip => {
      URL.revokeObjectURL(clip.url);
    });
    setProcessedClips([]);
    setIsProcessing(false);
    setGeneralError(null);
    setClips(createDefaultClips());
    setActiveRowIndex(0);
    setProcessingStatus({
      active: false,
      currentIndex: 0,
      totalClips: 0,
      progress: 0,
      statusText: '',
      clipName: ''
    });
  };

  // Core execution workflow trigger
  const runExtractorProcess = async () => {
    if (!video) {
      setGeneralError('Please upload a source video first before cutting segments.');
      return;
    }

    setGeneralError(null);
    setIsProcessing(true);

    // Filter and sanitize list
    // 1. If any row is completely blank, we can ignore it! This prevents empty default items from blocking compiles.
    // 2. If a row is partially filled, we validate it.
    const activeConfigurations = clips.filter(c => {
      return c.name.trim() !== '' || c.startTime.trim() !== '' || c.endTime.trim() !== '';
    });

    if (activeConfigurations.length === 0) {
      setGeneralError('Please configure at least one video segment with a name, start time, and end time.');
      setIsProcessing(false);
      return;
    }

    // Complete deep validation pass
    let hasValidationError = false;
    const verifiedClips = clips.map((clip) => {
      // Skip empty ones
      const isBlank = clip.name.trim() === '' && clip.startTime.trim() === '' && clip.endTime.trim() === '';
      if (isBlank) return clip;

      const updated = { ...clip };
      const startSec = parseTimestamp(clip.startTime);
      const endSec = parseTimestamp(clip.endTime);

      updated.validatedStart = startSec;
      updated.validatedEnd = endSec;

      if (!clip.name.trim()) {
        updated.error = 'Clip Name is required';
        hasValidationError = true;
      } else if (startSec === null) {
        updated.error = 'Valid start time is required';
        hasValidationError = true;
      } else if (endSec === null) {
        updated.error = 'Valid end time is required';
        hasValidationError = true;
      } else if (startSec >= endSec) {
        updated.error = 'Start time must be earlier than End time';
        hasValidationError = true;
      } else if (startSec > video.duration) {
        updated.error = `Start time exceeeds video duration (${Math.floor(video.duration)}s)`;
        hasValidationError = true;
      } else if (endSec > video.duration) {
        updated.error = `End time exceeeds video duration (${Math.floor(video.duration)}s)`;
        hasValidationError = true;
      } else {
        updated.error = null;
      }
      return updated;
    });

    if (hasValidationError) {
      setClips(verifiedClips);
      setGeneralError('Validation failed on one or more clip rows. Please check inline warnings above.');
      setIsProcessing(false);
      return;
    }

    // We have only valid, populated clips left! Let's slice them.
    const clipsToProcess = verifiedClips.filter(c => {
      const isBlank = c.name.trim() === '' && c.startTime.trim() === '' && c.endTime.trim() === '';
      return !isBlank;
    });

    const outputList: ProcessedClip[] = [];

    // Loop through one by one sequentially
    for (let index = 0; index < clipsToProcess.length; index++) {
      const target = clipsToProcess[index];
      const start = target.validatedStart as number;
      const end = target.validatedEnd as number;

      setProcessingStatus({
        active: true,
        currentIndex: index,
        totalClips: clipsToProcess.length,
        progress: 0,
        statusText: `Initializing offscreen sandbox capture...`,
        clipName: target.name
      });

      try {
        let result;
        if (exportFormat === 'mp3') {
          result = await extractAudioPreregistered({
            videoUrl: video.url,
            startTime: start,
            endTime: end,
            clipName: target.name,
            onProgress: (pct) => {
              setProcessingStatus(prev => ({
                ...prev,
                progress: pct,
                statusText: pct >= 90 
                  ? `Writing premium uncompressed quality MP3 payload...` 
                  : pct >= 40 
                  ? `Demuxing and decoding master audio channel tracks...` 
                  : `Connecting to media buffers...`
              }));
            }
          });
        } else {
          result = await cutVideoDirectCapture({
            videoUrl: video.url,
            startTime: start,
            endTime: end,
            clipName: target.name,
            width: video.width,
            height: video.height,
            resolutionPreset,
            format: exportFormat,
            onProgress: (pct, currentSecs) => {
              setProcessingStatus(prev => ({
                ...prev,
                progress: pct,
                statusText: `Capturing and syncing frame ${formatSeconds(currentSecs, true)} / ${formatSeconds(end)} at high fidelity...`
              }));
            }
          });
        }

        const completedClip: ProcessedClip = {
          ...result,
          id: Math.random().toString(36).substring(2, 11)
        };

        outputList.push(completedClip);
      } catch (err: any) {
        setGeneralError(`Extraction failed on "${target.name}": ` + err.message);
        setIsProcessing(false);
        setProcessingStatus(prev => ({ ...prev, active: false }));
        return;
      }
    }

    setProcessedClips(outputList);
    setIsProcessing(false);
    setProcessingStatus(prev => ({ ...prev, active: false }));
  };

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col font-sans selection:bg-[#1a4aff] selection:text-white pb-12">
      {/* Dynamic Header */}
      <Header />

      {/* Main Container Workspace */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full flex flex-col gap-6">
        
        {/* Dynamic Warning Alert banners */}
        {generalError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/5 border border-red-500/20 text-[#ff6b6b] px-5 py-4 rounded-2xl flex items-start gap-3.5 shadow-xl"
            id="app-general-error-banner"
          >
            <AlertCircle className="w-5.5 h-5.5 text-[#ff6b6b] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-[#ff6b6b]">Processing Blocked</h4>
              <p className="text-xs text-white/55 mt-1">{generalError}</p>
            </div>
          </motion.div>
        )}

        {/* Video Upload Zone Container */}
        <VideoUploadZone 
          onVideoSelected={handleVideoSelected}
          selectedVideo={video}
          onClearVideo={handleClearVideo}
        />

        {/* Dynamic columns workspace: Only active after file loading */}
        {video && (
          <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] xl:grid-cols-[460px_1fr] gap-6 items-start">
            
            {/* Column Left: Visual scrubbing and frame targeting */}
            <div className="space-y-4">
              <VideoScrubber
                video={video}
                activeClipName={clips[activeRowIndex]?.name || ''}
                activeClipIndex={activeRowIndex}
                onSetTimestamp={handleSetTimestamp}
              />
              
              {/* How-To-Guide info sticky bullet cards */}
              <div className="bg-[#0a1540]/60 border border-white/5 rounded-2xl p-4 flex gap-3 text-xs text-white/40">
                <Info className="w-5.5 h-5.5 text-[#2060ff] shrink-0 mt-0.5" />
                <div className="space-y-1.5" id="help-how-to-guide">
                  <p className="font-semibold text-zinc-300">Creator Hack: Keyboard shortcuts</p>
                  <p>1. Press <kbd className="font-mono bg-black/40 border border-white/5 px-1.5 py-0.5 rounded text-white/60">Space</kbd> on any card to toggle Play/Pause.</p>
                  <p>2. Press <kbd className="font-mono bg-black/40 border border-white/5 px-1.5 py-0.5 rounded text-white/60">←</kbd> and <kbd className="font-mono bg-black/40 border border-white/5 px-1.5 py-0.5 rounded text-white/60">→</kbd> to rewind or fast forward by 2 seconds.</p>
                  <p>3. Use the frame buttons under the preview player to advance by exactly <strong className="text-[#4d88ff]">0.1s</strong> for precise cuts.</p>
                </div>
              </div>
            </div>

            {/* Column Right: Clips Setup list and cut activation */}
            <div className="space-y-6">
              <ClipRowsList
                clips={clips}
                activeRowIndex={activeRowIndex}
                onSetActiveRow={setActiveRowIndex}
                onUpdateClip={handleUpdateClip}
                onAddClip={handleAddClipRow}
                onRemoveClip={handleRemoveClipRow}
                videoDuration={video.duration}
                onBulkImport={(newClips) => setClips(newClips)}
              />

              {/* Export Settings Panel */}
              {!isProcessing && processedClips.length === 0 && (
                <div className="glass-panel p-5 space-y-4 shadow-lg" id="export-tuning-panel">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                    <Sparkles className="w-4 h-4 text-[#4d88ff]" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#4d88ff]">
                      Export Tuning & Settings
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Format Selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-white/50">Export Style</label>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-[#03071a] rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setExportFormat('mp4')}
                          className={`py-1.5 px-2 text-[11px] font-medium rounded-lg transition cursor-pointer ${
                            exportFormat === 'mp4'
                              ? 'bg-[#1a4aff] text-white font-bold shadow shadow-[#1a4aff]/20'
                              : 'text-[#4d88ff] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          🎬 MP4
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportFormat('webm')}
                          className={`py-1.5 px-2 text-[11px] font-medium rounded-lg transition cursor-pointer ${
                            exportFormat === 'webm'
                              ? 'bg-[#1a4aff] text-white font-bold shadow shadow-[#1a4aff]/20'
                              : 'text-[#4d88ff] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          🎥 WebM
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportFormat('mp3')}
                          className={`py-1.5 px-2 text-[11px] font-medium rounded-lg transition cursor-pointer ${
                            exportFormat === 'mp3'
                              ? 'bg-[#1a4aff] text-white font-bold shadow shadow-[#1a4aff]/20'
                              : 'text-[#4d88ff] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          🎵 MP3
                        </button>
                      </div>
                      <p className="text-[10px] text-white/35 leading-relaxed font-sans">
                        {exportFormat === 'mp4' 
                          ? 'Capture high-speed pristine video clips saved as standard MP4 container format.' 
                          : exportFormat === 'webm'
                          ? 'Export premium-bitrate clips natively encoded as highly optimized standard WebM video files.'
                          : 'Extract raw stereophonic audio tracks as CD-quality uncompressed MP3 chunks at 320 kbps.'}
                      </p>
                    </div>

                    {/* Quality / Resolution Selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-white/50">
                        Resolution Preset
                      </label>
                      <div className="flex flex-col gap-1.5">
                        <select
                          disabled={exportFormat === 'mp3'}
                          value={resolutionPreset}
                          onChange={(e) => setResolutionPreset(e.target.value as any)}
                          className="w-full bg-[#03071a] border border-white/5 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#2060ff] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          <option value="original" className="bg-[#03071a] text-white">Original Master Resolution ({video?.width}x{video?.height}px)</option>
                          <option value="1080p" className="bg-[#03071a] text-white">1080p Full HD (1920x1080 scaled)</option>
                          <option value="720p" className="bg-[#03071a] text-white">720p HD (1280x720 scaled)</option>
                        </select>
                        <p className="text-[10px] text-white/35 leading-relaxed font-sans font-medium">
                          {exportFormat === 'mp3'
                            ? 'Disabled for audio format. Core audio track is extracted at absolute 100% original master quality.'
                            : resolutionPreset === 'original'
                            ? `Export at the video's original loaded capture resolution of ${video?.width}x${video?.height}px. (Note: High resolutions like 4K are highly resource intensive. If your page reloads or lags, select 1080p or 720p for a perfectly stable work flow).`
                            : `Proportionally scale video frames to ${resolutionPreset === '1080p' ? '1920x1080 (Recommended)' : '1280x720'} bounds to prevent browser lag, eliminate CPU overload, and guarantee flawless rendering.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action cutting triggers */}
              {!isProcessing && processedClips.length === 0 && (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileActive={{ scale: 0.99 }}
                  type="button"
                  onClick={runExtractorProcess}
                  className="w-full py-4 bg-gradient-to-tr from-[#1a4aff] to-[#0033cc] text-white font-bold text-sm tracking-wider uppercase rounded-2xl shadow-xl shadow-[#1a4aff]/30 hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  id="btn-trigger-extraction-process"
                >
                  <Scissors className="w-5 h-5 shrink-0" />
                  ✂ Cut and Compile Clips
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Dynamic progress screen compilation section */}
        <AnimatePresence>
          {isProcessing && (
            <ProgressIndicator status={processingStatus} />
          )}
        </AnimatePresence>

        {/* Download grids */}
        <AnimatePresence>
          {processedClips.length > 0 && !isProcessing && (
            <DownloadSection 
              processedClips={processedClips}
              onReset={handleResetSession}
            />
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
