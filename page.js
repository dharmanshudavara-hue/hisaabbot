'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import BottomNav from './components/BottomNav';
import { MicIcon, CheckCircleIcon, LoaderIcon, VolumeIcon, XCircleIcon } from './components/Icons';
import { useSpeechRecognition, speak, parseTranscript, unlockAudio } from '../lib/speech';
import { addTransaction, getSetting, setSetting, getAllTransactions } from '../lib/db';

const MAX_CLARIFICATION_ROUNDS = 2;

const STATUS_MESSAGES = {
  hindi: {
    idle: 'दबाकर रखें बोलने के लिए',
    listening: 'सुन रहा हूं... छोड़ें जब बोल लें',
    processing: 'समझ रहा हूं...',
    success: 'सेव हो गया!',
    error: 'फिर से बोलें',
    clarify: 'जवाब दें — माइक दबाएं',
  },
  gujarati: {
    idle: 'બોલવા માટે દબાવી રાખો',
    listening: 'સાંભળી રહ્યો છું... છોડો જ્યારે બોલી લો',
    processing: 'સમજી રહ્યો છું...',
    success: 'સેવ થઈ ગયું!',
    error: 'ફરી બોલો',
    clarify: 'જવાબ આપો — માઇક દબાવો',
  },
  english: {
    idle: 'Hold to speak',
    listening: 'Listening... release when done',
    processing: 'Understanding...',
    success: 'Saved!',
    error: 'Try again',
    clarify: 'Answer — hold the mic',
  },
};

// Question mark icon for clarification state
function QuestionIcon({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function HomePage() {
  const [language, setLanguage] = useState('hindi');
  const [status, setStatus] = useState('idle'); // idle, listening, processing, success, error, clarify
  const [displayText, setDisplayText] = useState('');
  const [parsedData, setParsedData] = useState(null);

  // Clarification flow state
  const [clarificationRound, setClarificationRound] = useState(0);
  const [clarificationContext, setClarificationContext] = useState(null);
  // { original_transcript, ai_question, partial_data }

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
      // If we were in clarification mode and got empty input, stay in clarify
      if (status === 'listening' && clarificationContext) {
        setStatus('clarify');
        setDisplayText(clarificationContext.ai_question);
        return;
      }
      setStatus('idle');
      return;
    }

    setStatus('processing');
    setDisplayText(text);

    try {
      const all = await getAllTransactions();
      const recentContext = all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);

      // Pass clarification context if we're in a follow-up round
      const result = await parseTranscript(text, language, recentContext, clarificationContext);

      if (result.success && result.data) {
        const data = result.data;

        // ─── Handle CLARIFICATION response ───
        if (data.type === 'clarification') {
          const nextRound = clarificationRound + 1;

          if (nextRound > MAX_CLARIFICATION_ROUNDS) {
            // Exceeded max rounds — give up
            setStatus('error');
            setClarificationRound(0);
            setClarificationContext(null);
            const giveUpMsg =
              language === 'hindi' ? 'मुझे समझ नहीं आया, कृपया पूरी बात फिर से बोलें' :
              language === 'gujarati' ? 'મને સમજાયું નહીં, કૃપા કરીને ફરી પૂરી વાત બોલો' :
              'I could not understand, please try the full sentence again';
            setDisplayText(giveUpMsg);
            await speak(giveUpMsg, language);
            setTimeout(() => {
              setStatus('idle');
              setDisplayText('');
              setParsedData(null);
            }, 4000);
            return;
          }

          // Enter clarification mode
          setClarificationRound(nextRound);
          setClarificationContext({
            original_transcript: clarificationContext?.original_transcript || text,
            ai_question: data.summary,
            partial_data: data.partial_data || {},
          });
          setStatus('clarify');
          setDisplayText(data.summary);

          // Haptic to signal question
          if (navigator.vibrate) navigator.vibrate([30, 80, 30]);

          // Speak the clarification question
          await speak(data.summary, language);
          return;
        }

        // ─── Handle QUERY response ───
        if (data.type === 'query') {
          setStatus('success');
          setParsedData(data);
          setClarificationRound(0);
          setClarificationContext(null);
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

        // ─── Handle ERROR response ───
        if (data.type === 'error') {
          setStatus('error');
          setClarificationRound(0);
          setClarificationContext(null);
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

        // ─── Handle successful TRANSACTION ───
        if (data.amount && data.amount > 0) {
          const saved = await addTransaction({
            ...data,
            raw_transcript: clarificationContext
              ? `${clarificationContext.original_transcript} → ${text}`
              : text,
          });

          setStatus('success');
          setParsedData(data);
          setClarificationRound(0);
          setClarificationContext(null);

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
          setClarificationRound(0);
          setClarificationContext(null);
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
      setClarificationRound(0);
      setClarificationContext(null);
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

  const cancelClarification = useCallback(() => {
    setClarificationRound(0);
    setClarificationContext(null);
    setStatus('idle');
    setDisplayText('');
    setParsedData(null);
    if (navigator.vibrate) navigator.vibrate(30);
  }, []);

  const micRef = useRef(null);
  const isHoldingRef = useRef(false);

  const handleMicDown = useCallback((e) => {
    // Prevent default to avoid text selection and context menu on long-press
    e.preventDefault();
    if (status === 'processing') return;
    // Unlock iOS audio on user gesture so TTS confirmation works later
    unlockAudio();
    isHoldingRef.current = true;
    setParsedData(null);
    // Don't clear clarification context — we need it for follow-up rounds
    if (!clarificationContext) {
      setDisplayText('');
    }
    startListening();
  }, [startListening, status, clarificationContext]);

  const handleMicUp = useCallback((e) => {
    e.preventDefault();
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    if (isListening) {
      stopListening();
    }
  }, [isListening, stopListening]);

  // Prevent context menu on long-press (mobile)
  useEffect(() => {
    const el = micRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, []);

  // Safety: if pointer leaves the button while held, stop listening
  const handleMicLeave = useCallback(() => {
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      if (isListening) stopListening();
    }
  }, [isListening, stopListening]);

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
    if (status === 'clarify') cls += ' clarify';
    return cls;
  };

  const getMicIcon = () => {
    if (status === 'processing') return <LoaderIcon size={48} />;
    if (status === 'success') return <CheckCircleIcon size={48} />;
    if (status === 'clarify') return <QuestionIcon size={48} />;
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
      <div className={`mic-container ${status === 'listening' ? 'listening' : ''} ${status === 'clarify' ? 'clarify' : ''}`}>
        {/* Clarification round indicator */}
        {status === 'clarify' && clarificationRound > 0 && (
          <div className="clarify-indicator">
            <div className="clarify-dots">
              {Array.from({ length: MAX_CLARIFICATION_ROUNDS }).map((_, i) => (
                <div
                  key={i}
                  className={`clarify-dot ${i < clarificationRound ? 'active' : ''}`}
                />
              ))}
            </div>
            <span className="clarify-label">
              {language === 'hindi' ? `सवाल ${clarificationRound}/${MAX_CLARIFICATION_ROUNDS}` :
               language === 'gujarati' ? `સવાલ ${clarificationRound}/${MAX_CLARIFICATION_ROUNDS}` :
               `Question ${clarificationRound}/${MAX_CLARIFICATION_ROUNDS}`}
            </span>
          </div>
        )}

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
          ref={micRef}
          className={getMicButtonClass()}
          onPointerDown={handleMicDown}
          onPointerUp={handleMicUp}
          onPointerLeave={handleMicLeave}
          onPointerCancel={handleMicUp}
          id="mic-button"
          aria-label={isListening ? 'Recording... release to stop' : status === 'clarify' ? 'Hold to answer the question' : 'Hold to start recording'}
          style={{ touchAction: 'none', userSelect: 'none' }}
        >
          <div className="mic-ring" />
          <div className="mic-ring" />
          <div className="mic-ring" />
          {getMicIcon()}
        </button>

        {/* Status */}
        <p className="mic-status">{getStatusText()}</p>

        {/* Cancel button during clarification */}
        {status === 'clarify' && (
          <button
            className="clarify-cancel-btn"
            onClick={cancelClarification}
            id="clarify-cancel"
            aria-label="Cancel"
          >
            <XCircleIcon size={18} />
            <span>
              {language === 'hindi' ? 'रद्द करें' :
               language === 'gujarati' ? 'રદ કરો' :
               'Cancel'}
            </span>
          </button>
        )}

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
            {parsedData.interest_rate && (
              <p style={{ fontSize: '0.813rem', color: 'var(--amber-400)', marginTop: 4 }}>
                {parsedData.interest_rate}% {language === 'hindi' ? 'मासिक ब्याज' : language === 'gujarati' ? 'માસિક વ્યાજ' : 'monthly interest'}
              </p>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
