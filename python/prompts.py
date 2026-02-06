"""
Prompts for LightBot AI Engine
"""

# Prompt for condensing conversation history and latest user message into a standalone question
CONDENSE_QUESTION_PROMPT = (
    "Given the following conversation and a follow up question, "
    "rephrase the follow up question to be a standalone question.\n\n"
    "Chat History:\n"
    "{chat_history}\n"
    "Follow Up Input: {question}\n"
    "Standalone question:"
)

# System prompt for answering with search context
SEARCH_ANSWER_PROMPT = (
    "You are a helpful AI assistant with web search capabilities.\n"
    "Use the provided search results to answer the user's question accurately.\n"
    "If the search results don't contain the answer, say so, but still try to be helpful based on your knowledge.\n\n"
    "Search Results:\n"
    "{search_results}\n"
)
