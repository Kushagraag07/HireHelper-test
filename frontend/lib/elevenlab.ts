// ElevenLabs Text-to-Speech Service
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

export interface ElevenLabsSettings {
  stability: number; // 0-1
  similarity_boost: number; // 0-1
  style: number; // 0-1
  use_speaker_boost: boolean;
}

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel - Professional female voice
  private defaultSettings: ElevenLabsSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true
  };

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found. Please set NEXT_PUBLIC_ELEVENLABS_API_KEY');
    }
  }

  // Get available voices
  async getVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.apiKey) {
      return this.getDefaultVoices();
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      return this.getDefaultVoices();
    }
  }

  // Get default voices (fallback)
  private getDefaultVoices(): ElevenLabsVoice[] {
    return [
      {
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        category: 'Professional',
        description: 'Professional female voice - great for interviews'
      },
      {
        voice_id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        category: 'Professional',
        description: 'Professional male voice - clear and authoritative'
      },
      {
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        category: 'Friendly',
        description: 'Friendly female voice - warm and approachable'
      },
      {
        voice_id: 'VR6AewLTigWG4xSOukaG',
        name: 'Arnold',
        category: 'Professional',
        description: 'Professional male voice - confident and clear'
      }
    ];
  }

  // Convert text to speech
  async textToSpeech(
    text: string, 
    voiceId: string = this.defaultVoiceId,
    settings: Partial<ElevenLabsSettings> = {}
  ): Promise<ArrayBuffer | null> {
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found. Using fallback speech synthesis.');
      return null;
    }

    try {
      const finalSettings = { ...this.defaultSettings, ...settings };
      
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: finalSettings
          })
        }
      );

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Error with ElevenLabs TTS:', error);
      return null;
    }
  }

  // Play audio from ArrayBuffer
  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioSource = audioContext.createBufferSource();
      
      const arrayBuffer = await audioContext.decodeAudioData(audioBuffer);
      audioSource.buffer = arrayBuffer;
      audioSource.connect(audioContext.destination);
      audioSource.start(0);
      
      return new Promise((resolve, reject) => {
        audioSource.onended = () => resolve();
        audioSource.addEventListener('error', (error) => reject(error));
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  // Get recommended voice for interviews
  getInterviewVoice(): ElevenLabsVoice {
    return {
      voice_id: '21m00Tcm4TlvDq8ikWAM', // Rachel
      name: 'Rachel',
      category: 'Professional',
      description: 'Professional female voice - perfect for interviews'
    };
  }

  // Check if service is available
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const elevenLabsService = new ElevenLabsService();
