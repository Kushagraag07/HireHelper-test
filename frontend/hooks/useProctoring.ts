import { useState, useEffect, useRef } from "react";

const CAL_POINTS = 3;
const GAZE_THRESHOLD_MS = 3000;
const WINDOW_SIZE = 5;

export function useProctoring(ws: WebSocket | null) {
  // Streams
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const camRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);

  // Device lists
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  // Selected device IDs
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);

  // Detector
  const [detector, setDetector] = useState<any>(null);

  // Calibration
  const [calCount, setCalCount] = useState(0);
  const [calibrated, setCalibrated] = useState(false);

  // Gaze smoothing
  const gazeTimes = useRef<number[]>([]);
  interface GazeData { x: number; y: number; }

  // Enumerate devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      })
      .catch(console.error);
  }, []);

  // Start camera + microphone
  const startCam = async () => {
    if (!selectedVideoDeviceId || !selectedAudioDeviceId) return;
    try {
      const constraints: MediaStreamConstraints = {
        video: { deviceId: { exact: selectedVideoDeviceId } },
        audio: { deviceId: { exact: selectedAudioDeviceId } }
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setCamStream(s);
      if (camRef.current) camRef.current.srcObject = s;

      // Initialize webgazer for eye-tracking
      const { default: webgazer } = await import("webgazer");
      webgazer
        .setVideoElement(camRef.current!)
        .setRegression("ridge")
        .begin();
      webgazer.showVideo(false).showFaceOutline(false).showFaceFeedbackBox(false);

      webgazer.setGazeListener((data: GazeData | null, timestamp: number) => {
        if (!data || !calibrated) return;
        const now = Date.now();
        gazeTimes.current.unshift(now);
        if (gazeTimes.current.length > WINDOW_SIZE) gazeTimes.current.pop();
        ws?.send(JSON.stringify({ type: "gaze", x: data.x, y: data.y, t: timestamp }));
      });
    } catch (e) {
      console.error("Camera+Mic error:", e);
    }
  };

  // Start screen share
  const startScreen = async () => {
    try {
      // @ts-ignore
      const s: MediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(s);
      if (screenRef.current) screenRef.current.srcObject = s;
    } catch (e) {
      console.error("Screen share error:", e);
    }
  };

  // Object detection
  useEffect(() => {
    let mounted = true;
    Promise.all([import("@tensorflow/tfjs"), import("@tensorflow-models/coco-ssd")])
      .then(([_, cocoMod]) => cocoMod.default.load())
      .then((model: any) => { if (mounted) setDetector(model); })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!detector || !camRef.current) return;
    let stop = false;
    const loop = async () => {
      if (stop) return;
      const preds = await detector.detect(camRef.current!);
      const people = preds.filter((p: any) => p.class === "person").length;
      const phones = preds.filter((p: any) => p.class === "cell phone").length;
      ws?.send(JSON.stringify({ type: "object-detect", people, phones }));
      if (people > 1) alert(`Please be alone on camera. Detected ${people} people.`);
      if (phones > 0) alert(`Please put away your phone.`);
      setTimeout(loop, 500);
    };
    loop();
    return () => { stop = true; };
  }, [detector, ws]);

  // Tab-switch detection
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        ws?.send(JSON.stringify({ type: "tab-switch", count: 1 }));
        alert("Please stay on the interview page.");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ws]);

  // Not-looking warning
  useEffect(() => {
    const iv = setInterval(() => {
      if (!calibrated) return;
      const times = gazeTimes.current;
      if (times.length < WINDOW_SIZE) return;
      const oldest = times[times.length - 1];
      if (Date.now() - oldest > GAZE_THRESHOLD_MS) {
        ws?.send(JSON.stringify({ type: "not-looking" }));
        alert("Please look at the camera.");
        gazeTimes.current = [];
      }
    }, GAZE_THRESHOLD_MS);
    return () => clearInterval(iv);
  }, [calibrated, ws]);

  // Calibration recorder
  const recordCalibration = () => {
    setCalCount(c => {
      const next = c + 1;
      if (next >= CAL_POINTS) setCalibrated(true);
      return next;
    });
  };

  return {
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
    calibration: { count: calCount, points: CAL_POINTS, record: recordCalibration, done: calibrated },
  };
}