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

import { useCallback, useEffect, useState } from 'react';
import { UseMediaStreamResult } from './use-media-stream-mux';

export function useScreenCapture(): UseMediaStreamResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const start = useCallback(async (sourceId?: string) => {
    try {
      if (sourceId && (window as any).electron) {
        (window as any).electron.setSelectedSource(sourceId);
      }
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setStream(mediaStream);
      setIsStreaming(true);
      return mediaStream;
    } catch (error) {
      console.error('Error starting screen capture:', error);
      setStream(null);
      setIsStreaming(false);
      throw error;
    }
  }, []);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);

  useEffect(() => {
    const handleStreamEnded = () => {
      setStream(null);
      setIsStreaming(false);
    };
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', handleStreamEnded);
      });

      return () => {
        stream.getTracks().forEach((track) => {
          track.removeEventListener('ended', handleStreamEnded);
        });
      };
    }
  }, [stream]);

  return {
    type: 'screen',
    start,
    stop,
    isStreaming,
    stream,
  };
}
