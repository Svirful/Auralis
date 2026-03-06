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

import "./react-select.scss";
import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { RiSidebarFoldLine, RiSidebarUnfoldLine } from "react-icons/ri";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useLoggerStore } from "../../lib/store-logger";
import Logger from "../logger/Logger";
import "./side-panel.scss";

export default function SidePanel() {
  const { connected, client } = useLiveAPIContext();
  const [open, setOpen] = useState(true);
  const loggerRef = useRef<HTMLDivElement>(null);
  const loggerLastHeightRef = useRef<number>(-1);
  const { logs } = useLoggerStore();

  const [textInput, setTextInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  //scroll the log to the bottom when new logs come in
  useEffect(() => {
    if (loggerRef.current) {
      const el = loggerRef.current;
      const scrollHeight = el.scrollHeight;
      if (scrollHeight !== loggerLastHeightRef.current) {
        el.scrollTop = scrollHeight;
        loggerLastHeightRef.current = scrollHeight;
      }
    }
  }, [logs]);

  const handleSubmit = () => {
    if (!connected) return;
    client?.send([{ text: textInput }]);

    setTextInput("");
    if (inputRef.current) {
      inputRef.current.innerText = "";
    }
  };

  return (
    <div className={`side-panel ${open ? "open" : ""}`}>
      <header className="top">
        <h2>Auralis</h2>
        <button className="opener" onClick={() => setOpen(!open)}>
          {open ? (
            <RiSidebarFoldLine size={24} />
          ) : (
            <RiSidebarUnfoldLine size={24} />
          )}
        </button>
      </header>
      <section className="indicators">
        <div className={cn("streaming-indicator", { connected })}>
          {connected ? (
            <>
              <span className="dot connected"></span>
              {open && "Streaming"}
            </>
          ) : (
            <>
              <span className="dot paused"></span>
              {open && "Paused"}
            </>
          )}
        </div>
      </section>
      <div className="side-panel-container" ref={loggerRef}>
        <Logger />
      </div>
      <div className={cn("input-container", { disabled: !connected })}>
        <div className="input-content">
          <textarea
            className="input-area"
            ref={inputRef}
            placeholder="Type something..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            onChange={(e) => setTextInput(e.target.value)}
            value={textInput}
          ></textarea>
          <button
            className="send-button material-symbols-outlined filled"
            onClick={handleSubmit}
            disabled={!textInput.trim() || !connected}
          >
            arrow_upward
          </button>
        </div>
      </div>
    </div>
  );
}
