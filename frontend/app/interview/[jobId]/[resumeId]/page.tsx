"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { elevenLabsService, ElevenLabsVoice } from "@/lib/elevenlab";

// Removed unused interface

interface InterviewStatus {
  question_count: number;
  max_questions: number;
  is_complete: boolean;
}

interface DeepgramTranscriptData {
  channel: {
    alternatives: Array<{
      transcript: string;
    }>;
  };
  is_final: boolean;
}

interface DeepgramConnection {
  on: (event: string, callback: (data: DeepgramTranscriptData) => void) => void;
  send: (data: ArrayBuffer) => void;
  finish: () => void;
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ jobId: string; resumeId: string }>;
}) {
  // Interview state
  const router = useRouter();
  const [jobId, setJobId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InterviewStatus>({
    question_count: 0,
    max_questions: 8,
    is_complete: false,
  });

  // Pre-interview setup state
  const [setupComplete, setSetupComplete] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [setupStep, setSetupStep] = useState<'permissions' | 'voice-selection' | 'screen-share' | 'ready'>('permissions');

  // Media streams
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<MediaStream | null>(null);

  // Voice interaction state
  const dgConnRef = useRef<DeepgramConnection | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const bufferRef = useRef("");
  
  // ElevenLabs voice state
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Proctoring state
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [proctorWarning, setProctorWarning] = useState<string | null>(null);
  const [interviewEndedByProctor, setInterviewEndedByProctor] = useState(false);
  
  // Fullscreen state
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [fullscreenWarning, setFullscreenWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  // Timer state (10 minutes)
  const TIMER_SEC = 600;
  const [timerSec, setTimerSec] = useState(TIMER_SEC);
  const [timerActive, setTimerActive] = useState(false);

  // Initialize params
  useEffect(() => {
    (async () => {
      const p = await params;
      setJobId(p.jobId);
      setResumeId(p.resumeId);
    })();
  }, [params]);

  // Load ElevenLabs voices
  useEffect(() => {
    const loadVoices = async () => {
      try {
        setVoiceLoading(true);
        const voices = await elevenLabsService.getVoices();
        setAvailableVoices(voices);
        
        // Set default interview voice
        const defaultVoice = elevenLabsService.getInterviewVoice();
        setSelectedVoice(defaultVoice);
      } catch (error) {
        console.error('Error loading voices:', error);
        // Set fallback voice
        setSelectedVoice(elevenLabsService.getInterviewVoice());
      } finally {
        setVoiceLoading(false);
      }
    };

    loadVoices();
  }, [setAvailableVoices, setSelectedVoice, setVoiceLoading]);

  // Setup media permissions
  const requestPermissions = async () => {
    try {
      // Request camera permission
      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      setVideoStream(videoStream);
      setCameraPermission('granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        // Ensure video plays
        videoRef.current.play().catch(console.error);
      }

      // Request microphone permission
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      setAudioStream(audioStream);
      setMicPermission('granted');

      setSetupStep('screen-share');
    } catch (err) {
      console.error('Permission error:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setCameraPermission('denied');
        setMicPermission('denied');
        setError("Camera and microphone access are required for the interview. Please enable permissions and refresh.");
      }
    }
  };

  // Start screen sharing
  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      setScreenStream(screenStream);
      screenShareRef.current = screenStream;
      setScreenShareActive(true);
      setSetupStep('ready');

      // Handle screen share end
      screenStream.getVideoTracks()[0].onended = () => {
        setScreenShareActive(false);
        if (setupComplete && ws) {
          ws.send(JSON.stringify({ type: "screen-share", action: "ended" }));
        }
      };
    } catch (err) {
      console.error('Screen share error:', err);
      setError("Screen sharing is required for the interview. Please allow screen sharing to continue.");
    }
  };

  // Fullscreen utility functions
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
      setError("Fullscreen mode is required for the interview. Please allow fullscreen access.");
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
  };

  const checkFullscreenStatus = () => {
    return !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement);
  };

  // Complete setup and start interview
  const completeSetup = async () => {
    if (cameraPermission === 'granted' && micPermission === 'granted' && screenShareActive) {
      // Enter fullscreen mode automatically
      await enterFullscreen();
      setSetupComplete(true);
      setTimerActive(true);
      // WebSocket will be initialized after setup is complete
    }
  };

  // Remove the fallback since we now handle the proper screen sharing flow

  // Ensure video stream is connected when entering main interview
  useEffect(() => {
    if (setupComplete && videoStream && videoRef.current) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(console.error);
    }
  }, [setupComplete, videoStream]);

  // WebSocket connection (only after setup)
  useEffect(() => {
    if (!setupComplete || !jobId || !resumeId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/api/ws/interview/${jobId}/${resumeId}`);

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      // Since we already have screen sharing active, immediately send the "started" message
      // that the backend expects to skip the screen sharing request phase
      socket.send(JSON.stringify({ 
        type: "screen-share", 
        action: "started"
      }));
    };

    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.error) {
          setError(data.error);
          return;
        }
        
        const { text, question_count, max_questions, type } = data;
        
        // Handle screen sharing flow - since we have it active, just acknowledge
        if (type === "screen_share_request") {
          console.log('Received screen share request, acknowledging...');
          // Immediately respond that screen sharing is started
          socket.send(JSON.stringify({ 
            type: "screen-share", 
            action: "started"
          }));
          return;
        }
        
        if (type === "screen_share_confirmed") {
          console.log('Screen sharing confirmed, interview starting...');
          // Don't speak this message, just wait for the first question
          return;
        }
        
        if (type === "interview_complete") {
          setStatus({
            question_count: max_questions || status.max_questions,
            max_questions: max_questions || status.max_questions,
            is_complete: true,
          });
        } else {
          setStatus({
            question_count,
            max_questions: max_questions || status.max_questions,
            is_complete: question_count >= (max_questions || status.max_questions),
          });
        }

        // Set AI response and trigger TTS (skip screen sharing messages)
        if (text && !type?.includes('screen_share')) {
          console.log('AI response received:', text);
          console.log('Question count:', question_count, 'Max questions:', max_questions);
          setAiResponse(text);
          speakText(text);
        } else {
          console.log('Message received but no text to speak:', data);
        }
        
      } catch {
        setError("Invalid response from server");
      }
    };

    socket.onclose = (ev) => {
      setIsConnected(false);
      if (ev.code !== 1000) setError("Connection lost. Please refresh.");
    };

    socket.onerror = () => setError("Connection error. Please try again.");

    setWs(socket);
    return () => {
      socket.close();
    };
  }, [setupComplete, jobId, resumeId]);

  // Voice interaction functions
  const cleanupVoice = () => {
    try { recorderRef.current?.stop(); } catch {}
    try { dgConnRef.current?.finish(); } catch {}
    recorderRef.current = null;
    dgConnRef.current = null;
    setIsListening(false);
    setCurrentTranscript("");
    bufferRef.current = "";
  };

  const startListening = async () => {
    if (!audioStream || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    cleanupVoice();
    setIsListening(true);
    setCurrentTranscript("");
    bufferRef.current = "";

    try {
      // Get fresh Deepgram token
      const tokenRes = await fetch("/api/deepgram-token");
      if (!tokenRes.ok) throw new Error(`HTTP ${tokenRes.status}`);
      
      const tokenJson = await tokenRes.json();
      if (tokenJson.error || !tokenJson.token) {
        throw new Error(tokenJson.error || "No token received");
      }

      const dgClient = createClient({ accessToken: tokenJson.token });
      
      // Create a new audio stream for recording to avoid conflicts
      const recordingStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });

      // Try different audio formats for better compatibility
      let recorder;
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      let mimeType = '';
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('Using audio format:', type);
          break;
        }
      }
      
      if (!mimeType) {
        // Fallback - try without specifying format
        console.log('Using default MediaRecorder format');
        recorder = new MediaRecorder(recordingStream);
      } else {
        recorder = new MediaRecorder(recordingStream, { mimeType });
      }
      
      recorderRef.current = recorder;

      const dgConn = dgClient.listen.live({
        model: "nova-2",
        interim_results: true,
        punctuate: true,
        smart_format: true,
      });
      dgConnRef.current = dgConn;

      dgConn.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened, starting recorder...');
        recorder.start(250);
      });

      dgConn.on(LiveTranscriptionEvents.Transcript, (data: DeepgramTranscriptData) => {
        const txt = data.channel.alternatives[0]?.transcript.trim();
        console.log('Transcript received:', { text: txt, isFinal: data.is_final });
        if (txt && data.is_final) {
          bufferRef.current += (bufferRef.current ? " " : "") + txt;
          setCurrentTranscript(bufferRef.current);
        } else if (txt) {
          setCurrentTranscript(bufferRef.current + " " + txt);
        }
      });

      recorder.addEventListener("dataavailable", async (e) => {
        if (e.data.size > 0) {
          const buf = await e.data.arrayBuffer();
          dgConn.send(buf);
        }
      });

      recorder.onstop = () => {
        console.log('MediaRecorder stopped');
        setIsListening(false);
        recordingStream.getTracks().forEach((track) => track.stop());
        try { dgConn.finish(); } catch {}
      };

    } catch (error) {
      console.error('Voice setup error:', error);
      let errorMessage = "Could not start voice recognition. ";
      
      if (error instanceof Error) {
        if (error.message.includes('No supported audio format')) {
          errorMessage += "Your browser doesn't support the required audio formats.";
        } else if (error.message.includes('MediaRecorder')) {
          errorMessage += "Audio recording is not supported in your browser.";
        } else {
          errorMessage += error.message;
        }
      }
      
      setError(errorMessage);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    const finalTranscript = bufferRef.current.trim();
    console.log('Stopping listening, final transcript:', finalTranscript);
    
    cleanupVoice();
    
    // Send the transcript to the server
    if (finalTranscript && ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending answer to server:', finalTranscript);
      ws.send(JSON.stringify({ answer: finalTranscript }));
      setCurrentTranscript("");
      bufferRef.current = "";
    } else {
      console.log('No transcript to send or WebSocket not ready');
      if (!finalTranscript) setError("No speech detected. Please try speaking again.");
    }
  };

  // Text-to-speech with ElevenLabs
  const speakText = async (text: string) => {
    if (!text.trim()) return;
    
    setIsSpeaking(true);
    
    try {
      // Try ElevenLabs first
      if (elevenLabsService.isAvailable() && selectedVoice) {
        const audioBuffer = await elevenLabsService.textToSpeech(text, selectedVoice.voice_id);
        
        if (audioBuffer) {
          await elevenLabsService.playAudio(audioBuffer);
          setIsSpeaking(false);
          return;
        }
      }
      
      // Fallback to browser speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
      
      // Final fallback to browser speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  // Fullscreen monitoring
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = checkFullscreenStatus();
      setIsFullscreen(isCurrentlyFullscreen);

      // If user exited fullscreen during interview
      if (!isCurrentlyFullscreen && setupComplete && !interviewEndedByProctor) {
        const newCount = fullscreenExitCount + 1;
        setFullscreenExitCount(newCount);
        
        // Send fullscreen violation to backend
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: "fullscreen-violation", 
            count: newCount,
            timestamp: new Date().toISOString()
          }));
        }

        if (newCount === 1) {
          setFullscreenWarning("⚠️ Warning: Fullscreen mode is required. Please return to fullscreen. 1 chance left!");
          setShowFullscreenPrompt(true);
          // Auto re-enter fullscreen after a short delay
          setTimeout(() => {
            enterFullscreen();
          }, 3000);
        } else if (newCount >= 2) {
          // End interview after second violation
          setFullscreenWarning("Interview ended: Multiple fullscreen violations detected.");
          setInterviewEndedByProctor(true);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              answer: "end interview", 
              reason: "fullscreen_violations",
              violation_count: newCount
            }));
          }
        }
      }
    };

    // Add event listeners for different browsers
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [setupComplete, fullscreenExitCount, ws, interviewEndedByProctor]);

  // Proctoring
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && setupComplete) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tab-switch", count: newCount }));
        }
        if (newCount === 1) setProctorWarning("⚠️ Warning: You left the tab. 2 chances left!");
        if (newCount === 2) setProctorWarning("⚠️ Last warning: Next tab switch will end your interview!");
        if (newCount >= 3) {
          ws?.send(JSON.stringify({ answer: "end interview" }));
          setError("Interview ended: Too many tab switches.");
          setInterviewEndedByProctor(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [ws, tabSwitchCount, setupComplete, setTabSwitchCount, setProctorWarning, setError, setInterviewEndedByProctor]);

  // Timer
  useEffect(() => {
    if (!timerActive || status.is_complete || interviewEndedByProctor) return;
    if (timerSec <= 0) {
      setTimerActive(false);
      ws?.send(JSON.stringify({ answer: "end interview" }));
      setError("Interview ended: Time limit reached.");
      setInterviewEndedByProctor(true);
      return;
    }
    const timer = setTimeout(() => setTimerSec(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [timerSec, timerActive, status.is_complete, interviewEndedByProctor, ws]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupVoice();
      videoStream?.getTracks().forEach(track => track.stop());
      audioStream?.getTracks().forEach(track => track.stop());
      screenStream?.getTracks().forEach(track => track.stop());
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // Exit fullscreen if still active
      if (checkFullscreenStatus()) {
        exitFullscreen();
      }
      ws?.close();
    };
  }, [videoStream, audioStream, screenStream, ws]);

  // Auto-redirect when interview ends
  useEffect(() => {
    if (status.is_complete || interviewEndedByProctor) {
      const timer = setTimeout(() => {
        router.replace('/interview/over');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status.is_complete, interviewEndedByProctor, router]);

  const timerDisplay = `${String(Math.floor(timerSec / 60)).padStart(2, "0")}:${String(timerSec % 60).padStart(2, "0")}`;
  const progress = (status.question_count / status.max_questions) * 100;

  // Pre-interview setup screen
  if (!setupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Interview Setup</h1>
            <p className="text-blue-100 text-lg">Let&apos;s prepare for your AI interview</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6">
              <p className="text-red-100 text-center">{error}</p>
            </div>
          )}

          {setupStep === 'permissions' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Camera & Microphone Access</h2>
                <p className="text-blue-100">We need access to your camera and microphone for the interview</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className={`p-4 rounded-xl border-2 ${cameraPermission === 'granted' ? 'border-green-400 bg-green-400/20' : 'border-blue-400 bg-blue-400/20'}`}>
                  <div className="flex items-center space-x-3">
                    <svg className={`w-6 h-6 ${cameraPermission === 'granted' ? 'text-green-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-white font-medium">Camera</p>
                      <p className={`text-sm ${cameraPermission === 'granted' ? 'text-green-300' : 'text-blue-300'}`}>
                        {cameraPermission === 'granted' ? 'Connected' : 'Required'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-xl border-2 ${micPermission === 'granted' ? 'border-green-400 bg-green-400/20' : 'border-blue-400 bg-blue-400/20'}`}>
                  <div className="flex items-center space-x-3">
                    <svg className={`w-6 h-6 ${micPermission === 'granted' ? 'text-green-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <div>
                      <p className="text-white font-medium">Microphone</p>
                      <p className={`text-sm ${micPermission === 'granted' ? 'text-green-300' : 'text-blue-300'}`}>
                        {micPermission === 'granted' ? 'Connected' : 'Required'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {videoStream && (
                <div className="mb-6">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-w-md mx-auto rounded-xl border-2 border-white/30"
                  />
                </div>
              )}

              <button
                onClick={requestPermissions}
                disabled={cameraPermission === 'granted' && micPermission === 'granted'}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cameraPermission === 'granted' && micPermission === 'granted' ? 'Permissions Granted' : 'Allow Camera & Microphone'}
              </button>
              
              {cameraPermission === 'granted' && micPermission === 'granted' && (
                <button
                  onClick={() => setSetupStep('voice-selection')}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200"
                >
                  Continue to Voice Selection
                </button>
              )}
            </div>
          )}

          {setupStep === 'voice-selection' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Choose Your AI Interviewer Voice</h2>
                <p className="text-blue-100">Select a voice for your AI interviewer</p>
              </div>
              
              {voiceLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-blue-100">Loading available voices...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableVoices.map((voice) => (
                    <div
                      key={voice.voice_id}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        selectedVoice?.voice_id === voice.voice_id
                          ? 'border-purple-400 bg-purple-400/20'
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedVoice(voice)}
                        >
                          <h3 className="text-white font-semibold">{voice.name}</h3>
                          <p className="text-blue-200 text-sm">{voice.category}</p>
                          {voice.description && (
                            <p className="text-blue-100 text-xs mt-1">{voice.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectedVoice?.voice_id === voice.voice_id && (
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <button
                            onClick={async () => {
                              try {
                                // Temporarily set this voice and test it
                                const originalVoice = selectedVoice;
                                setSelectedVoice(voice);
                                
                                // Small delay to ensure voice is set
                                setTimeout(async () => {
                                  await speakText("Hello! This is a test of my voice. How do I sound?");
                                  // Restore original selection
                                  setSelectedVoice(originalVoice);
                                }, 100);
                              } catch (error) {
                                console.error('Error testing voice:', error);
                              }
                            }}
                            className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                            title="Test this voice"
                          >
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {!elevenLabsService.isAvailable() && (
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4">
                      <p className="text-yellow-100 text-sm text-center">
                        ElevenLabs API key not configured. Using browser speech synthesis as fallback.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={() => setSetupStep('screen-share')}
                disabled={!selectedVoice}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Screen Sharing
              </button>
            </div>
          )}

          {setupStep === 'screen-share' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Screen Sharing</h2>
                <p className="text-blue-100">Please share your screen for proctoring purposes</p>
              </div>
              
              <div className={`p-6 rounded-xl border-2 ${screenShareActive ? 'border-green-400 bg-green-400/20' : 'border-orange-400 bg-orange-400/20'}`}>
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <svg className={`w-8 h-8 ${screenShareActive ? 'text-green-400' : 'text-orange-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-white font-medium">Screen Sharing</p>
                    <p className={`text-sm ${screenShareActive ? 'text-green-300' : 'text-orange-300'}`}>
                      {screenShareActive ? 'Active' : 'Required for interview'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={startScreenShare}
                disabled={screenShareActive}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {screenShareActive ? 'Screen Sharing Active' : 'Start Screen Share'}
              </button>
            </div>
          )}

          {setupStep === 'ready' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Ready to Begin</h2>
                <p className="text-blue-100">All requirements met. Click below to start your interview.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl border-2 border-green-400 bg-green-400/20">
                  <div className="text-center">
                    <svg className="w-6 h-6 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-300 text-sm font-medium">Camera</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl border-2 border-green-400 bg-green-400/20">
                  <div className="text-center">
                    <svg className="w-6 h-6 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-300 text-sm font-medium">Microphone</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-xl border-2 border-green-400 bg-green-400/20">
                  <div className="text-center">
                    <svg className="w-6 h-6 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-300 text-sm font-medium">Screen Share</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl border-2 border-purple-400 bg-purple-400/20">
                  <div className="text-center">
                    <svg className="w-6 h-6 text-purple-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <p className="text-purple-300 text-sm font-medium">AI Voice</p>
                    <p className="text-purple-200 text-xs">{selectedVoice?.name || 'Default'}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={completeSetup}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200"
              >
                Start Interview
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main interview interface (Meet-like)
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Main video area */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Video overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
      </div>

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">Live Interview</span>
              </div>
            </div>
            
            <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path stroke="currentColor" strokeWidth="2" d="M12 6v6l4 2"/>
                </svg>
                <span className={`text-sm font-mono ${timerSec < 60 ? 'text-red-400' : 'text-white'}`}>
                  {timerDisplay}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
              <div className="flex items-center space-x-2">
                <div className="w-full bg-white/20 rounded-full h-2 min-w-[100px]">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-white text-sm">{status.question_count}/{status.max_questions}</span>
              </div>
            </div>
            
            <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-purple-400/30">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-purple-300 text-sm font-medium">{selectedVoice?.name || 'Default'}</span>
              </div>
            </div>

            {tabSwitchCount > 0 && (
              <div className="bg-red-500/80 backdrop-blur-md rounded-full px-4 py-2 border border-red-400/50">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white text-sm font-medium">{tabSwitchCount} Warning{tabSwitchCount > 1 ? 's' : ''}</span>
                </div>
              </div>
            )}

            {fullscreenExitCount > 0 && (
              <div className="bg-orange-500/80 backdrop-blur-md rounded-full px-4 py-2 border border-orange-400/50">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span className="text-white text-sm font-medium">Fullscreen: {fullscreenExitCount} Warning{fullscreenExitCount > 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voice interaction status */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        {/* Waiting for AI to start */}
        {isConnected && !isSpeaking && !isListening && !aiResponse && (
          <div className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-8 border border-blue-400/30">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg font-medium">Starting Interview...</p>
              <p className="text-blue-200 text-sm mt-2">AI interviewer is preparing your first question</p>
            </div>
          </div>
        )}

        {isSpeaking && (
          <div className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-8 border border-blue-400/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L6.09 15H4a1 1 0 01-1-1V6a1 1 0 011-1h2.09l2.293-1.82a1 1 0 011.617.82zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-white text-lg font-medium">AI is speaking...</p>
              <p className="text-blue-200 text-sm mt-2">Please listen carefully</p>
            </div>
          </div>
        )}
        
        {isListening && (
          <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-8 border border-red-400/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="flex space-x-1">
                  <div className="w-1 h-8 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-6 bg-white rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1 h-10 bg-white rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                  <div className="w-1 h-7 bg-white rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
              <p className="text-white text-lg font-medium">Listening...</p>
              {currentTranscript && (
                <p className="text-red-200 text-sm mt-2 max-w-md">{currentTranscript}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30">
        <div className="bg-black/80 backdrop-blur-lg rounded-full p-4 border border-white/20">
          <div className="flex items-center space-x-4">
            {/* Microphone button */}
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!isConnected || isSpeaking || status.is_complete || interviewEndedByProctor}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.00z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Screen share status */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              screenShareActive ? 'bg-green-500' : 'bg-gray-500'
            }`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            {/* End interview button */}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to end the interview?')) {
                  ws?.send(JSON.stringify({ answer: "end interview" }));
                }
              }}
              disabled={!isConnected || status.is_complete || interviewEndedByProctor}
              className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error/Warning overlay */}
      {(error || proctorWarning || fullscreenWarning) && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-40 max-w-md">
          <div className={`backdrop-blur-lg rounded-xl p-4 border ${
            fullscreenWarning && !error && !proctorWarning 
              ? 'bg-orange-500/90 border-orange-400/50' 
              : 'bg-red-500/90 border-red-400/50'
          }`}>
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-white flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                {proctorWarning && <p className="text-white font-medium">{proctorWarning}</p>}
                {fullscreenWarning && <p className="text-white font-medium">{fullscreenWarning}</p>}
                {error && <p className="text-white">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen prompt overlay */}
      {showFullscreenPrompt && fullscreenExitCount === 1 && !interviewEndedByProctor && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-orange-500/20 backdrop-blur-lg rounded-3xl p-8 border border-orange-400/30 max-w-lg mx-4 text-center">
            <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-orange-400 mb-4">
              Fullscreen Required
            </h2>
            
            <p className="text-white text-lg mb-6">
              The interview must be conducted in fullscreen mode for security purposes.
            </p>
            
            <p className="text-orange-200 mb-8">
              <strong>Warning:</strong> This is your first violation. One more exit from fullscreen will end your interview.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={async () => {
                  await enterFullscreen();
                  setShowFullscreenPrompt(false);
                  setFullscreenWarning(null);
                }}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200"
              >
                Return to Fullscreen
              </button>
              
              <p className="text-orange-200 text-sm">
                Returning to fullscreen automatically in 3 seconds...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interview complete overlay */}
      {(status.is_complete || interviewEndedByProctor) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 max-w-2xl mx-4 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              interviewEndedByProctor ? 'bg-red-500' : 'bg-green-500'
            }`}>
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                {interviewEndedByProctor ? (
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                )}
              </svg>
            </div>
            
            <h2 className={`text-3xl font-bold mb-4 ${
              interviewEndedByProctor ? 'text-red-400' : 'text-green-400'
            }`}>
              {interviewEndedByProctor ? 'Interview Terminated' : 'Interview Complete!'}
            </h2>
            
            <p className="text-white text-lg mb-8">
              {interviewEndedByProctor
                ? "Your session was ended due to policy violations. Please contact support if needed."
                : "Thank you for completing the interview. We'll be in touch with next steps soon."}
            </p>
            
            <p className="text-blue-200">Redirecting to dashboard in a few seconds...</p>
          </div>
        </div>
      )}
    </div>
  );
}