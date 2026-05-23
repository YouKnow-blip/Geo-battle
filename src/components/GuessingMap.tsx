/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Compass, CheckCircle2 } from 'lucide-react';

interface GuessingMapProps {
  guess: { lat: number; lng: number } | null;
  setGuess: (g: { lat: number; lng: number }) => void;
  revealTruth?: boolean;
  truthCoord?: { lat: number; lng: number } | null;
  onSubmitGuess?: () => void;
  disabled?: boolean;
}

export default function GuessingMap({
  guess,
  setGuess,
  revealTruth = false,
  truthCoord = null,
  onSubmitGuess,
  disabled = false,
}: GuessingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const guessMarkerRef = useRef<L.Marker | null>(null);
  const truthMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  const [mapReady, setMapReady] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create Leaflet Map centered on a neutral view
    const leafletMap = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 1.8,
      zoomControl: true,
      minZoom: 1,
      worldCopyJump: true,
    });

    // Sleek, stylish slate-dark themed tile layer by CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &amp; CartoDB',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(leafletMap);

    mapRef.current = leafletMap;
    setMapReady(true);

    // Click Listener
    leafletMap.on('click', (e: L.LeafletMouseEvent) => {
      if (disabled || revealTruth) return;
      
      const { lat, lng } = e.latlng;
      
      // Normalise longitude within [-180, 180]
      const normalizedLng = ((lng + 180) % 360 + 360) % 360 - 180;
      setGuess({ lat, lng: normalizedLng });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [disabled, revealTruth, setGuess]);

  // Handle Resize beautifully
  useEffect(() => {
    if (!mapRef.current) return;
    
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [mapReady]);

  // Update or draw Guess Marker
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    if (guess) {
      const position = L.latLng(guess.lat, guess.lng);

      if (guessMarkerRef.current) {
        guessMarkerRef.current.setLatLng(position);
      } else {
        // Red glowing guess pin using DivIcon to avoid asset-path loading failures
        const guessIcon = L.divIcon({
          className: 'custom-pin-guess',
          html: `
            <div class="relative flex items-center justify-center">
              <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-rose-400 opacity-75"></span>
              <div class="relative bg-rose-500 text-white rounded-full p-1.5 border border-white shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        guessMarkerRef.current = L.marker(position, { icon: guessIcon }).addTo(mapRef.current);
      }

      // Smooth pan to guess if guess is fresh list
      if (!revealTruth) {
        mapRef.current.panTo(position);
      }
    } else {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.remove();
        guessMarkerRef.current = null;
      }
    }
  }, [guess, mapReady, revealTruth]);

  // Draw Truth Pin and connection line when revealed
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    if (revealTruth && truthCoord) {
      const truthPos = L.latLng(truthCoord.lat, truthCoord.lng);

      // 1. Draw modern green correct-answer marker
      if (!truthMarkerRef.current) {
        const truthIcon = L.divIcon({
          className: 'custom-pin-truth',
          html: `
            <div class="relative flex items-center justify-center">
              <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-emerald-400 opacity-60"></span>
              <div class="relative bg-emerald-500 text-white rounded-full p-1.5 border border-white shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        truthMarkerRef.current = L.marker(truthPos, { icon: truthIcon }).addTo(mapRef.current);
      } else {
        truthMarkerRef.current.setLatLng(truthPos);
      }

      // 2. Draw connecting dashed polyline
      if (guess) {
        const guessPos = L.latLng(guess.lat, guess.lng);

        if (lineRef.current) {
          lineRef.current.setLatLngs([guessPos, truthPos]);
        } else {
          lineRef.current = L.polyline([guessPos, truthPos], {
            color: '#10b981', // emerald color
            weight: 3,
            dashArray: '8, 8',
            opacity: 0.8,
          }).addTo(mapRef.current);
        }

        // Adjust map bounds to encapsulate both points beautiful
        const bounds = L.latLngBounds([guessPos, truthPos]);
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      } else {
        mapRef.current.setView(truthPos, 4);
      }
    } else {
      // Remove Truth markers and lines
      if (truthMarkerRef.current) {
        truthMarkerRef.current.remove();
        truthMarkerRef.current = null;
      }
      if (lineRef.current) {
        lineRef.current.remove();
        lineRef.current = null;
      }
    }
  }, [revealTruth, truthCoord, guess, mapReady]);

  // Center on guess when button clicked
  const centerOnGuess = () => {
    if (mapRef.current && guess) {
      mapRef.current.setView([guess.lat, guess.lng], 5);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Target Marker UI Header / Hint */}
      {!revealTruth && (
        <div className="absolute top-3 left-3 z-10 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 pointer-events-none flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-rose-500 animate-spin" style={{ animationDuration: '6s' }} />
          {guess ? 'Position locked. Adjust if needed.' : 'Click any place to drop your guess pin'}
        </div>
      )}

      {/* Map Canvas div */}
      <div ref={containerRef} className="flex-1 w-full h-full z-0 min-h-[220px]" />

      {/* Controller Buttons Bar */}
      <div className="absolute bottom-3 left-3 z-10 flex gap-2">
        {guess && !revealTruth && (
          <button
            onClick={centerOnGuess}
            className="p-2 bg-slate-950 hover:bg-slate-900 text-slate-200 hover:text-white rounded-lg border border-slate-800 shadow-md transition-all active:scale-95 text-xs font-mono flex items-center gap-1.5"
            title="Focus guess marker"
          >
            <Navigation className="w-3.5 h-3.5 text-rose-500 rotate-45" />
            My Pin
          </button>
        )}
      </div>

      {onSubmitGuess && guess && !revealTruth && !disabled && (
        <div className="absolute bottom-3 right-3 z-10">
          <button
            onClick={onSubmitGuess}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold uppercase tracking-wider rounded-lg shadow-lg shadow-rose-950/40 hover:shadow-rose-600/25 border border-rose-500 hover:border-rose-400 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm Guess
          </button>
        </div>
      )}
    </div>
  );
}
