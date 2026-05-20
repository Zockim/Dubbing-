import React, { useState, useEffect } from 'react';
import { FileVideo, FileText, Volume2, Settings2, Music } from 'lucide-react';
import { parseSrt, Subtitle } from './lib/srtParser';
import VideoPlayer from './components/VideoPlayer';

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAudioMode, setIsAudioMode] = useState<boolean>(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isConfigOpen, setIsConfigOpen] = useState(true);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setBrowserVoices(voices);
      
      setSelectedVoice(prev => {
        if (!prev && voices.length > 0) {
          const enVoices = voices.filter(v => v.lang.startsWith('en'));
          return enVoices.length > 0 ? enVoices[0].voiceURI : voices[0].voiceURI;
        }
        return prev;
      });
    };
    
    // Initial load
    loadVoices();
    
    // Handle async voice loading
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's explicitly an audio file
      setIsAudioMode(file.type.startsWith('audio/') || !!file.name.match(/\.(mp3|wav|m4a|ogg|aac|flac)$/i));
      setVideoUrl(URL.createObjectURL(file));
      setIsConfigOpen(false);
    }
  };

  const handleSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setSubtitles(parseSrt(text));
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-gray-200 font-sans selection:bg-white/30 flex flex-col">
      <header className="h-[50px] px-6 flex items-center justify-between border-b border-white/5 shrink-0 bg-black z-50">
        <div className="font-bold tracking-wide text-lg text-white">VoxSync</div>
        <div className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-1 rounded text-white/60">
          Browser TTS
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 gap-6">
        <div className="w-full aspect-video bg-[#050505] rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/5 relative z-10">
          {videoUrl ? (
            <VideoPlayer
              videoUrl={videoUrl}
              videoName="Media playback"
              subtitles={subtitles}
              ttsEnabled={ttsEnabled}
              subtitlesEnabled={subtitlesEnabled}
              selectedVoice={selectedVoice}
              browserVoices={browserVoices}
              isAudioMode={isAudioMode}
              onToggleTts={() => setTtsEnabled(!ttsEnabled)}
              onToggleSubtitles={() => setSubtitlesEnabled(!subtitlesEnabled)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-4">
              <div className="flex items-center gap-2 opacity-30">
                <FileVideo size={48} strokeWidth={1} />
                <Music size={48} strokeWidth={1} />
              </div>
              <p className="text-base font-medium">Upload a video or audio file to begin</p>
            </div>
          )}
        </div>

        <div className="w-full max-w-5xl">
          {videoUrl && (
            <button 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="mx-auto flex items-center justify-center gap-2 text-xs font-semibold text-white/50 hover:text-white transition px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full"
            >
              <Settings2 size={16} />
              {isConfigOpen ? "Hide Settings" : "Upload & Configuration"}
            </button>
          )}

          <div
            className={`transition-all duration-500 origin-top overflow-hidden mt-4 ${
              isConfigOpen || !videoUrl ? 'opacity-100 scale-y-100 max-h-[800px]' : 'opacity-0 scale-y-95 max-h-0'
            }`}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <label className="flex flex-col gap-2 p-5 bg-[#111] rounded-xl cursor-pointer hover:bg-[#1a1a1a] transition-colors border border-white/5">
                <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                  <FileVideo size={16} className="text-white/70" /> 1. Upload Media
                </div>
                <p className="text-[11px] text-white/40">Video or Audio automatically detected</p>
                <input type="file" accept="video/*,audio/*,.mkv,.avi,.mov,.flv,.wmv,.ts,.mp3,.wav,.m4a,.aac,.ogg" className="hidden" onChange={handleVideoUpload} />
              </label>

              <label className="flex flex-col gap-2 p-5 bg-[#111] rounded-xl cursor-pointer hover:bg-[#1a1a1a] transition-colors border border-white/5">
                <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                  <FileText size={16} className="text-white/70" /> 2. Upload Subtitles
                </div>
                <p className="text-[11px] text-white/40">Used for dubbing timing</p>
                <input type="file" accept=".srt" className="hidden" onChange={handleSrtUpload} />
              </label>

              <div className="flex flex-col gap-2 p-5 bg-[#111] rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                  <Volume2 size={16} className="text-white/70" /> 3. Narrator Voice
                </div>
                {browserVoices.length > 0 ? (
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 text-white/90 text-xs rounded-lg p-2 outline-none focus:border-white/40 transition-colors"
                  >
                    {browserVoices.map((v, index) => (
                      <option key={`${v.voiceURI}-${index}`} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-white/40">Loading voices...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
