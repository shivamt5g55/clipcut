import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, 
  SkipForward, ChevronRight, CornerDownRight, Landmark
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserVideo } from '../types';
import { formatSeconds } from '../utils/time';

interface VideoScrubberProps {
  video: UserVideo;
  activeClipName: string;
  activeClipIndex: number;
  onSetTimestamp: (seconds: number, target: 'start' | 'end') => void;
}

export default function VideoScrubber({ 
  video, 
  activeClipName, 
  activeClipIndex, 
  onSetTimestamp 
}: VideoScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Sync state with HTML5 Video updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(video.duration, videoRef.current.currentTime + amount));
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const changeSpeed = () => {
    const speeds = [0.25, 0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Keyboard controls for seeking with arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if focus is not in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        skip(-2);
      } else if (e.code === 'ArrowRight') {
        skip(2);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const useCurrentTime = (target: 'start' | 'end') => {
    onSetTimestamp(currentTime, target);
  };

  return (
    <div className="glass-panel p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-200 font-medium text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2060ff]"></span>
          Interactive Video Scrub Preview
        </h3>
        <p className="text-[11px] text-white/30">Arrow keys/Space supported</p>
      </div>

      {/* Video Display Container */}
      <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-zinc-900 group">
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-contain cursor-pointer"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onClick={togglePlay}
          preload="metadata"
          playsInline
        />
        
        {/* Absolute visual overlay for current timestamp */}
        <div className="absolute top-3 left-3 bg-[#03071a]/85 backdrop-blur border border-white/10 text-zinc-100 font-mono text-xs px-2.5 py-1 rounded-md shadow flex items-center gap-1.5 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2060ff] animate-pulse"></span>
          <span>{formatSeconds(currentTime, true)}</span>
          <span className="text-zinc-600 shrink-0">/</span>
          <span className="text-zinc-400">{formatSeconds(video.duration)}</span>
        </div>
      </div>

      {/* Scrubber Timeline track */}
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-center justify-between text-xs text-white/50 font-mono">
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(video.duration)}</span>
        </div>
        <div className="relative group">
          <input
            type="range"
            min="0"
            max={video.duration || 100}
            step="0.01"
            value={currentTime}
            onChange={handleSliderChange}
            className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#2060ff] select-none"
            style={{
              background: `linear-gradient(to right, #2060ff 0%, #2060ff ${
                (currentTime / (video.duration || 1)) * 100
              }%, rgba(255,255,255,0.05) ${(currentTime / (video.duration || 1)) * 100}%, rgba(255,255,255,0.05) 100%)`,
            }}
          />
        </div>
      </div>

      {/* Controls and Custom Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/2 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-2">
          {/* Skip buttons */}
          <button
            onClick={() => skip(-5)}
            className="p-1.5 text-white/60 hover:text-[#4d88ff] hover:bg-[#0a1540]/60 rounded transition"
            title="Rewind 5s"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Frame back button */}
          <button
            onClick={() => skip(-0.1)}
            className="p-1.5 text-white/60 hover:text-[#4d88ff] hover:bg-[#0a1540]/60 rounded font-mono text-xs transition"
            title="Prev frame (0.1s)"
          >
            -0.1s
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className={`p-2.5 rounded-lg text-white font-medium flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isPlaying 
                ? 'bg-[#0a1540] border border-white/10 hover:bg-white/10' 
                : 'bg-gradient-to-tr from-[#1a4aff] to-[#2060ff] shadow-lg shadow-brand-blue/30'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white fill-white" />}
          </button>

          {/* Frame forward button */}
          <button
            onClick={() => skip(0.1)}
            className="p-1.5 text-white/60 hover:text-[#4d88ff] hover:bg-[#0a1540]/60 rounded font-mono text-xs transition"
            title="Next frame (0.1s)"
          >
            +0.1s
          </button>

          <button
            onClick={() => skip(5)}
            className="p-1.5 text-white/60 hover:text-[#4d88ff] hover:bg-[#0a1540]/60 rounded transition"
            title="Fast forward 5s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Option and Volume elements */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={changeSpeed}
            className="bg-[#0a1540] border border-white/5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-zinc-300 hover:border-[#4d88ff]/40 transition"
            title="Adjust Playback speed"
          >
            {playbackSpeed}x
          </button>

          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="text-white/60 hover:text-white p-1 transition">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-white/5 accent-[#4d88ff] cursor-pointer rounded-lg"
            />
          </div>

          <button onClick={handleFullscreen} className="text-white/60 hover:text-white p-1 transition" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK TIMESTAMP SETTERS */}
      <div className="bg-white/2 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-white/80 font-medium">
            Timestamp Helper (targeting <strong className="text-[#4d88ff]">{activeClipName || `Clip ${activeClipIndex + 1}`}</strong>)
          </p>
          <span className="text-[10px] bg-[#1a4aff]/10 border border-[#1a4aff]/20 text-[#4d88ff] px-2 py-0.5 rounded-full font-mono font-bold">Row #{activeClipIndex + 1}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => useCurrentTime('start')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#0a1540] hover:bg-[#0d1a52] border border-white/10 hover:border-[#2060ff]/40 text-xs font-semibold text-zinc-200 hover:text-white rounded-lg transition active:scale-98 text-left"
          >
            <CornerDownRight className="w-3.5 h-3.5 text-[#2060ff] shrink-0" />
            Set as Start ({formatSeconds(currentTime)})
          </button>

          <button
            type="button"
            onClick={() => useCurrentTime('end')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#0a1540] hover:bg-[#0d1a52] border border-white/10 hover:border-[#2060ff]/40 text-xs font-semibold text-zinc-200 hover:text-white rounded-lg transition active:scale-98 text-left"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#4d88ff] shrink-0 animate-pulse" />
            Set as End ({formatSeconds(currentTime)})
          </button>
        </div>
      </div>
    </div>
  );
}
