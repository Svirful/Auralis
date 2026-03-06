import { useCallback, useEffect, useState } from "react";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";

const voiceOptions = [
  { value: "Zephyr", label: "Zephyr - Bright" },
  { value: "Kore", label: "Kore - Firm" },
  { value: "Orus", label: "Orus - Firm" },
  { value: "Autonoe", label: "Autonoe - Bright" },
  { value: "Umbriel", label: "Umbriel - Easy-going" },
  { value: "Erinome", label: "Erinome - Clear" },
  { value: "Laomedeia", label: "Laomedeia - Upbeat" },
  { value: "Schedar", label: "Schedar - Even" },
  { value: "Achird", label: "Achird - Friendly" },
  { value: "Sadachbia", label: "Sadachbia - Lively" },
  { value: "Puck", label: "Puck - Upbeat" },
  { value: "Fenrir", label: "Fenrir - Excitable" },
  { value: "Aoede", label: "Aoede - Breezy" },
  { value: "Enceladus", label: "Enceladus - Breathy" },
  { value: "Algieba", label: "Algieba - Smooth" },
  { value: "Algenib", label: "Algenib - Gravelly" },
  { value: "Achernar", label: "Achernar - Soft" },
  { value: "Gacrux", label: "Gacrux - Mature" },
  { value: "Zubenelgenubi", label: "Zubenelgenubi - Casual" },
  { value: "Sadaltager", label: "Sadaltager - Knowledgeable" },
  { value: "Charon", label: "Charon - Informative" },
  { value: "Leda", label: "Leda - Youthful" },
  { value: "Callirrhoe", label: "Callirrhoe - Easy-going" },
  { value: "Iapetus", label: "Iapetus - Clear" },
  { value: "Despina", label: "Despina - Smooth" },
  { value: "Rasalgethi", label: "Rasalgethi - Informative" },
  { value: "Alnilam", label: "Alnilam - Firm" },
  { value: "Pulcherrima", label: "Pulcherrima - Forward" },
  { value: "Vindemiatrix", label: "Vindemiatrix - Gentle" },
  { value: "Sulafat", label: "Sulafat - Warm" },
];

export default function VoiceSelector() {
  const { config, setConfig, selectedVoice, setSelectedVoice } = useLiveAPIContext();

  const [selectedOption, setSelectedOption] = useState<{
    value: string;
    label: string;
  } | null>(null);

  const updateConfig = useCallback(
    (voiceName: string) => {
      setConfig({
        ...config,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      });
    },
    [config, setConfig]
  );

  useEffect(() => {
    const voiceOption = voiceOptions.find(o => o.value === selectedVoice) || voiceOptions[4]; // Default to Aoede
    setSelectedOption(voiceOption);
    
    // Also sync config if it differs
    const currentVoiceInConfig = config.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName;
    if (currentVoiceInConfig !== selectedVoice) {
      updateConfig(selectedVoice);
    }
  }, [selectedVoice, config.speechConfig, updateConfig]);

  return (
    <div className="select-group">
      <label htmlFor="voice-selector">Voice</label>
      <Select
        id="voice-selector"
        className="react-select"
        classNamePrefix="react-select"
        value={selectedOption}
        options={voiceOptions}
        isSearchable={false}
        menuPortalTarget={document.body}
        styles={{
          menuPortal: base => ({ ...base, zIndex: 9999 })
        }}
        onChange={(e) => {
          if (e) {
            setSelectedVoice(e.value);
            updateConfig(e.value);
          }
        }}
      />
    </div>
  );
}
