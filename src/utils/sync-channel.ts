export const SYNC_CHANNEL_NAME = 'auralis-sync';

export type AuralisState = {
  connected: boolean;
  volume: number; // Output volume (AI)
  muted: boolean;
  isStreaming: boolean;
  inputVolume: number; // Input volume (User)
  activeWebcam: boolean;
};

export type SyncMessage = 
  | { type: 'state-update'; state: Partial<AuralisState> }
  | { type: 'command'; cmd: 'connect' | 'disconnect' | 'request-state' | 'toggleScreenShare' | 'toggleWebcam' }
  | { type: 'command'; cmd: 'setMuted'; data: boolean };

export const syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
