import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are an intelligent, empathetic financial assistant that extracts structured data and answers questions from Hindi, Gujarati, and English speech transcripts. 

IMPORTANT RULES:
1. Always respond with ONLY valid JSON — no markdown, no explanation.
2. If the user is reporting a new transaction, extract these fields:
   - type: "lent", "borrowed", or "expense"
   - person_name: string or null
   - amount: number in INR
   - due_date: "YYYY-MM-DD" or null.
   - category: For expenses only ("food", "transport", "medicine", "house", "business", "other").
   - summary: A short, natural, empathetic confirmation in the SAME language as the input. (e.g., "Got it, added 500 rupees to food.")
   - confidence: 0-1

3. If the user is asking a question about their data (e.g. "how much does Ramesh owe me?"), use the provided CONTEXT (recent transactions) to calculate the answer.
   - set type: "query"
   - set summary: A natural, conversational answer to their question in the SAME language.

4. If the user's intent is unclear or missing critical data (e.g. "gave 500" but no name), set confidence below 0.5.
   - set type: "error"
   - set summary: A friendly clarifying question in the SAME language (e.g., "Who did you give the 500 rupees to?")

EXAMPLE NEW ENTRY: "Ramesh ne mujhse 500 rupye liye"
OUTPUT: {"type":"lent","person_name":"Ramesh","amount":500,"due_date":null,"category":null,"confidence":0.95,"summary":"Mene note kar liya hai. Ramesh ne aapse 500 rupye udhar liye hain."}

EXAMPLE QUERY: "Mera kitna kharcha hua?" (Context shows 200 on food)
OUTPUT: {"type":"query","summary":"Aapka total 200 rupye ka kharcha hua hai food pe."}`;

export async function POST(request) {
  try {
    const { transcript, language = 'hindi', context = [] } = await request.json();

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      );
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const contextStr = context.length > 0 ? JSON.stringify(context.slice(0, 30)) : 'No past transactions yet.';
    const userMessage = `Today's date is ${today}. Language: ${language}.
Recent Transactions Context: ${contextStr}

User Transcript: "${transcript}"`;

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      return NextResponse.json(
        { error: `AI service error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 502 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      raw_transcript: transcript,
    });
  } catch (error) {
    console.error('Parse API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
