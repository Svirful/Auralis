/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import cn from "classnames";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useLoggerStore } from "../../lib/store-logger";
import "./chat.scss";
import { Part } from "@google/genai";

export default function Chat() {
  const { connected, client, showChat, setShowChat } = useLiveAPIContext();
  const { logs } = useLoggerStore();
  const [textInput, setTextInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Filter logs for chat messages
  const chatMessages = useMemo(() => {
    return logs.filter((log) => {
      if (log.type === "client.send") return true;
      if (log.type === "server.content") {
        const message = log.message as any;
        const sc = message?.serverContent;
        return (
          sc?.modelTurn?.parts?.some((p: any) => p.text) ||
          sc?.inputTranscription?.text ||
          sc?.outputTranscription?.text
        );
      }
      if (log.type === "server.toolCall") {
        const message = log.message as any;
        const toolCall = message?.toolCall;
        return toolCall?.functionCalls?.some((fc: any) => fc.name === "paste_text");
      }
      return false;
    });
  }, [logs]);

  // Process and group chat messages
  const groupedMessages = useMemo(() => {
    const messages: { isUser: boolean; content: string; date: Date; isThought?: boolean; isPaste?: boolean }[] = [];
    
    chatMessages.forEach((log) => {
      const message = log.message as any;
      const isClientSend = log.type === "client.send";
      const sc = message?.serverContent;
      const isUserTranscript = !!(sc?.inputTranscription || sc?.modelTurn?.role === "user");
      const isUser = !!(isClientSend || isUserTranscript);
      
      let content = "";
      let isThought = false;
      let isPaste = false;

      if (isClientSend) {
        const parts = message.turns as Part[];
        content = parts.map(p => p.text).join("");
      } else if (sc) {
        if (sc.inputTranscription) {
          content = sc.inputTranscription.text;
        } else if (sc.outputTranscription) {
          content = sc.outputTranscription.text;
        } else if (sc.modelTurn) {
          const parts = sc.modelTurn.parts as Part[];
          // Filter out or mark thoughts
          content = parts.map(p => {
            if (p.thought) isThought = true;
            return p.text;
          }).join("");
        }
      } else if (log.type === "server.toolCall") {
        const toolCall = message?.toolCall;
        const fc = toolCall?.functionCalls?.find((f: any) => f.name === "paste_text");
        if (fc) {
          content = fc.args.text;
          isPaste = true;
        }
      }

      if (!content.trim()) return;

      const lastMsg = messages[messages.length - 1];
      
      // Grouping logic:
      // 1. Same sender (User vs AI)
      // 2. Not a thought (unless grouping two thoughts)
      // 3. Not a paste (pastes are never grouped)
      // 4. Within 5 seconds of the previous message chunk
      const timeDiff = lastMsg ? (log.date.getTime() - lastMsg.date.getTime()) : 0;
      const isGroupable = lastMsg && 
                         lastMsg.isUser === isUser && 
                         lastMsg.isThought === isThought && 
                         !lastMsg.isPaste && !isPaste &&
                         timeDiff < 5000;

      if (isGroupable) {
        // Add a space if the previous content doesn't end with one and new doesn't start with one
        const needsSpace = !lastMsg.content.endsWith(" ") && !content.startsWith(" ") && 
                          !lastMsg.content.endsWith("\n") && !content.startsWith("\n");
        
        lastMsg.content += (needsSpace ? " " : "") + content;
        lastMsg.date = log.date; // Update to latest timestamp
      } else {
        messages.push({ isUser, content, date: log.date, isThought, isPaste });
      }
    });

    return messages;
  }, [chatMessages]);

  const scrollToBottom = (force = false) => {
    if (!messagesContainerRef.current) return;
    
    // Check if user is near bottom
    const container = messagesContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

    if (force || isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [groupedMessages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textInput.trim() || !connected) return;

    client?.send([{ text: textInput }]);
    setTextInput("");
  };

  // Function to render content with clickable links
  const renderContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => {
              // If in electron, use shell to open
              const electron = (window as any).electron;
              if (electron?.openExternal) {
                e.preventDefault();
                electron.openExternal(part);
              }
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn("chat-panel", { open: showChat })}>
      <header className="chat-header">
        <div className="header-left">
          <span className="material-symbols-outlined">forum</span>
          <h3>Auralis Chat</h3>
        </div>
        <button className="close-button" onClick={() => setShowChat(false)}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <div className="messages-container" ref={messagesContainerRef}>
        {groupedMessages.map((msg, i) => (
          <div key={i} className={cn("message-bubble", msg.isUser ? "user" : "ai", { thought: msg.isThought, paste: msg.isPaste })}>
            {msg.isThought && <div className="thought-label">Thinking...</div>}
            {msg.isPaste && <div className="paste-label"><span className="material-symbols-outlined">content_paste</span> Pasted Content</div>}
            <div className="message-content">{renderContent(msg.content)}</div>
            <div className="message-time">
              {msg.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <form onSubmit={handleSubmit} className="input-form">
          <textarea
            className="chat-textarea"
            placeholder="Type your message..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button 
            type="submit" 
            className="send-btn"
            disabled={!textInput.trim() || !connected}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
