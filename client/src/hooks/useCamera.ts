import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps getUserMedia. Works the same way on a MacBook Air's built-in webcam,
 * an iPhone's rear camera in Safari, or an Android-based device browser
 * (e.g. Rokid smart glasses) — anything exposing a standard camera to the
 * browser. Requires a secure context (https, or localhost) per the Web spec.
 */
export function useCamera(facingMode: "environment" | "user" = "environment") {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("このブラウザ/デバイスではカメラAPIが利用できません");
      return;
    }
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [facingMode, stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, start, stop, active, error };
}
