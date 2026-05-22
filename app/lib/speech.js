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
 * Text-to-Speech using SpeechSynthesis API
 */
export function speak(text, language = 'hindi') {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = TTS_LANG_CODES[language] || 'hi-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to find a voice for the language
    const voices = window.speechSynthesis.getVoices();
    const langCode = TTS_LANG_CODES[language] || 'hi-IN';
    const voice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      // Haptic feedback on speech end
      if (navigator.vibrate) navigator.vibrate(30);
      resolve();
    };
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Parse voice transcript using Groq AI
 */
export async function parseTranscript(transcript, language = 'hindi') {
  try {
    const response = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, language }),
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
