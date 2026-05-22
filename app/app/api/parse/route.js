import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a financial assistant that extracts structured data from Hindi, Gujarati, and English speech transcripts. 

IMPORTANT RULES:
1. Always respond with ONLY valid JSON — no markdown, no explanation, no extra text.
2. Extract these fields:
   - type: "lent" (user gave money TO someone), "borrowed" (user took money FROM someone), or "expense" (user spent money on something)
   - person_name: string or null (null for expenses)
   - amount: number in INR (rupees). Convert words like "paanch sau" to 500, "hazaar" to 1000, etc.
   - due_date: "YYYY-MM-DD" or null. Convert relative dates like "2 hafte" (2 weeks), "1 mahina" (1 month) to actual dates from today.
   - category: For expenses only — one of: "food", "transport", "medicine", "house", "business", "other". null for loans.
   - confidence: number 0-1 indicating how confident you are in the extraction.
   - summary: A short confirmation sentence in the SAME language as the input.

3. For Hindi: "diya" / "diye" = lent, "liya" / "liye" = borrowed, "kharch" / "gaye" = expense
4. For Gujarati: "aapya" = lent, "lidha" = borrowed, "kharcho" = expense  
5. If you can't determine a required field, set confidence below 0.5 and include what you could extract.
6. For queries like "kaun mujhe paisa dega?" or "kitna udhar hai?" — set type to "query" and include query_type: "outstanding_lent" or "outstanding_borrowed" or "daily_expense" or "total_expense".

EXAMPLE INPUT: "Ramesh ne mujhse 500 rupye liye, 2 hafte mein dega"
EXAMPLE OUTPUT: {"type":"lent","person_name":"Ramesh","amount":500,"due_date":"2026-06-03","category":null,"confidence":0.95,"summary":"Ramesh ka ₹500 ka udhar save ho gaya, 2 hafte baad dega."}

EXAMPLE INPUT: "Aaj sabzi pe 120 rupaye lage"
EXAMPLE OUTPUT: {"type":"expense","person_name":null,"amount":120,"due_date":null,"category":"food","confidence":0.9,"summary":"₹120 ka kharcha food mein save ho gaya."}`;

export async function POST(request) {
  try {
    const { transcript, language = 'hindi' } = await request.json();

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
    const userMessage = `Today's date is ${today}. Language: ${language}. Transcript: "${transcript}"`;

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
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
