
import React from 'react';
import Select from 'react-select';
import { useAppStore } from '../../store/app-store';
import { PERSONALITY_DISPLAY_NAMES, Personality } from '../../lib/personalities';

interface PersonalitySelectorProps {
  disabled?: boolean;
}

const personalityOptions = Object.entries(PERSONALITY_DISPLAY_NAMES).map(([key, name]) => ({
  value: key as Personality,
  label: name,
}));

export default function PersonalitySelector({ disabled }: PersonalitySelectorProps) {
  const { selectedPersonality, setSelectedPersonality } = useAppStore();

  const selectedOption = personalityOptions.find(o => o.value === selectedPersonality);

  return (
    <div className="setting-row" title="Choose the personality of your AI assistant.">
      <div className="label-group">
        <label>Personality</label>
        <span>Customize how Auralis interacts with you</span>
      </div>
      <div className="select-wrapper" style={{ width: '200px' }}>
        <Select
          className="react-select"
          classNamePrefix="react-select"
          value={selectedOption}
          options={personalityOptions}
          isSearchable={false}
          isDisabled={disabled}
          menuPortalTarget={document.body}
          styles={{
            menuPortal: base => ({ ...base, zIndex: 9999 })
          }}
          onChange={(option) => {
            if (option) {
              setSelectedPersonality(option.value);
            }
          }}
        />
      </div>
    </div>
  );
}
