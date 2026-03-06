import { useEffect, useState } from "react";
import Select from "react-select";

interface DeviceOption {
  value: string;
  label: string;
}

interface AudioDeviceSelectorProps {
  label: string;
  kind: "audioinput" | "audiooutput";
  selectedDeviceId: string | null;
  onDeviceChange: (deviceId: string) => void;
}

export default function AudioDeviceSelector({
  label,
  kind,
  selectedDeviceId,
  onDeviceChange,
}: AudioDeviceSelectorProps) {
  const [devices, setDevices] = useState<DeviceOption[]>([]);

  useEffect(() => {
    const updateDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const hasLabels = allDevices.some(d => d.label);
        
        if (!hasLabels) {
          // Request permissions to get labels, then stop the stream immediately
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          
          // Re-enumerate to get labeled devices
          const labeledDevices = await navigator.mediaDevices.enumerateDevices();
          setDevices(processDevices(labeledDevices, kind));
        } else {
          setDevices(processDevices(allDevices, kind));
        }
      } catch (error) {
        console.error("Error enumerating devices:", error);
      }
    };

    const processDevices = (allDevices: MediaDeviceInfo[], kind: string) => {
      return allDevices
        .filter((device) => device.kind === kind)
        .map((device) => ({
          value: device.deviceId,
          label: device.label || `${kind} ${device.deviceId.slice(0, 5)}`,
        }));
    };

    updateDevices();
    navigator.mediaDevices.addEventListener("devicechange", updateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", updateDevices);
    };
  }, [kind]);

  const selectedOption = devices.find((d) => d.value === selectedDeviceId) || null;

  return (
    <div className="select-group">
      <label>{label}</label>
      <Select
        className="react-select"
        classNamePrefix="react-select"
        options={devices}
        value={selectedOption}
        menuPortalTarget={document.body}
        styles={{
          menuPortal: base => ({ ...base, zIndex: 9999 })
        }}
        isSearchable={false}
        onChange={(option) => option && onDeviceChange(option.value)}
        placeholder={`Select ${label}...`}
      />
    </div>
  );
}
