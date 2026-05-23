/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  MapPin, 
  CheckCircle, 
  HelpCircle, 
  ChevronRight, 
  Timer,
  AlertTriangle,
  Compass,
  ArrowRight,
  Sparkles,
  Award,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lobby, Player, GameLocation } from '../types';
import { submitGuess, nextRound, resetLobby, simulateOtherPlayerAction } from '../lib/firebase';
import { getLocationById, getRandomLocation } from '../data/locations';
import MapillaryViewer from './MapillaryViewer';
import GuessingMap from './GuessingMap';

interface GameScreenProps {
  lobby: Lobby;
  currentUserId: string;
  onLeaveGame?: () => void;
}

export default function GameScreen({ lobby, currentUserId, onLeaveGame }: GameScreenProps) {
  const [guess, setGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GameLocation | null>(null);
  
  // Scoring formulas
  const [distance, setDistance] = useState<number | null>(null);
  const [gainedPoints, setGainedPoints] = useState<number | null>(null);

  // Time Limit (60 seconds)
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Interactive Mini-map hover state
  const [isMapHovered, setIsMapHovered] = useState(false);

  const playersList = Object.values(lobby.players);
  const me = lobby.players[currentUserId];
  const isHost = lobby.hostId === currentUserId;

  // Retrieve current location details
  useEffect(() => {
    if (lobby.currentLocationId) {
      const loc = getLocationById(lobby.currentLocationId);
      setCurrentLocation(loc);
      setGuess(null);
      setShowResults(false);
      setDistance(null);
      setGainedPoints(null);
      setTimeLeft(60);
    }
  }, [lobby.currentLocationId]);

  // Handle countdown
  useEffect(() => {
    if (lobby.status !== 'playing' || showResults) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!guess) {
            handleTimeOut();
          } else {
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lobby.status, showResults, guess]);

  const handleTimeOut = () => {
    // Generate a random-ish coordinate guess close to the actual location to make it look active
    const actualLat = currentLocation?.lat || 0;
    const actualLng = currentLocation?.lng || 0;
    const dummyLat = actualLat + (Math.random() - 0.5) * 40;
    const dummyLng = actualLng + (Math.random() - 0.5) * 60;
    
    setGuess({ lat: dummyLat, lng: dummyLng });
    setTimeout(() => {
      handleSubmit({ lat: dummyLat, lng: dummyLng });
    }, 100);
  };

  // Helper: Haversine distance formula in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Turn distance to Points (Geoguessr standard curve: max 5000, tapering off)
  const calculatePoints = (distKm: number) => {
    const pts = Math.round(5000 * Math.exp(-distKm / 2000));
    return Math.max(0, pts);
  };

  const handleSubmit = async (overrideGuess?: { lat: number; lng: number }) => {
    if (!currentLocation || (!guess && !overrideGuess)) return;
    const activeGuess = overrideGuess || guess!;

    // 1. Calculate stats
    const dist = calculateDistance(
      activeGuess.lat, 
      activeGuess.lng, 
      currentLocation.lat, 
      currentLocation.lng
    );
    const pts = calculatePoints(dist);

    setDistance(dist);
    setGainedPoints(pts);
    setShowResults(true);

    // 2. Write and sync into global database/lobby
    await submitGuess(lobby.id, currentUserId, activeGuess.lat, activeGuess.lng, pts, dist);

    // 3. Auto-generate simulated responses other teammates
    playersList.forEach(p => {
      if (p.uid !== currentUserId && !p.ready) {
        setTimeout(() => {
          simulateOtherPlayerAction(lobby.id, p.uid, 'guess');
        }, Math.random() * 800 + 400);
      }
    });
  };

  const handleNextRound = async () => {
    const nextLoc = getRandomLocation();
    await nextRound(lobby.id, nextLoc.id);
  };

  const handleRestartLobby = async () => {
    await resetLobby(lobby.id);
  };

  // Status variables
  const allSubmissionsCollected = playersList.every(p => p.lastGuess !== null);

  return (
    <div className="w-full h-[calc(100vh-64px)] relative flex flex-col md:flex-row overflow-hidden bg-slate-950">
      
      {/* Top Floating Dashboard HUD */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between select-none pointer-events-none">
        
        {/* Game Stats Bar */}
        <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-4 text-xs pointer-events-auto shadow-xl">
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Раунд:</span>
            <strong className="text-white text-sm font-display">{lobby.currentRound} / {lobby.maxRounds}</strong>
          </div>
          <div className="w-[1px] h-4 bg-slate-800" />
          
          {/* TEAM BLUE TOTAL POINTS */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            <span className="text-slate-400 font-mono text-[10px]">Синие:</span>
            <strong className="text-blue-400 font-mono text-xs font-bold">{lobby.blueScore} очков</strong>
          </div>

          {/* TEAM RED TOTAL POINTS */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-red-400 rounded-full" />
            <span className="text-slate-400 font-mono text-[10px]">Красные:</span>
            <strong className="text-red-400 font-mono text-xs font-bold">{lobby.redScore} очков</strong>
          </div>

          {/* Quick Exit Button inside hud */}
          {onLeaveGame && (
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
              <button
                onClick={onLeaveGame}
                className="flex items-center gap-1 text-[10px] uppercase font-mono bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-900/40 px-2 py-1 rounded-lg transition active:scale-95 cursor-pointer pointer-events-auto"
                title="Вернуться на главный экран"
              >
                <LogOut className="w-3 h-3" />
                Выйти
              </button>
            </div>
          )}
        </div>

        {/* Timer floating alert */}
        {lobby.status === 'playing' && !showResults && (
          <div className={`bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border flex items-center gap-2 pointer-events-auto shadow-xl transition-all duration-300 ${
            timeLeft <= 15 ? 'border-rose-500/50 text-rose-400 animate-pulse' : 'border-slate-800 text-emerald-400'
          }`}>
            <Timer className="w-4 h-4" />
            <span className="font-mono text-sm font-bold">{timeLeft}с осталось</span>
          </div>
        )}
      </div>

      {/* Main street-imagery panorama / Or Full Screen map during Results screen */}
      <div className="flex-1 h-full relative z-0">
        {!showResults ? (
          // Play state: Full Screen Streetview and overlay map
          currentLocation ? (
            <MapillaryViewer 
              pKey={currentLocation.pKey} 
              locationName={undefined} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-950">
              <Compass className="w-12 h-12 text-slate-700 animate-spin" />
            </div>
          )
        ) : (
          // Results state: FULL SCREEN MAP with overlay sidebar
          <div className="absolute inset-0 w-full h-full z-10">
            {currentLocation && (
              <GuessingMap
                guess={guess}
                setGuess={() => {}}
                revealTruth={true}
                truthCoord={{ lat: currentLocation.lat, lng: currentLocation.lng }}
                disabled={true}
              />
            )}
          </div>
        )}
      </div>

      {/* OVERLAYS AND MAP CONTROLLER POPUP */}
      <AnimatePresence mode="wait">
        {!showResults ? (
          /* PLAY OVERLAY: Cool Hoverable Mini Mapping card in bottom-right corner */
          <motion.div 
            key="hoverable-map-widget"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.90, y: 30 }}
            onMouseEnter={() => setIsMapHovered(true)}
            onMouseLeave={() => setIsMapHovered(false)}
            className={`absolute right-4 bottom-4 z-20 flex flex-col bg-slate-900 border border-slate-850 rounded-[24px] overflow-hidden shadow-2xl transition-all duration-300 ease-in-out select-none pointer-events-auto ${
              isMapHovered 
                ? 'w-[90vw] md:w-[480px] h-[340px] md:h-[380px] opacity-100 scale-[1.03] ring-1 ring-emerald-500/10' 
                : 'w-[160px] md:w-[200px] h-[120px] md:h-[150px] opacity-75 hover:opacity-100'
            }`}
          >
            {/* Small title header */}
            <div className="p-2.5 bg-slate-950/95 border-b border-slate-805 flex justify-between items-center px-4 shrink-0">
              <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                Карта развертки
              </span>
              {guess && isMapHovered && (
                <span className="text-[9px] font-mono text-slate-500 hidden sm:inline">
                  Широта: {guess.lat.toFixed(1)}°
                </span>
              )}
            </div>

            {/* Guessing Leaflet inside */}
            <div className="flex-1 w-full relative min-h-0 bg-slate-950">
              <GuessingMap
                guess={guess}
                setGuess={setGuess}
                onSubmitGuess={() => handleSubmit()}
                disabled={timeLeft === 0}
              />
            </div>
          </motion.div>
        ) : (
          /* RESULT OVERLAY SIDE PANEL (Floats elegantly over the full-screen results map on the left side) */
          <motion.div
            key="round-results-floating-panel"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="absolute left-4 top-20 bottom-4 z-20 w-full max-w-[340px] bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto"
          >
            {/* Title Results Header */}
            <div className="p-4 bg-emerald-950/25 border-b border-slate-800 flex flex-col gap-1 shrink-0">
              <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 font-extrabold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                Раунд завершен!
              </span>
              
              <div className="flex justify-between items-end mt-1">
                <div>
                  <h3 className="text-base font-display font-extrabold text-white leading-tight">
                    {currentLocation?.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">{currentLocation?.country}</p>
                </div>
                
                <div className="text-right">
                  <span className="text-xs font-mono text-[#10b981] font-bold">+{gainedPoints} очков</span>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {distance ? `${Math.round(distance)} км от цели` : 'Пропущено'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable stand details */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
              {/* Translated descriptive trivia */}
              {currentLocation?.description && (
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/80 leading-relaxed text-slate-300">
                  <h4 className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1 font-bold">О месте действия</h4>
                  {currentLocation.description}
                </div>
              )}

              {/* REAL-TIME STANDINGS TABLE */}
              <div className="flex flex-col gap-1.5">
                <h4 className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1 font-extrabold">
                  РЕЗУЛЬТАТЫ ЭТОГО РАУНДА
                </h4>
                
                <div className="flex flex-col gap-2">
                  {playersList.map(player => {
                    const plGuess = player.lastGuess;
                    return (
                      <div 
                        key={player.uid}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          player.uid === currentUserId 
                            ? 'bg-emerald-950/20 border-emerald-500/25 shadow-inner' 
                            : 'bg-slate-900/35 border-slate-850'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Circle state avatar indicator */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 overflow-hidden ${player.team === 'blue' ? 'bg-blue-500/10 border border-blue-500/35' : 'bg-red-500/10 border border-red-500/25'}`}>
                            {player.avatar && player.avatar.startsWith('data:image') ? (
                              <img src={player.avatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <span>{player.avatar || '👾'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-200 truncate block text-[11px]">{player.displayName}</span>
                            <span className="text-[9px] text-slate-500 font-mono block leading-tight">
                              {plGuess ? `${Math.round(plGuess.distance)} км` : 'Без ответа'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <span className={`font-bold text-xs ${player.uid === currentUserId ? 'text-emerald-400' : 'text-slate-300'}`}>
                            +{plGuess ? plGuess.points : 0}
                          </span>
                          <span className="block text-[8px] text-slate-550">Итого: {player.score}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Next controls footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-900 flex gap-2 shrink-0">
              {lobby.status === 'round-results' ? (
                isHost ? (
                  <button
                    onClick={handleNextRound}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
                  >
                    Следующая локация
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-full py-3 bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono text-center rounded-xl animate-pulse">
                    Ко commander переключает раунд...
                  </div>
                )
              ) : lobby.status === 'ended' ? (
                <div className="w-full flex flex-col gap-2">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center text-[10px] text-slate-400">
                    🏆 Финальные результаты битвы:
                    <div className="flex justify-around mt-1.5 font-bold font-mono text-sm leading-none">
                      <span className="text-blue-400">Синие: {lobby.blueScore}</span>
                      <span className="text-red-400">Красные: {lobby.redScore}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleRestartLobby}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Вернуться в Лобби
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
