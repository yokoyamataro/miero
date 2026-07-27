"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignatureData {
  blob: Blob;
  signedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  getSignature: () => Promise<SignatureData | null>;
}

async function getGeolocation(): Promise<{
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { latitude: null, longitude: null, accuracy: null };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve({ latitude: null, longitude: null, accuracy: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export const SignaturePad = forwardRef<SignaturePadHandle>(
  function SignaturePad(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasStrokeRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [hasStroke, setHasStroke] = useState(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let savedDataUrl: string | null = null;

      const setupCanvas = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width === 0 || height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (savedDataUrl) {
          const img = new window.Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
          };
          img.src = savedDataUrl;
        }
      };

      setupCanvas();

      // 描画中はサイズ変化を反映しない
      const observer = new ResizeObserver(() => {
        if (drawingRef.current) return;
        if (hasStrokeRef.current) {
          savedDataUrl = canvas.toDataURL("image/png");
        }
        setupCanvas();
      });
      observer.observe(canvas);
      return () => observer.disconnect();
    }, []);

    const getPos = (e: React.PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      // canvas に対する視覚位置 → 内部座標
      const scaleX = rect.width === 0 ? 1 : canvas.clientWidth / rect.width;
      const scaleY = rect.height === 0 ? 1 : canvas.clientHeight / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPointRef.current = getPos(e);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const p = getPos(e);
      const last = lastPointRef.current;
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      lastPointRef.current = p;
      if (!hasStrokeRef.current) {
        hasStrokeRef.current = true;
        setHasStroke(true);
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      drawingRef.current = false;
      lastPointRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      hasStrokeRef.current = false;
      setHasStroke(false);
    };

    useImperativeHandle(ref, () => ({
      isEmpty: () => !hasStrokeRef.current,
      clear: handleClear,
      getSignature: async () => {
        if (!hasStrokeRef.current) return null;
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/png");
        });
        if (!blob) return null;
        const geo = await getGeolocation();
        return {
          blob,
          signedAt: new Date().toISOString(),
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracy: geo.accuracy,
        };
      },
    }));

    return (
      <div className="space-y-2">
        <div className="border rounded-md overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-40 block touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            指またはペンで枠内に署名してください。フォーム保存時に日時と現在地を記録します。
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!hasStroke}
          >
            <Eraser className="h-4 w-4 mr-1" />
            クリア
          </Button>
        </div>
      </div>
    );
  }
);
