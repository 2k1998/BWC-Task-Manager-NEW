import apiClient from '@/lib/apiClient';

export interface ChatbotConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatbotConversationListItem {
  id: string;
  title: string | null;
  updated_at: string;
}

export interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_name: string | null;
  created_at: string;
}

export async function createConversation(): Promise<ChatbotConversation> {
  const res = await apiClient.post<ChatbotConversation>('/chatbot/conversations');
  return res.data;
}

export async function listConversations(): Promise<ChatbotConversationListItem[]> {
  const res = await apiClient.get<ChatbotConversationListItem[]>('/chatbot/conversations');
  return res.data ?? [];
}

export async function getMessages(conversationId: string): Promise<ChatbotMessage[]> {
  const res = await apiClient.get<ChatbotMessage[]>(
    `/chatbot/conversations/${conversationId}/messages`,
  );
  return res.data ?? [];
}

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<ChatbotMessage> {
  const res = await apiClient.post<ChatbotMessage>(
    `/chatbot/conversations/${conversationId}/messages`,
    { content },
  );
  return res.data;
}
