import React, { useEffect, useRef } from "react";
import cn from "classnames";
import "./auralis-voice-circle.scss";

interface AuralisVoiceCircleProps {
  active: boolean;
  volume: number;
}

export const AuralisVoiceCircle = ({ active, volume }: AuralisVoiceCircleProps) => {
  const circleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (circleRef.current) {
      // Scale the circle based on volume. 
      // volume is usually 0 to 1, but we amplify it for visual effect
      const scale = 1 + Math.sqrt(volume) * 1.8; 
      circleRef.current.style.transform = `scale(${scale})`;
      circleRef.current.style.opacity = `${0.5 + Math.min(volume * 2, 0.5)}`;
    }
  }, [volume]);

  return (
    <div className={cn("auralis-voice-circle-container", { active })}>
      <div className="auralis-voice-circle" ref={circleRef} />
      <div className="auralis-voice-circle-glow" />
    </div>
  );
};
