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

import "./logger.scss";
import cn from "classnames";
import { memo } from "react";
import { useLoggerStore } from "../../lib/store-logger";
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs2015 as dark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
  ClientContentLog as ClientContentLogType,
  StreamingLog,
} from "../../types";
import {
  LiveClientToolResponse,
  LiveServerContent,
  LiveServerToolCall,
  Part,
} from "@google/genai";

const formatTime = (d: Date) => d.toLocaleTimeString().slice(0, -3);

const RenderPart = memo(({ part }: { part: Part }) => {
  if (part.text && part.text.length) {
    return <p className="part-text">{part.text}</p>;
  }
  if (part.executableCode) {
    return (
      <div className="part-code-block">
        <div className="part-label">Code Execute ({part.executableCode.language})</div>
        <SyntaxHighlighter
          language={part.executableCode.language?.toLowerCase() || 'text'}
          style={dark}
          customStyle={{ margin: 0, padding: '10px', borderRadius: '8px', fontSize: '11px' }}
        >
          {String(part.executableCode.code || '')}
        </SyntaxHighlighter>
      </div>
    );
  }
  if (part.codeExecutionResult) {
    return (
      <div className="part-code-block result">
        <div className="part-label">Execution Result ({part.codeExecutionResult.outcome})</div>
        <SyntaxHighlighter language="json" style={dark} customStyle={{ margin: 0, padding: '10px', borderRadius: '8px', fontSize: '11px' }}>
          {String(part.codeExecutionResult.output || '')}
        </SyntaxHighlighter>
      </div>
    );
  }
  if (part.inlineData) {
    return (
      <div className="part-data">
        <div className="part-label">Inline Data: {part.inlineData.mimeType}</div>
      </div>
    );
  }
  return null;
});

const ClientContentLog = ({ message }: { message: StreamingLog["message"] }) => {
  const { turns } = (message || {}) as ClientContentLogType;
  if (!turns) return null;
  return (
    <div className="log-content client">
      {turns.filter((p) => p && p.text !== "\n").map((part, i) => (
        <RenderPart part={part} key={i} />
      ))}
    </div>
  );
};

const ToolCallLog = ({ message }: { message: StreamingLog["message"] }) => {
  const { toolCall } = (message || {}) as { toolCall: LiveServerToolCall };
  if (!toolCall) return null;
  return (
    <div className="log-content tool-call">
      {toolCall.functionCalls?.map((fc) => (
        <div key={fc.id} className="part-code-block">
          <div className="part-label">Tool Call: {fc.name}</div>
          <SyntaxHighlighter language="json" style={dark} customStyle={{ margin: 0, padding: '10px', borderRadius: '8px', fontSize: '11px' }}>
            {JSON.stringify(fc.args, null, 2)}
          </SyntaxHighlighter>
        </div>
      ))}
    </div>
  );
};

const ToolResponseLog = ({ message }: { message: StreamingLog["message"] }) => {
  const { functionResponses } = (message || {}) as LiveClientToolResponse;
  if (!functionResponses) return null;
  return (
    <div className="log-content tool-response">
      {functionResponses.map((ref) => (
        <div key={ref.id} className="part-code-block">
          <div className="part-label">Tool Response: {ref.name}</div>
          <SyntaxHighlighter language="json" style={dark} customStyle={{ margin: 0, padding: '10px', borderRadius: '8px', fontSize: '11px' }}>
            {JSON.stringify(ref.response, null, 2)}
          </SyntaxHighlighter>
        </div>
      ))}
    </div>
  );
};

const ModelTurnLog = ({ message }: { message: StreamingLog["message"] }) => {
  const { serverContent } = message as { serverContent: LiveServerContent };
  if (!serverContent) return null;

  if (serverContent.modelTurn) {
    const { modelTurn } = serverContent;
    if (!modelTurn.parts) return null;
    return (
      <div className="log-content server">
        {modelTurn.parts.filter((p) => p && p.text !== "\n").map((part, i) => (
          <RenderPart part={part} key={i} />
        ))}
      </div>
    );
  }

  if (serverContent.interrupted) {
    return <div className="log-content plain interrupted">interrupted</div>;
  }

  if (serverContent.turnComplete) {
    return <div className="log-content plain complete">turnComplete</div>;
  }

  return null;
};

const PlainTextMessage = ({ message }: { message: StreamingLog["message"] }) => (
  <div className="log-content plain">
    {typeof message === "object" ? JSON.stringify(message, null, 2) : String(message)}
  </div>
);

const getLogComponent = (log: StreamingLog) => {
  if (typeof log.message === "string") return PlainTextMessage;
  if (log.type.startsWith("client.send")) return ClientContentLog;
  if (log.type.startsWith("server.toolCall")) return ToolCallLog;
  if (log.type.startsWith("client.toolResponse")) return ToolResponseLog;
  if (log.type.indexOf("modelTurn") !== -1 || (typeof log.message === 'object' && log.message && 'serverContent' in log.message)) return ModelTurnLog;
  return PlainTextMessage;
};

export default function Logger() {
  const { logs } = useLoggerStore();

  return (
    <div className="logger">
      <ul className="logger-list">
        {logs.map((log, i) => {
          const Component = getLogComponent(log);
          return (
            <li key={i} className={cn("log-entry", log.type.split(".")[0])}>
              <div className="log-header">
                <span className="type">{log.type}</span>
                {log.count && <span className="count">x{log.count}</span>}
                <span className="timestamp">{formatTime(log.date)}</span>
              </div>
              <Component message={log.message} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
