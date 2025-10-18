const express = require('express');
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  
  // --- ACTION 1: FINDING THE "ID BADGE" ---
  // This line looks into your server's environment (specifically the .env file)
  // and finds the variable named GEMINI_API_KEY. It stores your secret key
  // in the 'geminiApiKey' variable so we can use it.
  const geminiApiKey = process.env.GEMINI_API_KEY; 

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // --- ACTION 2: CHECKING IF THE "ID BADGE" EXISTS ---
  // This is a crucial safety check. If, for some reason, the server can't find
  // your API key (maybe you forgot to add it to .env or there's a typo),
  // it will stop right here and log a clear error. This prevents it from
  // making a pointless, doomed request to Google.
  if (!geminiApiKey) {
    console.error('Gemini API key is not configured in .env file');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // --- ACTION 3: SHOWING THE "ID BADGE" AT THE DOOR ---
  // Here, we build the full URL to talk to Google's AI. Using the backticks (` `),
  // we embed your actual API key directly into the end of the URL.
  // This is how we present the "ID badge" to Google's servers.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ "google_search": {} }], 
  };

  try {
    // This 'fetch' call sends your question (the payload) to the secure URL we just built.
    // Because the URL now contains your valid key, Google's servers will accept the request.
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('Gemini API Error:', errorData);
      throw new Error(`Gemini API responded with status: ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ reply });

  } catch (err) {
    console.error('Error in Copilot route:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

