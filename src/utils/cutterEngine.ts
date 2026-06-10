import { ProcessedClip } from '../types';
import { formatSeconds } from './time';

/**
 * Loads the FFmpeg script from the UNPKG CDN dynamically.
 */
export function loadFFmpegScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).FFmpegWasm) {
      resolve((window as any).FFmpegWasm);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/ffmpeg.js';
    script.async = true;
    script.onload = () => {
      resolve((window as any).FFmpegWasm);
    };
    script.onerror = (err) => {
      reject(new Error('Failed to load FFmpeg.wasm CDN script. Please check your network connection or try reload.'));
    };
    document.body.appendChild(script);
  });
}

interface DirectCaptureConfig {
  videoUrl: string;
  startTime: number;
  endTime: number;
  clipName: string;
  width: number;
  height: number;
  resolutionPreset?: 'original' | '1080p' | '720p';
  format?: 'mp4' | 'webm';
  onProgress: (percentage: number, currentSecs: number) => void;
}

/**
 * Pure client-side video frame capture using Canvas rendering + Web Audio + MediaRecorder.
 * Runs silently (doesn't output audio to speaker system), supports custom frame sizing,
 * and outputs high-quality WebM.
 */
export function cutVideoDirectCapture({
  videoUrl,
  startTime,
  endTime,
  clipName,
  width,
  height,
  resolutionPreset = 'original',
  format = 'mp4',
  onProgress
}: DirectCaptureConfig): Promise<Omit<ProcessedClip, 'id'>> {
  return new Promise((resolve, reject) => {
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let audioCtx: AudioContext | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let animationFrameId: number | null = null;
    let chunks: Blob[] = [];
    let isCleanedUp = false;

    // Create a timeout fail-safe of 6 minutes per clip to account for real-time uncompromised capture
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Rendering timed out. Try cutting a shorter segment or check browser frame capabilities.'));
    }, 360000);

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      clearTimeout(timeoutId);
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (video) {
        try {
          video.pause();
        } catch (e) {}
        video.onseeked = null;
        video.oncanplay = null;
        video.onloadedmetadata = null;
        video.onended = null;
        video.onerror = null;
        video.onwaiting = null;
        video.onplaying = null;
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
        video.remove();
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };

    try {
      // 1. Create HTML5 Video element and set styles for active DOM attachment
      video = document.createElement('video');
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '4px';
      video.style.height = '4px';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-99999';
      
      // Append to body immediately so the browser activates hardware-accelerated playback
      // and never throttles drawing/decoding even within isolated iframe previews
      document.body.appendChild(video);

      // Set config attributes
      video.muted = false;
      video.volume = 1.0;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      // 2. Setup rendering Canvas with configured resolution bounds
      let targetWidth = width;
      let targetHeight = height;

      // Safe limit: Support up to pristine 4K UHD Original Masters (3840px max bounds)
      const MAX_SAFE_RESOLUTION_BOUND = 3840;
      if (resolutionPreset === 'original' && (width > MAX_SAFE_RESOLUTION_BOUND || height > MAX_SAFE_RESOLUTION_BOUND)) {
        if (width >= height) {
          const scale = MAX_SAFE_RESOLUTION_BOUND / width;
          targetWidth = MAX_SAFE_RESOLUTION_BOUND;
          targetHeight = Math.round(height * scale);
        } else {
          const scale = MAX_SAFE_RESOLUTION_BOUND / height;
          targetHeight = MAX_SAFE_RESOLUTION_BOUND;
          targetWidth = Math.round(width * scale);
        }
      } else if (resolutionPreset === '1080p') {
        if (width >= height) {
          // landscape
          const scale = 1080 / height;
          targetHeight = 1080;
          targetWidth = Math.round(width * scale);
        } else {
          // portrait
          const scale = 1080 / width;
          targetWidth = 1080;
          targetHeight = Math.round(height * scale);
        }
      } else if (resolutionPreset === '720p') {
        if (width >= height) {
          const scale = 720 / height;
          targetHeight = 720;
          targetWidth = Math.round(width * scale);
        } else {
          const scale = 720 / width;
          targetWidth = 720;
          targetHeight = Math.round(height * scale);
        }
      }

      // Ensure even dimensions for stable hardware encoding compatibility
      targetWidth = targetWidth - (targetWidth % 2);
      targetHeight = targetHeight - (targetHeight % 2);

      canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        throw new Error('Could not acquire 2D canvas drawing context');
      }

      // 3. Register callbacks first before setting source properties to completely resolve any race conditions
      let hasStartedRecording = false;
      const seekRequired = startTime > 0.1;

      const startRecordingProcess = () => {
        if (hasStartedRecording || !video || !canvas || !ctx) return;
        hasStartedRecording = true;

        try {
          // Audio routing (unmuted element for high fidelity capture, but NOT routed to speakers)
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          // Set latencyHint to interactive to minimize any browser-level audio synchronization delays
          audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
          const source = audioCtx.createMediaElementSource(video);
          const destination = audioCtx.createMediaStreamDestination();
          source.connect(destination);

          // Capture both pristine canvas streams and full audio outputs
          const canvasStream = canvas.captureStream(30);
          const combinedStream = new MediaStream();

          canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
          destination.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

          let selectedMime = 'video/webm';
          const extension = format;

          if (format === 'mp4') {
            const mp4Mimes = [
              'video/mp4;codecs=avc1,mp4a',
              'video/mp4;codecs=h264,aac',
              'video/mp4'
            ];
            let foundMp4 = false;
            for (const m of mp4Mimes) {
              if (MediaRecorder.isTypeSupported(m)) {
                selectedMime = m;
                foundMp4 = true;
                break;
              }
            }
            if (!foundMp4) {
              const webmMimes = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm'
              ];
              for (const m of webmMimes) {
                if (MediaRecorder.isTypeSupported(m)) {
                  selectedMime = m;
                  break;
                }
              }
            }
          } else {
            const webmMimes = [
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp8,opus',
              'video/webm'
            ];
            for (const m of webmMimes) {
              if (MediaRecorder.isTypeSupported(m)) {
                selectedMime = m;
                break;
              }
            }
          }

          // Calculate high-fidelity bitrate based on actual target dimensions to preserve pristine quality without lagging
          const pixelCount = targetWidth * targetHeight;
          let bitrate = 8000000; // default 8 Mbps
          if (pixelCount >= 3840 * 2160) {
            bitrate = 20000000; // 20 Mbps for 4K pristine master encoding
          } else if (pixelCount >= 1920 * 1080) {
            bitrate = 12000000; // 12 Mbps for crystal clear 1080p FHD
          } else if (pixelCount >= 1280 * 720) {
            bitrate = 6000000;  // 6 Mbps for high quality 720p HD
          } else {
            bitrate = 3000000;  // 3 Mbps for lower resolutions
          }

          mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: selectedMime,
            videoBitsPerSecond: bitrate
          });

          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          mediaRecorder.onstop = () => {
            cleanup();
            const durationSecs = endTime - startTime;
            const finalBlob = new Blob(chunks, { type: selectedMime });
            const finalUrl = URL.createObjectURL(finalBlob);

            const safeName = clipName.trim().replace(/[^a-zA-Z0-9_\s-]/g, '') || 'extracted_clip';
            const finalFilename = `${safeName.replace(/\s+/g, '_')}.${extension}`;

            resolve({
              name: clipName,
              url: finalUrl,
              fileSize: finalBlob.size,
              duration: durationSecs,
              startTime,
              endTime,
              fileName: finalFilename,
              format: extension as 'webm' | 'mp4'
            });
          };

          // Wake up the audio context before recording starts to prevent initial silent buffer gap
          const initializeAudio = async () => {
            if (audioCtx && audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
          };

          initializeAudio().then(() => {
            if (isCleanedUp || !video || !mediaRecorder) return;

            // Attempt video playback at natural 1.0x unwarped velocity
            video.playbackRate = 1.0;
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(err => {
                console.warn('Playback blocked under strict autoplay policy. Retrying unmuted...', err);
                if (video) {
                  video.playbackRate = 1.0;
                  video.play().catch(e => {
                    reject(new Error('Failed to play source video track: ' + e.message));
                  });
                }
              });
            }

            // High Precision Throttled Presentation Loop to prevent monitor refresh overloading, CPU spike, and page crashes
            let lastDrawTime = 0;
            const fpsInterval = 1000 / 30; // exact 30 FPS cap
            let hasStartedMediaRecorder = false;

            const renderFrame = (nowTime?: any) => {
              if (isCleanedUp || !video || !canvas || !ctx || !mediaRecorder) return;

              // Stop condition
              if (video.currentTime >= endTime || video.ended) {
                if (mediaRecorder.state !== 'inactive') {
                  mediaRecorder.stop();
                }
                return;
              }

              // Fire next tick first to guarantee capture continuity
              let usingRVFC = false;
              if ('requestVideoFrameCallback' in video) {
                usingRVFC = true;
                (video as any).requestVideoFrameCallback(renderFrame);
              } else {
                animationFrameId = requestAnimationFrame(renderFrame);
              }

              // Throttle canvas draw loop strictly to 30 FPS bounds
              // RVFC auto-throttles to actual physical frames. Standard RAF requires manual interval throttling.
              let shouldDraw = true;
              if (!usingRVFC) {
                const now = (typeof nowTime === 'number') ? nowTime : performance.now();
                const elapsed = now - lastDrawTime;
                if (elapsed < fpsInterval) {
                  shouldDraw = false;
                } else {
                  lastDrawTime = now - (elapsed % fpsInterval);
                }
              }

              if (shouldDraw) {
                try {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                } catch (err) {}

                // CRITICAL SYNC ALIGNMENT: Only start the MediaRecorder the exact moment video frames and active audio actually begin playing
                if (!hasStartedMediaRecorder && video.currentTime >= Math.max(0, startTime - 0.1) && !video.paused && !video.seeking) {
                  hasStartedMediaRecorder = true;
                  mediaRecorder.start();
                }

                if (hasStartedMediaRecorder) {
                  // Compute active progress boundaries based on current playhead state
                  const segmentDuration = endTime - startTime;
                  const elapsedPlayback = video.currentTime - startTime;
                  const percentage = Math.min(99.9, Math.max(0, (elapsedPlayback / segmentDuration) * 100));

                  onProgress(percentage, video.currentTime);
                }
              }
            };

            // Start loop drawing
            if ('requestVideoFrameCallback' in video) {
              (video as any).requestVideoFrameCallback(renderFrame);
            } else {
              animationFrameId = requestAnimationFrame(renderFrame);
            }
          });

        } catch (e: any) {
          cleanup();
          reject(e);
        }
      };

      const triggerStart = () => {
        if (hasStartedRecording || !video) return;
        if (seekRequired) {
          video.currentTime = startTime;
        } else {
          startRecordingProcess();
        }
      };

      // Register all listener logic first before assigning the loading URL config to prevent active races
      video.onloadedmetadata = () => {
        triggerStart();
      };

      video.oncanplay = () => {
        triggerStart();
      };

      video.onseeked = () => {
        if (seekRequired) {
          startRecordingProcess();
        }
      };

      video.onended = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };

      video.onerror = (e) => {
        cleanup();
        reject(new Error('Error encountered reading source video file format or codec limitations.'));
      };

      // Set URL source at the absolute end to kickstart the load pipeline with all subscriptions active and healthy
      video.src = videoUrl;

    } catch (err: any) {
      cleanup();
      reject(err);
    }
  });
}

interface ExtractAudioConfig {
  videoUrl: string;
  startTime: number;
  endTime: number;
  clipName: string;
  onProgress: (percentage: number, currentSecs: number) => void;
}

export function extractAudioViaMediaRecorder({
  videoUrl,
  startTime,
  endTime,
  clipName,
  onProgress
}: ExtractAudioConfig): Promise<Omit<ProcessedClip, 'id'>> {
  return new Promise((resolve, reject) => {
    let video: HTMLVideoElement | null = null;
    let audioCtx: AudioContext | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let timerId: any = null;
    let chunks: Blob[] = [];
    let isCleanedUp = false;

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Audio rendering timed out.'));
    }, 180000);

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      clearTimeout(timeoutId);
      if (timerId) clearInterval(timerId);
      if (video) {
        try { video.pause(); } catch (e) {}
        video.onseeked = null;
        video.onerror = null;
        if (video.parentNode) video.parentNode.removeChild(video);
        video.remove();
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };

    try {
      video = document.createElement('video');
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '4px';
      video.style.height = '4px';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-99999';
      document.body.appendChild(video);

      video.muted = false;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      const startRecording = () => {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioCtx = new AudioContextClass();
          const source = audioCtx.createMediaElementSource(video!);
          const destination = audioCtx.createMediaStreamDestination();
          source.connect(destination);

          const formats = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac'];
          let selectedMime = 'audio/webm';
          for (const f of formats) {
            if (MediaRecorder.isTypeSupported(f)) {
              selectedMime = f;
              break;
            }
          }

          mediaRecorder = new MediaRecorder(destination.stream, {
            mimeType: selectedMime,
            audioBitsPerSecond: 320000 
          });

          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            cleanup();
            const finalBlob = new Blob(chunks, { type: selectedMime });
            const finalUrl = URL.createObjectURL(finalBlob);

            const safeName = clipName.trim().replace(/[^a-zA-Z0-9_\s-]/g, '') || 'extracted_audio';
            const finalFilename = `${safeName.replace(/\s+/g, '_')}.mp3`;

            resolve({
              name: clipName,
              url: finalUrl,
              fileSize: finalBlob.size,
              duration: endTime - startTime,
              startTime,
              endTime,
              fileName: finalFilename,
              format: 'mp3'
            });
          };

          mediaRecorder.start();
          video!.play().catch(() => {
            if (video) {
              video.muted = true;
              video.play().catch(e => reject(new Error('Failed to play audio source track: ' + e.message)));
            }
          });
          video!.playbackRate = 2.0;

          timerId = setInterval(() => {
            if (isCleanedUp || !video) return;
            if (video.currentTime >= endTime || video.ended) {
              if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
              }
              return;
            }
            const progress = ((video.currentTime - startTime) / (endTime - startTime)) * 100;
            onProgress(progress, video.currentTime);
          }, 100);

        } catch (e: any) {
          cleanup();
          reject(e);
        }
      };

      video.onseeked = () => {
        startRecording();
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('Codec error reading input audio stream.'));
      };

      video.src = videoUrl;
      video.currentTime = startTime;

    } catch (e: any) {
      cleanup();
      reject(e);
    }
  });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferArr = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(bufferArr);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + result.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * 2, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, result.length * 2, true);
  
  const length = result.length;
  let index = 44;
  for (let i = 0; i < length; i++) {
    let sample = result[i];
    if (sample > 1) sample = 1;
    else if (sample < -1) sample = -1;
    const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(index, val, true);
    index += 2;
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

export async function extractAudioPreregistered({
  videoUrl,
  startTime,
  endTime,
  clipName,
  onProgress
}: ExtractAudioConfig): Promise<Omit<ProcessedClip, 'id'>> {
  onProgress(10, startTime);
  const response = await fetch(videoUrl);
  const arrayBuffer = await response.arrayBuffer();

  onProgress(40, startTime + (endTime - startTime) * 0.3);
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    return await extractAudioViaMediaRecorder({ videoUrl, startTime, endTime, clipName, onProgress });
  }

  onProgress(75, startTime + (endTime - startTime) * 0.75);
  const sampleRate = audioBuffer.sampleRate;
  const totalDuration = audioBuffer.duration;
  
  const startSec = Math.max(0, Math.min(startTime, totalDuration));
  const endSec = Math.min(endTime, totalDuration);
  const segmentDuration = endSec - startSec;
  
  const startSample = Math.floor(startSec * sampleRate);
  const lengthSamples = Math.floor(segmentDuration * sampleRate);

  const segmentBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    lengthSamples,
    sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const segmentData = segmentBuffer.getChannelData(channel);
    for (let i = 0; i < lengthSamples; i++) {
       const origIndex = startSample + i;
       if (origIndex < originalData.length) {
         segmentData[i] = originalData[origIndex];
       } else {
         segmentData[i] = 0;
       }
    }
  }

  onProgress(90, startTime + (endTime - startTime) * 0.9);
  const wavBlob = audioBufferToWav(segmentBuffer);

  const safeName = clipName.trim().replace(/[^a-zA-Z0-9_\s-]/g, '') || 'extracted_audio';
  const finalFilename = `${safeName.replace(/\s+/g, '_')}.mp3`;
  const finalUrl = URL.createObjectURL(wavBlob);

  audioContext.close().catch(() => {});
  onProgress(100, endTime);

  return {
    name: clipName,
    url: finalUrl,
    fileSize: wavBlob.size,
    duration: segmentDuration,
    startTime: startSec,
    endTime: endSec,
    fileName: finalFilename,
    format: 'mp3'
  };
}
