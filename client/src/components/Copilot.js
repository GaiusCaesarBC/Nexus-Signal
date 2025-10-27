import React, { useState, useRef, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Bot, X, Send, CornerDownLeft } from 'lucide-react';
import axios from 'axios';

const API_URL = 'https://refactored-robot-r456x9xvgqw7cpgjv-5000.app.github.dev'; // We will update this later

const slideIn = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const CopilotWrapper = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
`;

const ChatIcon = styled.button`
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease-in-out;

  &:hover {
    transform: scale(1.1);
  }
`;

const ChatWindow = styled.div`
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 400px;
  height: 550px;
  background-color: #2c3e50;
  border-radius: 10px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ${slideIn} 0.3s ease-out;
  z-index: 1001;
`;

const ChatHeader = styled.div`
  background-color: #34495e;
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #ecf0f1;
`;

const HeaderTitle = styled.h4`
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #bdc3c7;
  cursor: pointer;
  padding: 5px;

  &:hover {
    color: #ecf0f1;
  }
`;

const MessageList = styled.div`
  flex-grow: 1;
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MessageBubble = styled.div`
  padding: 10px 14px;
  border-radius: 18px;
  max-width: 85%;
  font-size: 1rem;
  line-height: 1.5;

  &.user {
    background-color: #3498db;
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 5px;
  }

  &.ai {
    background-color: #34495e;
    color: #ecf0f1;
    align-self: flex-start;
    border-bottom-left-radius: 5px;
  }
`;

const InputArea = styled.form`
  display: flex;
  padding: 10px;
  border-top: 1px solid #34495e;
`;

const TextInput = styled.input`
  flex-grow: 1;
  border: none;
  background: none;
  outline: none;
  color: #ecf0f1;
  font-size: 1rem;
  padding: 5px;
`;

const SendButton = styled.button`
  background: none;
  border: none;
  color: #3498db;
  cursor: pointer;
  padding: 5px;

  &:hover {
    color: #2980b9;
  }
`;

const Copilot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hello! I am Nexus Signal AI. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageListRef = useRef(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/copilot/chat`, { prompt: input });
      const aiMessage = { sender: 'ai', text: res.data.reply };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error("Error calling Copilot API:", err);
      const errorMessage = { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CopilotWrapper>
      {!isOpen && (
        <ChatIcon onClick={() => setIsOpen(true)}>
          <Bot size={28} />
        </ChatIcon>
      )}

      {isOpen && (
        <ChatWindow>
          <ChatHeader>
            <HeaderTitle><Bot size={18} /> Nexus Signal AI</HeaderTitle>
            <CloseButton onClick={() => setIsOpen(false)}>
              <X size={20} />
            </CloseButton>
          </ChatHeader>
          <MessageList ref={messageListRef}>
            {messages.map((msg, index) => (
              <MessageBubble key={index} className={msg.sender}>
                {msg.text}
              </MessageBubble>
            ))}
            {isLoading && <MessageBubble className="ai">Thinking...</MessageBubble>}
          </MessageList>
          <InputArea onSubmit={sendMessage}>
            <TextInput
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nexus Signal AI..."
              disabled={isLoading}
            />
            <SendButton type="submit" disabled={isLoading}>
              {isLoading ? <CornerDownLeft size={20} /> : <Send size={20} />}
            </SendButton>
          </InputArea>
        </ChatWindow>
      )}
    </CopilotWrapper>
  );
};

export default Copilot;

