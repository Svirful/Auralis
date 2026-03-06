import { useCallback, useState } from "react";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { Modality } from "@google/genai";

export default function ResponseModalitySelector() {
  const { config, setConfig, model } = useLiveAPIContext();
  const isNativeAudioModel = model.includes("native-audio");

  const responseOptions = [
    { value: "audio", label: "audio" },
    ...(isNativeAudioModel ? [] : [{ value: "text", label: "text" }]),
  ];

  const [selectedOption, setSelectedOption] = useState<{
    value: string;
    label: string;
  } | null>(responseOptions[0]);

  const updateConfig = useCallback(
    (modality: "audio" | "text") => {
      setConfig({
        ...config,
        responseModalities: [
          modality === "audio" ? Modality.AUDIO : Modality.TEXT,
        ],
      });
    },
    [config, setConfig]
  );

  return (
    <div className="select-group">
      <label htmlFor="response-modality-selector">Response modality</label>
      <Select
        id="response-modality-selector"
        className="react-select"
        classNamePrefix="react-select"
        defaultValue={selectedOption}
        options={responseOptions}
        isSearchable={false}
        onChange={(e) => {
          setSelectedOption(e);
          if (e && (e.value === "audio" || e.value === "text")) {
            updateConfig(e.value);
          }
        }}
      />
    </div>
  );
}
