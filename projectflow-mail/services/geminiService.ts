
import { GoogleGenAI } from "@google/genai";
import { Email, Project } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeEmailContent = async (email: Email, availableProjects: Project[]) => {
  const ai = getClient();
  if (!ai) return null;

  const projectsList = availableProjects.map(p => `${p.name} (ID: ${p.id})`).join(', ');

  const prompt = `
    You are a construction project manager assistant. Analyze the following email.
    
    Sender: ${email.sender.name}
    Subject: ${email.subject}
    Body: ${email.body}

    Available Projects: ${projectsList}

    Please provide a JSON response with the following fields:
    1. summary: A very brief 1-sentence summary of the email.
    2. extractedData: An object containing potential project fields if found (e.g., permitNumber, siteAddress, budget, dueDate). Return empty object if none found.
    3. suggestedProjectId: The ID of the project from the available list that this email most likely belongs to.
    4. sentiment: One word (Positive, Neutral, Negative, Urgent).

    Output JSON only.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return null;
  }
};
