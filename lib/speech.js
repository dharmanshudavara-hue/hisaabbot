'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Language codes for Web Speech API
const LANG_CODES = {
  hindi: 'hi-IN',
  gujarati: 'gu-IN',
  english: 'en-IN',
};

// TTS voice preferences
const TTS_LANG_CODES = {
  hindi: 'hi-IN',
  gujarati: 'gu-IN',
  english: 'en-IN',
};

/**
 * Unlock audio playback on iOS Safari.
 * Must be called directly inside a user-gesture handler (e.g. pointerdown).
 * Creates a silent AudioContext buffer + triggers an empty speechSynthesis utterance
 * so that later async calls to speak() are allowed by the browser.
 */
let _audioUnlocked = false;
export function unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;

  // 1. Unlock Web Audio API (needed for new Audio() to work later)
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      // Create a tiny silent buffer and play it
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      // Resume context if suspended (iOS pauses it by default)
      if (ctx.state === 'suspended') ctx.resume();
      // Close after a short delay to free resources
      setTimeout(() => ctx.close().catch(() => {}), 500);
    }
  } catch (e) {
    // Ignore — just means Web Audio isn't available
  }

  // 2. Unlock speechSynthesis by speaking an empty utterance
  try {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    // Ignore
  }

  // 3. Pre-create and immediately pause an Audio element to unlock media playback
  try {
    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=');
    silentAudio.volume = 0;
    silentAudio.play().then(() => silentAudio.pause()).catch(() => {});
  } catch (e) {
    // Ignore
  }
}

/**
 * Custom hook for Speech-to-Text using Web Speech API
 */
export function useSpeechRecognition(language = 'hindi') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser. Please use Chrome.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = LANG_CODES[language] || 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      // Haptic feedback on mic start
      if (navigator.vibrate) navigator.vibrate(50);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 10000); // 10 seconds of silence
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    setIsListening(false);
    // Haptic feedback on mic stop
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  };
}

/**
 * Text-to-Speech using High-Quality Google TTS (Fallback to Web Speech API)
 */
export function speak(text, language = 'hindi') {
  return new Promise((resolve, reject) => {
    try {
      // Cancel any ongoing speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const langCode = TTS_LANG_CODES[language] || 'hi-IN';
      const baseLang = langCode.split('-')[0]; // e.g. 'hi', 'gu', 'en'
      
      // Use the unofficial Google Translate TTS endpoint for natural voice
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${baseLang}&client=tw-ob`;
      
      const audio = new Audio(url);
      
      audio.onended = () => {
        if (navigator.vibrate) navigator.vibrate(30);
        resolve();
      };
      
      audio.onerror = (e) => {
        console.warn('Google TTS failed, falling back to Web Speech API', e);
        fallbackSpeak(text, language).then(resolve).catch(reject);
      };
      
      audio.play().catch(e => {
        console.warn('Audio play failed, falling back', e);
        fallbackSpeak(text, language).then(resolve).catch(reject);
      });
      
    } catch (err) {
      console.error('Error with audio, falling back', err);
      fallbackSpeak(text, language).then(resolve).catch(reject);
    }
  });
}

function fallbackSpeak(text, language) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = TTS_LANG_CODES[language] || 'hi-IN';
    utterance.rate = 0.9; // 0.9 sounds more natural
    utterance.pitch = 1;
    utterance.volume = 1;

    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const langCode = TTS_LANG_CODES[language] || 'hi-IN';
      const baseLang = langCode.split('-')[0];
      
      const langVoices = voices.filter(v => v.lang.startsWith(baseLang));
      
      if (langVoices.length > 0) {
        // Prioritize natural sounding voices
        const bestVoice = langVoices.find(v => 
          v.name.includes('Google') || 
          v.name.includes('Natural') || 
          v.name.includes('Premium') ||
          v.name.includes('Online')
        ) || langVoices.find(v => v.localService === false) || langVoices[0];
        
        utterance.voice = bestVoice;
      }
      
      utterance.onend = () => {
        if (navigator.vibrate) navigator.vibrate(30);
        resolve();
      };
      utterance.onerror = (e) => reject(e);
      
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoiceAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      setVoiceAndSpeak();
    }
  });
}

/**
 * Parse voice transcript using Groq AI
 * @param {string} transcript - The voice transcript text
 * @param {string} language - Language code ('hindi', 'gujarati', 'english')
 * @param {Array} context - Recent transactions for context
 * @param {Object|null} clarification_context - Previous clarification context for multi-round flow
 */
export async function parseTranscript(transcript, language = 'hindi', context = [], clarification_context = null) {
  try {
    const body = { transcript, language, context };
    if (clarification_context) {
      body.clarification_context = clarification_context;
    }

    const response = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Parse error:', error);
    throw error;
  }
}
