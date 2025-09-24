"use client";
import React, { useState, useEffect, useRef } from "react";
import { useProctoring } from "@/hooks/useProctoring";
import { VideoPanel } from "@/components/ui/interview/videopanel";

interface Message {
  sender: "ai" | "you";
  text: string;
  timestamp?: Date;
}

interface InterviewStatus {
  question_count: number;
  max_questions: number;
  is_complete: boolean;
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ jobId: string; resumeId: string }>;
}) {
  // ─── Interview State ────────────────────────────────────────────────
  const [jobId, setJobId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InterviewStatus>({
    question_count: 0,
    max_questions: 8,
    is_complete: false,
  });

  // ─── Proctoring / Video Setup ───────────────────────────────────────
  const {
    camStream,
    screenStream,
    camRef,
    screenRef,
    videoDevices,
    audioDevices,
    selectedVideoDeviceId,
    selectedAudioDeviceId,
    setSelectedVideoDeviceId,
    setSelectedAudioDeviceId,
    startCam,
    startScreen,
    calibration,
  } = useProctoring(ws);
  type MySpeechRecognitionErrorEvent = {
    error: string;
    message?: string;
  };
  // ─── Text-to-Speech Utility ─────────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    setIsSpeaking(true);
    const segments = text.split(/([.?!]\s+)/).filter(Boolean);
    let idx = 0;
    const speakNext = () => {
      if (idx >= segments.length) {
        setIsSpeaking(false);
        return;
      }
      const ut = new SpeechSynthesisUtterance(segments[idx++]);
      ut.onend = speakNext;
      window.speechSynthesis.speak(ut);
    };
    speakNext();
  };

  // ─── Voice-Input State & Refs ───────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const isVoiceModeRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
  }, [isVoiceMode]);

 // ─── Initialize SpeechRecognition ──────────────────────────────────
useEffect(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setVoiceError("SpeechRecognition not supported in this browser");
    return;
  }

  const recognition: SpeechRecognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    setIsListening(true);
    setVoiceError(null);
  };

  recognition.onresult = (e: SpeechRecognitionEvent) => {
    let interim = "";
    let finalT = "";
  
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalT += t;
      } else {
        interim += t;
      }
    }
  
    if (finalT) {
      setFinalTranscript(prev => prev + finalT);
    }
    setInterimTranscript(interim);
  
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flushVoice();
      recognition.stop();
    }, 2000);
  };
  

  recognition.onerror = (evt:MySpeechRecognitionErrorEvent) => {
    let msg: string;
    switch (evt.error) {
      case "no-speech":
        msg = "No speech detected. Try again.";
        break;
      case "not-allowed":
        msg = "Microphone access was denied.";
        break;
      case "audio-capture":
        msg = "No microphone found or permission denied.";
        break;
      default:
        msg = `Voice error: ${evt.error}`;
    }
    setVoiceError(msg);
    setIsListening(false);
  };

  recognition.onend = () => {
    setIsListening(false);
    if (isVoiceModeRef.current && !isListeningRef.current) {
      recognition.start();
    }
  };

  recognitionRef.current = recognition;
  setVoiceReady(true);
}, []);


  // ─── Voice-Input Helpers ───────────────────────────────────────────
  const flushVoice = () => {
    const text = finalTranscript.trim();
    if (text && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ answer: text }));
      setMessages((ms) => [...ms, { sender: "you", text, timestamp: new Date() }]);
    }
    setFinalTranscript("");
    setInterimTranscript("");
  };
// ─── Trigger SpeechRecognition on user click ───────────────────────
const startVoice = () => {
  const rec = recognitionRef.current;
  if (!rec) {
    setVoiceError("Recognition not ready");
    return;
  }
  if (isListeningRef.current) return;

  try {
    rec.start();    // ← browser will now prompt "Allow this site to use your microphone?"
  } catch (err: unknown) {
    setVoiceError(`Could not start voice recognition`);
    console.log(err)
  }
};

  const stopVoice = () => {
    const rec = recognitionRef.current;
    if (rec && isListeningRef.current) rec.stop();
    setIsVoiceMode(false);
    isVoiceModeRef.current = false;
    setIsListening(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setFinalTranscript("");
    setInterimTranscript("");
  };

  // ─── Send Text Answer ───────────────────────────────────────────────
  const sendAnswer = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !input.trim() || isLoading)
      return;
    setIsLoading(true);
    setError(null);
    ws.send(JSON.stringify({ answer: input.trim() }));
    setMessages((ms) => [
      ...ms,
      { sender: "you", text: input.trim(), timestamp: new Date() },
    ]);
    setInput("");
  };

  // ─── WebSocket & Interview Lifecycle ───────────────────────────────
  useEffect(() => {
    (async () => {
      const p = await params;
      setJobId(p.jobId);
      setResumeId(p.resumeId);
    })();
  }, [params]);

  useEffect(() => {
    if (!jobId || !resumeId || !screenStream) return;
    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/ws/interview/${jobId}/${resumeId}`
    );
    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
    };
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.error) {
          setError(data.error);
          setIsLoading(false);
          return;
        }
        const { text, question_count, max_questions } = data;
        setStatus({
          question_count,
          max_questions: max_questions || status.max_questions,
          is_complete:
            question_count >= (max_questions || status.max_questions),
        });
        setMessages((ms) => [
          ...ms,
          { sender: "ai", text, timestamp: new Date() },
        ]);
        setIsLoading(false);
      } catch {
        setError("Invalid response from server");
        setIsLoading(false);
      }
    };
    socket.onclose = (ev) => {
      setIsConnected(false);
      if (ev.code !== 1000) setError("Connection lost. Please refresh.");
    };
    socket.onerror = () => setError("Connection error. Please try again.");
    setWs(socket);
    return () => socket.close();
  }, [jobId, resumeId, screenStream]);

  // ─── Auto-scroll & Cleanup ──────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recognitionRef.current && isListeningRef.current)
        recognitionRef.current.stop();
    };
  }, []);

  // ─── Device Selection UI ────────────────────────────────────────────
  if (!selectedVideoDeviceId || !selectedAudioDeviceId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Setup Your Devices</h2>
          {/* Camera & Microphone selectors */}
          <select
            value={selectedVideoDeviceId || ""}
            onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
            className="w-full mb-4 p-3 border rounded"
          >
            <option value="" disabled>Select camera</option>
            {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
          </select>
          <select
            value={selectedAudioDeviceId || ""}
            onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
            className="w-full mb-4 p-3 border rounded"
          >
            <option value="" disabled>Select microphone</option>
            {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
          </select>
          <button
            onClick={startCam}
            disabled={!selectedVideoDeviceId || !selectedAudioDeviceId}
            className="w-full p-3 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Start Camera & Microphone
          </button>
        </div>
      </div>
    );
  }

  // ─── Calibration UI ────────────────────────────────────────────────
  if (!calibration.done && camStream) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-4">Gaze Calibration</h2>
          <p className="mb-4">
            Click the circle {calibration.points - calibration.count} more time(s).
          </p>
          <button
            onClick={calibration.record}
            className="w-16 h-16 bg-purple-500 rounded-full mx-auto mb-2"
          />
        </div>
      </div>
    );
  }

  // ─── Screen-Share UI ──────────────────────────────────────────────
  if (!screenStream) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-4">Screen Share Required</h2>
          <VideoPanel
  camStream={camStream}
  screenStream={screenStream}
  startCam={startCam}
  startScreen={startScreen}
  camRef={camRef}
  screenRef={screenRef}
/>

        </div>
      </div>
    );
  }

  // ─── Main Interview UI ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between">
          <div>
            <h1 className="text-xl font-bold">AI Interview Session</h1>
            <p className="text-sm text-gray-600">
              Question {status.question_count} of {status.max_questions}
            </p>
          </div>
          <button
            onClick={() => ws?.send(JSON.stringify({ answer: "end interview" }))}
            disabled={!isConnected}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          >
            End Interview
          </button>
        </div>
      </div>

      {/* Video Panels */}
      <div className="flex-1 max-w-7xl mx-auto flex flex-col">
        <div className="p-6">
          <VideoPanel
            camStream={camStream}
            screenStream={screenStream}
            startCam={startCam}
            startScreen={startScreen}
            camRef={camRef}
            screenRef={screenRef}
          />
        </div>

        {/* Progress Bar */}
        <div className="px-6 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-gray-500">
              {Math.round((status.question_count / status.max_questions) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-blue-600 transition-all"
              style={{ width: `${(status.question_count / status.max_questions) * 100}%` }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-6 p-4 bg-red-50 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Voice Preview & Controls */}
        <div className="mx-6 mb-4">
          {!voiceReady && (
            <div className="text-gray-500 text-sm mb-2">Loading voice engine…</div>
          )}
          {isVoiceMode && (
            <div className="p-3 bg-blue-50 rounded mb-2">
              <strong>Speaking:</strong>{" "}
              <span>{finalTranscript}</span>
              <span className="opacity-60">{interimTranscript}</span>
            </div>
          )}
          {voiceError && (
            <div className="text-red-600 text-sm mb-2">{voiceError}</div>
          )}
          <div className="flex space-x-2">
            <button
              onClick={startVoice}
              disabled={!voiceReady || isListening || !isConnected}
              className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
            >
              Start Voice
            </button>
            <button
              onClick={stopVoice}
              disabled={!isListening}
              className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
            >
              Stop Voice
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.sender === "you" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-3xl ${m.sender === "you" ? "order-2" : ""}`}>
                <div
                  className={`px-6 py-4 rounded-2xl shadow-sm ${
                    m.sender === "you"
                      ? "bg-blue-500 text-white ml-8"
                      : "bg-white border border-gray-200 mr-8"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                  {m.sender === "ai" && (
                    <div className="flex justify-between items-center mt-3 pt-3 border-t text-gray-600">
                      <button
                        onClick={() => speak(m.text)}
                        disabled={isSpeaking}
                        className="text-sm hover:text-blue-600 disabled:opacity-50"
                      >
                        {isSpeaking ? "Speaking..." : "Play Audio"}
                      </button>
                      {m.timestamp && (
                        <span className="text-xs text-gray-400">
                          {m.timestamp.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )}
                  {m.sender === "you" && m.timestamp && (
                    <div className="text-xs text-blue-100 mt-2">
                      {m.timestamp.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex">
              <div className="px-6 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <span className="text-gray-600">AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Send */}
        {!status.is_complete && (
          <div className="bg-white border-t p-6">
            <div className="flex items-end space-x-4">
              <textarea
                className={`w-full border rounded-2xl px-4 py-3 resize-none focus:ring-2 focus:ring-blue-500 text-sm ${
                  isVoiceMode ? "bg-blue-50" : ""
                }`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendAnswer();
                  }
                }}
                placeholder="Type your answer…"
                rows={3}
                disabled={!isConnected || isLoading || isVoiceMode}
              />
              <button
                onClick={sendAnswer}
                disabled={!input.trim() || !isConnected || isLoading || isVoiceMode}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl disabled:opacity-50"
              >
                {isLoading ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}

        {/* Completion */}
        {status.is_complete && (
          <div className="p-8 bg-green-50 border-t text-center">
            <h3 className="text-2xl font-bold text-green-800 mb-2">Interview Complete!</h3>
            <p className="text-green-700">Thank you— well be in touch soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
