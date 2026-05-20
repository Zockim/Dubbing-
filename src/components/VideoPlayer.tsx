import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, 
  MonitorPlay, Menu, MoreVertical, Lock, Headphones, ChevronRight, 
  Camera, RotateCcw, RotateCw, SkipBack, SkipForward, PictureInPicture2,
  Subtitles, Music
} from 'lucide-react';
import { Subtitle } from '../lib/srtParser';

interface VideoPlayerProps {
  videoUrl: string;
  videoName: string;
  subtitles: Subtitle[];
  ttsEnabled: boolean;
  subtitlesEnabled: boolean;
  selectedVoice: string;
  browserVoices: SpeechSynthesisVoice[];
  isAudioMode?: boolean;
  onToggleTts: () => void;
  onToggleSubtitles: () => void;
}

export default function VideoPlayer({
  videoUrl,
  videoName,
  subtitles,
  ttsEnabled,
  subtitlesEnabled,
  selectedVoice,
  browserVoices,
  isAudioMode = false,
  onToggleTts,
  onToggleSubtitles,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState<Subtitle | null>(null);
  const [playingSubtitleId, setPlayingSubtitleId] = useState<number | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [originalVolume, setOriginalVolume] = useState(20);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoError, setVideoError] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.muted = true;
      } else if (ttsEnabled) {
        videoRef.current.muted = originalVolume === 0;
        videoRef.current.volume = originalVolume / 100;
      } else {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
      }
    }
  }, [ttsEnabled, originalVolume, isMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    // When selectedVoice changes, cancel current speech and immediately play with new voice
    window.speechSynthesis.cancel();
    if (isPlaying && ttsEnabled && activeSubtitle) {
      playTtsForSubtitle(activeSubtitle, true);
    }
  }, [selectedVoice]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setControlsVisible(false);
    }
  };

  const unlockAudio = () => {
    if (!audioUnlocked) {
      const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      silentAudio.play().then(() => {
        silentAudio.pause();
        setAudioUnlocked(true);
      }).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    const currentSub = subtitles.find(sub => time >= sub.startTime && time <= sub.endTime);
    setActiveSubtitle(currentSub || null);

    if (ttsEnabled && currentSub && playingSubtitleId !== currentSub.id) {
      playTtsForSubtitle(currentSub);
    }
  };

  const playTtsForSubtitle = (subtitle: Subtitle, forceReplay = false) => {
    if (!forceReplay && playingSubtitleId === subtitle.id) return;
    
    setPlayingSubtitleId(subtitle.id);
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(subtitle.spokenText);
    if (selectedVoice) {
      // Use browserVoices passed from App which is stable, fallback if empty
      const voicesToSearch = browserVoices.length > 0 ? browserVoices : window.speechSynthesis.getVoices();
      const voice = voicesToSearch.find(v => v.voiceURI === selectedVoice);
      if (voice) utterance.voice = voice;
    }

    const estimatedDuration = subtitle.spokenText.length / 15;
    const subtitleDuration = subtitle.endTime - subtitle.startTime;
    
    let targetRate = 1.0;
    if (estimatedDuration > subtitleDuration) {
      targetRate = Math.min(estimatedDuration / subtitleDuration, 2.0);
    }
    
    // Scale rate by player speed
    utterance.rate = targetRate * playbackRate;

    window.speechSynthesis.speak(utterance);
  };

  const togglePlay = () => {
    unlockAudio();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        window.speechSynthesis.pause();
      } else {
        videoRef.current.play();
        if (ttsEnabled && activeSubtitle && playingSubtitleId === activeSubtitle.id) {
          window.speechSynthesis.resume();
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current && !isNaN(time)) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setPlayingSubtitleId(null);
      window.speechSynthesis.cancel();
    }
  };

  const handleRelativeSeek = (seconds: number) => {
    if (videoRef.current && !isNaN(duration)) {
      let newTime = videoRef.current.currentTime + seconds;
      newTime = Math.max(0, Math.min(newTime, duration || 0));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setPlayingSubtitleId(null);
      window.speechSynthesis.cancel();
    }
  };

  const cycleSpeed = () => {
    setPlaybackRate(r => r >= 2 ? 0.5 : r + 0.25);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          await (containerRef.current as any)?.webkitRequestFullscreen();
        } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
          await (videoRef.current as any)?.webkitEnterFullscreen();
        }

        // Try locking orientation to landscape for mobile if supported
        const orientation = window.screen?.orientation as any;
        if (orientation && orientation.lock) {
          try {
            await orientation.lock('landscape');
          } catch (e) {
            console.warn("Orientation lock not supported/allowed", e);
          }
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }

        const orientation = window.screen?.orientation as any;
        if (orientation && orientation.unlock) {
          orientation.unlock();
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const min = Math.floor(timeInSeconds / 60);
    const m = min.toString().padStart(min >= 100 ? 3 : 2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full bg-black flex items-center justify-center font-sans tracking-wide overflow-hidden select-none group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => { if (!controlsVisible) setControlsVisible(true); }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className={`w-full h-full object-contain cursor-pointer transition-opacity duration-500 ${videoError || isAudioMode ? 'opacity-0' : 'opacity-100'}`}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          setVideoError(null);
          setDuration(videoRef.current?.duration || 0);
        }}
        onError={(e) => {
          console.error("Video Playback Error:", e);
          setVideoError("Format not natively supported by your browser");
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        playsInline
      />

      {/* Audio Mode Overlay */}
      {isAudioMode && !videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] pointer-events-none z-0">
           <div className={`p-10 rounded-full bg-white/5 border border-white/10 shadow-2xl transition-all duration-[2000ms] ease-out ${isPlaying ? 'scale-110 shadow-red-500/20' : 'scale-100'}`}>
              <Music size={80} className={`transition-colors duration-[2000ms] ${isPlaying ? 'text-red-500' : 'text-white/20'}`} />
           </div>
           <div className="mt-8 flex flex-col items-center opacity-80">
              <p className="text-white font-medium text-lg tracking-wide max-w-md truncate px-4">{videoName}</p>
              <p className="text-white/40 tracking-widest text-[10px] font-bold uppercase mt-3 py-1 px-3 border border-white/10 rounded-full bg-white/5">Audio Playback Mode</p>
           </div>
        </div>
      )}

      {/* Error Overlay */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-8 text-center z-30">
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <MonitorPlay size={48} className="text-white/20" />
            <h3 className="text-white font-semibold text-lg">Playback Error</h3>
            <p className="text-white/50 text-sm">{videoError}</p>
            <p className="text-white/30 text-xs mt-2">
              Try converting the file to MP4/WebM, or use a Chromium-based browser which natively supports more codecs.
            </p>
          </div>
        </div>
      )}

      {/* Subtitles Overlay */}
      {subtitlesEnabled && activeSubtitle && (
        <div className={`absolute left-0 right-0 flex justify-center pointer-events-none px-4 md:px-16 z-10 transition-transform duration-300 transform ${controlsVisible ? (isFullscreen ? '-translate-y-32' : '-translate-y-28') : '-translate-y-8'} bottom-0`}>
          <span className="bg-black/60 text-white px-3 py-1 rounded inline-block text-base md:text-lg font-medium text-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] max-w-4xl leading-snug">
            {activeSubtitle.text}
          </span>
        </div>
      )}

      {/* HUD Overlay */}
      <div className={`absolute inset-0 transition-opacity duration-300 flex flex-col justify-between z-20 pointer-events-none ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* TOP BAR - Minimalist */}
        <div className="flex items-center justify-between px-6 py-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
          <div className="flex items-center gap-4">
            {/* Minimal top bar - no filename as requested for Netflix style, just clean space or a subtle back button if needed */}
          </div>
          <div className="flex items-center gap-6 text-white/90">
            <button 
              onClick={onToggleSubtitles} 
              className={`transition hover:scale-110 drop-shadow-md ${subtitlesEnabled ? 'text-white' : 'text-white/50'}`}
              title="Toggle Captions"
            >
              <Subtitles size={24} />
            </button>
            <button 
              onClick={() => { unlockAudio(); onToggleTts(); }} 
              className={`transition hover:scale-110 drop-shadow-md ${ttsEnabled ? 'text-white' : 'text-white/50'}`}
              title={ttsEnabled ? "Disable TTS Dub" : "Enable TTS Dub"}
            >
              <Headphones size={24} />
            </button>
          </div>
        </div>

        {/* Play/Pause Large Center Play Button for minimal interaction */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           {!isPlaying && controlsVisible && (
              <button 
                onClick={togglePlay} 
                className="w-20 h-20 bg-black/40 hover:bg-black/60 hover:scale-110 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all pointer-events-auto border border-white/20"
              >
                <Play fill="currentColor" size={36} className="ml-2" />
              </button>
           )}
        </div>

        {/* BOTTOM BAR - Netflix/Minimalist Style */}
        <div className="flex flex-col px-6 pt-16 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent gap-2 pointer-events-auto">
          
          {/* Scrubber */}
          <div className="w-full relative flex items-center h-6 cursor-pointer group/slider" onClick={(e) => {
             // Let the range input handle clicks, this provides a larger click target area
          }}>
            <input
              type="range"
              min={0}
              max={duration && !isNaN(duration) ? duration : 100}
              value={currentTime && !isNaN(currentTime) ? currentTime : 0}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden transition-all group-hover/slider:h-2">
              <div 
                className="h-full bg-red-600 transition-all"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
            <div 
              className="absolute h-4 w-4 bg-red-600 rounded-full shadow pointer-events-none -ml-2 opacity-0 group-hover/slider:opacity-100 transition-opacity"
              style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>

          {/* Lower Controls */}
          <div className="flex items-center justify-between mt-2">
            
            {/* Left Controls */}
            <div className="flex items-center gap-6 text-white">
              <button onClick={togglePlay} className="hover:text-gray-300 transition-colors">
                {isPlaying ? <Pause fill="currentColor" size={28} /> : <Play fill="currentColor" size={28} />}
              </button>
              
              <button onClick={() => handleRelativeSeek(-10)} className="hover:text-gray-300 transition-colors relative">
                <RotateCcw size={24} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-1">10</span>
              </button>
              
              <button onClick={() => handleRelativeSeek(10)} className="hover:text-gray-300 transition-colors relative">
                <RotateCw size={24} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-1">10</span>
              </button>

              <div className="group/vol relative flex items-center gap-2">
                <button onClick={() => setIsMuted(!isMuted)} className="hover:text-gray-300 transition-colors relative z-10">
                  {isMuted || originalVolume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 ease-out flex items-center">
                   <input 
                     type="range" min="0" max="100" value={isMuted ? 0 : originalVolume}
                     onChange={(e) => {
                       const val = parseInt(e.target.value);
                       setOriginalVolume(val);
                       if (val > 0) setIsMuted(false);
                     }}
                     className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer"
                     style={{ accentColor: '#ffffff' }}
                     title="Original Audio Volume"
                   />
                </div>
              </div>

              <div className="text-white/90 text-sm font-medium tabular-nums ml-2">
                {formatTime(currentTime)} <span className="text-white/40 mx-1">/</span> {formatTime(duration)}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-6 text-white">
              <button onClick={cycleSpeed} className="hover:text-gray-300 transition-colors font-medium text-sm w-10 text-center tracking-tighter">
                {playbackRate}x
              </button>
              <button onClick={togglePiP} className="hover:text-gray-300 transition-colors" title="Picture in Picture">
                <PictureInPicture2 size={24} />
              </button>
              <button onClick={toggleFullscreen} className="hover:text-gray-300 transition-colors" title="Fullscreen">
                <Maximize size={24} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
