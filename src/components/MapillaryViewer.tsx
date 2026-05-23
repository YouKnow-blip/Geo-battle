/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Eye, RefreshCw, Compass, AlertTriangle, ExternalLink, HelpCircle } from 'lucide-react';

interface MapillaryViewerProps {
  pKey: string;
  locationName?: string;
}

const MAPILLARY_ACCESS_TOKEN = 'MLY|27176106415316139|e6480aea39d1ce858e6b9948f8af4a4a';

export default function MapillaryViewer({ pKey, locationName }: MapillaryViewerProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const viewerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let localViewer: any = null;

    const loadAssets = async () => {
      // 1. Check & Inject Mapillary CSS
      if (!document.getElementById('mapillary-css')) {
        const link = document.createElement('link');
        link.id = 'mapillary-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/mapillary-js@4.1.0/dist/mapillary.css';
        document.head.appendChild(link);
      }

      // 2. Check & Inject Mapillary JS script
      if (!(window as any).Mapillary) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.id = 'mapillary-js-sdk';
          script.src = 'https://unpkg.com/mapillary-js@4.1.0/dist/mapillary.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Mapillary JS SDK script load failure'));
          document.body.appendChild(script);
        });
      }
    };

    setLoading(true);
    setLoadError(null);

    loadAssets()
      .then(() => {
        if (!active) return;
        if (!(window as any).Mapillary) {
          throw new Error('SDK not configured');
        }

        const Mapillary = (window as any).Mapillary;

        try {
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'w-full h-full absolute inset-0';
            canvasWrapper.style.width = '100%';
            canvasWrapper.style.height = '100%';
            canvasWrapper.style.position = 'absolute';
            canvasWrapper.style.top = '0';
            canvasWrapper.style.left = '0';
            containerRef.current.appendChild(canvasWrapper);

            // Initialize premium MapillaryJS Viewer component
            const viewer = new Mapillary.Viewer({
              accessToken: MAPILLARY_ACCESS_TOKEN,
              container: canvasWrapper,
              imageId: pKey,
              component: {
                cover: false,
                direction: true,
                sequence: false,
              },
            });

            viewerRef.current = viewer;
            localViewer = viewer;

            // Mark loaded upon successful image load
            viewer.on('image', () => {
              if (active) {
                setLoading(false);
                setLoadError(null);
              }
            });

            // Catch errors & transition failures
            viewer.on('error', (err: any) => {
              console.warn('Mapillary SDK inner error:', err);
              // Do NOT fall back to iframe here as iframe is blocked by X-Frame-Options anyway.
              // Instead, if the image fails to load after some time, let's keep retrying or just ignore minor warnings.
            });
          }
        } catch (err: any) {
          console.warn('Native WebGL initialization error:', err);
          if (active) {
            setLoadError(err?.message || 'WebGL initialization failed');
            setLoading(false);
          }
        }
      })
      .catch((err) => {
        console.warn('Loading mapillary JS dynamic script failed', err);
        if (active) {
          setLoadError('Failed to load Mapillary JS SDK script');
          setLoading(false);
        }
      });

    // Timeout fallback if it hangs forever (e.g., inside restricted sandboxes where WebGL context creation fails silently)
    const timeoutId = setTimeout(() => {
      if (active && loading && !loadError) {
        // Just verify if mapillary-js loaded. If still loading, WebGL is likely stuck.
        console.warn('Mapillary take longer than usual to load.');
      }
    }, 12000);

    return () => {
      active = false;
      clearTimeout(timeoutId);
      if (localViewer) {
        try {
          localViewer.remove();
        } catch (e) {
          // Silent safe swallow
        }
      }
      viewerRef.current = null;
    };
  }, [pKey]);

  // Direct panoramic web URL as helper fallback link
  const originalPanoramaUrl = `https://www.mapillary.com/app/?imageId=${pKey}`;

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col" id="mapillary-container">
      {/* Top Banner instructions */}
      <div className="absolute top-4 left-4 z-10 bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 text-slate-100 flex items-center gap-3 shadow-lg pointer-events-none max-w-sm sm:max-w-md">
        <Compass className="w-5 h-5 text-teal-400 animate-pulse shrink-0" />
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-teal-400">Mapillary Panorama</h3>
          <p className="text-xs font-semibold tracking-tight text-slate-200">
            {locationName ? `Clue: ${locationName}` : 'Explore the panorama to identify signs & architecture cues!'}
          </p>
        </div>
      </div>

      {/* Embed or native viewer frame */}
      <div className="relative flex-1 bg-slate-950">
        {loading && !loadError && (
          <div className="absolute inset-0 z-20 bg-slate-950/90 flex flex-col items-center justify-center text-slate-400 gap-4 backdrop-blur-sm">
            <RefreshCw className="w-10 h-10 animate-spin text-teal-400" />
            <div className="text-center">
              <p className="font-mono text-xs tracking-wider uppercase text-teal-400">Loading Street Panorama...</p>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">ID: {pKey}</p>
            </div>
          </div>
        )}

        {loadError ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-slate-300 p-6 text-center bg-slate-900 border border-slate-800 rounded-xl m-4 gap-4 overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="max-w-md space-y-2">
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                WebGL Connection Restricted / Ограничение подключения
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                По соображениям безопасности сайт <code className="bg-slate-950 px-1 py-0.5 rounded text-rose-400 font-mono text-[10.5px]">Mapillary</code> запрещает прямое встраивание через <code className="bg-slate-950 px-1 py-0.5 rounded text-rose-400 font-mono text-[10.5px]">Iframe</code> (вызывая ошибку сопряжения).
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Наш плеер использует интерактивный WebGL, который может блокироваться внутренними политиками безопасности песочницы вашего браузера.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <a
                href={originalPanoramaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-teal-950/30 text-center"
              >
                Открыть панораму <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95 border border-slate-700 cursor-pointer"
              >
                Обновить / Retry
              </button>
            </div>

            <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/80 text-[10px] text-slate-500 max-w-sm leading-normal text-left">
              <div className="flex gap-2 items-start font-mono">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip:</strong> Чтобы убрать любые ограничения, нажмите на кнопку <strong>"Open App in a New Tab" / "Поделиться"</strong> в правом верхнем углу интерфейса AI Studio, чтобы запустить игру независимо!
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" id="mly-native-container" />
        )}
      </div>

      {/* Bottom info banner */}
      <div className="bg-slate-950 border-t border-slate-800 py-2.5 px-4 flex justify-between items-center text-[10px] text-slate-400 select-none font-mono">
        <span className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-slate-400 font-bold" />
          Native Mapillary Live WebGL Viewer
        </span>
        <span className="text-slate-500 flex items-center gap-1">
          Powered by
          <a 
            href="https://www.mapillary.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-teal-400 hover:underline font-semibold"
          >
            Mapillary
          </a>
        </span>
      </div>
    </div>
  );
}
