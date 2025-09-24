

// ——— Core result interfaces ———
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

// ——— Grammar support (optional) ———
interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechGrammarList {
  readonly length: number;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

// ——— The main Recognition interface ———
interface SpeechRecognition extends EventTarget {
  grammars: SpeechGrammarList;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend:   ((this: SpeechRecognition, ev: Event) => void) | null;
  onend:        ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror:      ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch:    ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onresult:     ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend:   ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart:((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend:  ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart:      ((this: SpeechRecognition, ev: Event) => void) | null;

  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionStatic {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
}

/** the standard constructor */
declare var SpeechRecognition: SpeechRecognitionStatic;
/** the WebKit-prefixed one in Chrome/Safari */
declare var webkitSpeechRecognition: SpeechRecognitionStatic;
declare global {
    interface Window {
      /** Standard constructor (if exposed) */
      SpeechRecognition?: SpeechRecognitionStatic;
      /** WebKit-prefixed constructor */
      webkitSpeechRecognition?: SpeechRecognitionStatic;
    }
  }