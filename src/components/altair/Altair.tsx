import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { LiveClientToolResponse, LiveServerToolCall } from "@google/genai";
import { ALTAIR_TOOL_DECLARATION } from "../../config";
import cn from "classnames";
import "./altair.scss";

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, connected } = useLiveAPIContext();

  useEffect(() => {
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === ALTAIR_TOOL_DECLARATION.name
      );
      // Only handle and respond to render_altair. All other tool calls are
      // handled by use-live-api.ts — responding here would send a duplicate
      // tool response and corrupt the AI's conversation state.
      if (fc && connected) {
        const args = fc.args as { json_graph: string };
        setJSONString(args.json_graph);
        client?.sendToolResponse({
          functionResponses: [{
            response: { output: { success: true } },
            id: fc.id,
            name: fc.name,
          }],
        });
      }
    };
    client?.on("toolcall", onToolCall);
    return () => {
      client?.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      const render = async () => {
        try {
          const spec = JSON.parse(jsonString);
          // Force responsiveness
          spec.width = "container";
          spec.height = "container";
          spec.autosize = { type: "fit", contains: "padding" };
          
          if (!spec.background) spec.background = "transparent";

          // Small delay to ensure container is visible and has dimensions
          // This fixes the issue where charts are empty on first render
          await new Promise(resolve => setTimeout(resolve, 100));

          await vegaEmbed(embedRef.current!, spec, {
            actions: { export: true, source: false, compiled: false, editor: false },
            renderer: "canvas",
          });
        } catch (e) {
          console.error("Failed to parse or render Vega spec", e);
        }
      };
      render();
    }
  }, [embedRef, jsonString]);

  // If we have a chart, show it in a floating container
  return (
    <div className={cn("altair-container", { visible: !!jsonString })}>
      {jsonString && (
        <button className="close-button" onClick={() => setJSONString("")}>
          <span className="material-symbols-outlined">close</span>
        </button>
      )}
      <div className="vega-embed" ref={embedRef} />
    </div>
  );
}

export const Altair = memo(AltairComponent);
