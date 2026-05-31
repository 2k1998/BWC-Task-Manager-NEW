'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useChatbot } from '@/context/ChatbotContext';
import ChatbotHeader from './ChatbotHeader';
import ChatbotInput from './ChatbotInput';
import ChatbotMessages from './ChatbotMessages';

export default function ChatbotPanel() {
  const { isOpen } = useChatbot();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed top-0 right-0 bottom-0 z-[49] flex w-full flex-col border-l border-[#E5E7EB] bg-white shadow-xl md:w-[420px]"
          aria-label="BWC Assistant chat panel"
        >
          <ChatbotHeader />
          <ChatbotMessages />
          <ChatbotInput />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
