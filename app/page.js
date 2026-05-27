'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from './components/BottomNav';
import { MicIcon, CheckCircleIcon, LoaderIcon, VolumeIcon } from './components/Icons';
import { useSpeechRecognition, speak, parseTranscript } from '../lib/speech';
import { addTransaction, getSetting, setSetting, getAllTransactions } from '../lib/db';

const STATUS_MESSAGES = {
  hindi: {
    idle: 'बोलने के लिए दबाएं',
    listening: 'सुन रहा हूं...',
    processing: 'समझ रहा हूं...',
    success: 'सेव हो गया!',
    error: 'फिर से बोलें',
  },
  gujarati: {
    idle: 'બોલવા માટે દબાવો',
    listening: 'સાંભળી રહ્યો છું...',
    processing: 'સમજી રહ્યો છું...',
    success: 'સેવ થઈ ગયું!',
    error: 'ફરી બોલો',
  },
  english: {
    idle: 'Tap to speak',
    listening: 'Listening...',
    processing: 'Understanding...',
    success: 'Saved!',
    error: 'Try again',
  },
};

export default function HomePage() {
  const [language, setLanguage] = useState('hindi');
  const [status, setStatus] = useState('idle'); // idle, listening, processing, success, error
  const [displayText, setDisplayText] = useState('');
  const [parsedData, setParsedData] = useState(null);

  const { isListening, transcript, error: speechError, startListening, stopListening } =
    useSpeechRecognition(language);

  // Load saved language preference
  useEffect(() => {
    getSetting('language').then((lang) => {
      if (lang) setLanguage(lang);
    }).catch(() => {});
  }, []);

  // Update status based on listening state
  useEffect(() => {
    if (isListening) {
      setStatus('listening');
    }
  }, [isListening]);

  // Update display text from transcript
  useEffect(() => {
    if (transcript) {
      setDisplayText(transcript);
    }
  }, [transcript]);

  // Handle speech error
  useEffect(() => {
    if (speechError) {
      setStatus('error');
      setDisplayText(speechError);
    }
  }, [speechError]);

  // Process transcript when listening stops
  useEffect(() => {
    if (!isListening && transcript && status === 'listening') {
      handleProcessTranscript(transcript);
    }
  }, [isListening]);

  const handleProcessTranscript = async (text) => {
    if (!text || text.trim().length === 0) {
      setStatus('idle');
      return;
    }

    setStatus('processing');
    setDisplayText(text);

    try {
      const all = await getAllTransactions();
      const recentContext = all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
      
      const result = await parseTranscript(text, language, recentContext);

      if (result.success && result.data) {
        const data = result.data;

        // Handle query types
        if (data.type === 'query') {
          setStatus('success');
          setParsedData(data);
          if (data.summary) {
            setDisplayText(data.summary);
            await speak(data.summary, language);
          }
          setTimeout(() => {
            setStatus('idle');
            setDisplayText('');
            setParsedData(null);
          }, 4000);
          return;
        }

        // Handle AI clarification questions or errors
        if (data.type === 'error') {
          setStatus('error');
          const errorMsg = data.summary || (
            language === 'hindi' ? 'मुझे समझ नहीं आया, कृपया फिर से बोलें' :
            language === 'gujarati' ? 'મને સમજાયું નહીં, કૃપા કરીને ફરી બોલો' :
            'I could not understand, please try again'
          );
          setDisplayText(errorMsg);
          await speak(errorMsg, language);
          setTimeout(() => {
            setStatus('idle');
            setDisplayText('');
            setParsedData(null);
          }, 4000);
          return;
        }

        // Save transaction
        if (data.amount && data.amount > 0) {
          const saved = await addTransaction({
            ...data,
            raw_transcript: text,
          });

          setStatus('success');
          setParsedData(data);

          // Haptic feedback
          if (navigator.vibrate) navigator.vibrate([50, 100, 50]);

          // Speak confirmation
          const confirmText = data.summary || `₹${data.amount} saved`;
          setDisplayText(confirmText);
          await speak(confirmText, language);

          setTimeout(() => {
            setStatus('idle');
            setDisplayText('');
            setParsedData(null);
          }, 4000);
        } else {
          setStatus('error');
          const errorMsg = language === 'hindi' ? 'राशि समझ नहीं आई, फिर से बोलें' :
                          language === 'gujarati' ? 'રકમ સમજાઈ નહીં, ફરી બોલો' :
                          'Could not understand the amount, please try again';
          setDisplayText(errorMsg);
          await speak(errorMsg, language);
          setTimeout(() => {
            setStatus('idle');
            setDisplayText('');
          }, 3000);
        }
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.error('Process error:', err);
      setStatus('error');
      const errorMsg = language === 'hindi' ? 'कुछ गलत हो गया, फिर से कोशिश करें' :
                      language === 'gujarati' ? 'કંઈક ખોટું થયું, ફરી પ્રયાસ કરો' :
                      'Something went wrong, please try again';
      setDisplayText(errorMsg);
      setTimeout(() => {
        setStatus('idle');
        setDisplayText('');
      }, 3000);
    }
  };

  const handleMicPress = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      setParsedData(null);
      setDisplayText('');
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const handleLanguageChange = async (lang) => {
    setLanguage(lang);
    await setSetting('language', lang);
  };

  const messages = STATUS_MESSAGES[language] || STATUS_MESSAGES.hindi;

  const getStatusText = () => {
    if (displayText) return displayText;
    return messages[status] || messages.idle;
  };

  const getMicButtonClass = () => {
    let cls = 'mic-button';
    if (status === 'listening') cls += ' listening';
    if (status === 'processing') cls += ' processing';
    if (status === 'success') cls += ' success';
    return cls;
  };

  const getMicIcon = () => {
    if (status === 'processing') return <LoaderIcon size={48} />;
    if (status === 'success') return <CheckCircleIcon size={48} />;
    return <MicIcon size={48} />;
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" id="app-title">HisaabBot</h1>
          <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {language === 'hindi' ? 'आवाज़ से हिसाब रखें' :
             language === 'gujarati' ? 'અવાજથી હિસાબ રાખો' :
             'Voice Finance Assistant'}
          </p>
        </div>
        <div className="lang-selector">
          {['hindi', 'gujarati', 'english'].map((lang) => (
            <button
              key={lang}
              className={`lang-btn ${language === lang ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang)}
              id={`lang-${lang}`}
            >
              {lang === 'hindi' ? 'हिं' : lang === 'gujarati' ? 'ગુ' : 'En'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="page-content">
        <div className="card-glass" style={{ marginBottom: 20, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <VolumeIcon size={16} style={{ color: 'var(--green-400)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--green-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {language === 'hindi' ? 'ऐसे बोलें' : language === 'gujarati' ? 'આમ બોલો' : 'Try saying'}
            </span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {language === 'hindi' ? (
              <>
                "Ramesh ne 500 rupaye liye"<br />
                "Aaj sabzi pe 120 rupaye lage"<br />
                "Suresh ne paisa de diya"
              </>
            ) : language === 'gujarati' ? (
              <>
                "Ramesh e 500 rupiya lidha"<br />
                "Aaje shak par 120 rupiya thaya"<br />
                "Suresh e paisa aapi didha"
              </>
            ) : (
              <>
                "Ramesh borrowed 500 rupees"<br />
                "Spent 120 on vegetables today"<br />
                "Suresh paid back the money"
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mic Section */}
      <div className={`mic-container ${status === 'listening' ? 'listening' : ''}`}>
        {/* Waveform - only show when listening */}
        {status === 'listening' && (
          <div className="waveform">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        )}

        {/* Mic Button */}
        <button
          className={getMicButtonClass()}
          onClick={handleMicPress}
          id="mic-button"
          aria-label={isListening ? 'Stop recording' : 'Start recording'}
        >
          <div className="mic-ring" />
          <div className="mic-ring" />
          <div className="mic-ring" />
          {getMicIcon()}
        </button>

        {/* Status */}
        <p className="mic-status">{getStatusText()}</p>

        {/* Parsed Result Card */}
        {parsedData && status === 'success' && (
          <div className="card" style={{ maxWidth: 340, width: '100%', textAlign: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 8
            }}>
              <CheckCircleIcon size={20} style={{ color: 'var(--green-400)' }} />
              <span style={{ fontWeight: 700, color: 'var(--green-400)' }}>
                {parsedData.type === 'lent' ? (language === 'hindi' ? 'उधार दिया' : 'Lent') :
                 parsedData.type === 'borrowed' ? (language === 'hindi' ? 'उधार लिया' : 'Borrowed') :
                 (language === 'hindi' ? 'खर्चा' : 'Expense')}
              </span>
            </div>
            {parsedData.person_name && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {parsedData.person_name}
              </p>
            )}
            <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>
              ₹{parsedData.amount?.toLocaleString('en-IN')}
            </p>
            {parsedData.due_date && (
              <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                Due: {new Date(parsedData.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
