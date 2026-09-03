import os
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

SYSTEM_PROMPT = """You are a goal-structuring assistant inside an app called GoalForge.

YOUR ONLY JOB: Help the user turn a vague goal into 3-5 concrete, measurable first steps.

CONVERSATION FLOW:
1. When the user states a goal, ask 1-2 short clarifying questions.
2. After the user answers, produce a numbered list of 3-5 concrete steps.
3. After listing steps, ask: "Which step do you want to commit to first?"

STRICT RULES - NEVER VIOLATE THESE:
- Do NOT give advice, encouragement, or motivational language.
- Do NOT roleplay as a coach.
- Keep responses SHORT.
- Be plain, factual, direct."""

class LLMClient:
    def __init__(self, api_key: str = None):
        if not api_key:
            api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)
        
        # We hit PerModel rate limits on the free tier, so we configure a chain of valid fallback models
        self.models = [
            genai.GenerativeModel(model_name="gemini-3.6-flash", system_instruction=SYSTEM_PROMPT),
            genai.GenerativeModel(model_name="gemini-3.1-flash-lite", system_instruction=SYSTEM_PROMPT),
            genai.GenerativeModel(model_name="gemini-flash-latest", system_instruction=SYSTEM_PROMPT),
            genai.GenerativeModel(model_name="gemini-3.7-flash", system_instruction=SYSTEM_PROMPT)
        ]

    def _attempt_chat(self, model, history, message):
        chat = model.start_chat(history=history)
        response = chat.send_message(
            message,
            safety_settings={
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }
        )
        try:
            return response.text
        except ValueError:
            return "I'm sorry, I couldn't generate a response to that."

    def chat(self, history: list[dict], message: str) -> str:
        formatted_history = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            formatted_history.append({"role": role, "parts": [msg["content"]]})
            
        last_error = None
        for model in self.models:
            try:
                return self._attempt_chat(model, formatted_history, message)
            except Exception as e:
                print(f"Model {model.model_name} failed: {str(e)}")
                last_error = e
                continue
                
        raise Exception(f"All LLM models in the fallback chain failed. Last error: {last_error}")

    def generate(self, prompt: str) -> str:
        model_names = [
            "gemini-3.6-flash",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-3.7-flash"
        ]
        last_error = None
        for name in model_names:
            try:
                model = genai.GenerativeModel(model_name=name)
                response = model.generate_content(
                    prompt,
                    safety_settings={
                        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                    }
                )
                return response.text
            except Exception as e:
                print(f"Model {name} failed for generation: {str(e)}")
                last_error = e
                continue
                
        raise Exception(f"All LLM models in the fallback chain failed for generation. Last error: {last_error}")
