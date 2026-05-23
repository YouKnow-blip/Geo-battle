/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  Users, 
  User as UserIcon, 
  ArrowRight, 
  Gamepad2, 
  Globe2, 
  LogOut, 
  Trophy, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  UserPlus,
  Music,
  Volume2,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lobby, Player, Team } from './types';
import { createLobby, joinLobby, subscribeToLobby, isFirebaseEnabled } from './lib/firebase';
import { getRandomLocation } from './data/locations';
import LobbyRoom from './components/LobbyRoom';
import GameScreen from './components/GameScreen';

export default function App() {
  // Profiles authentication state
  const [user, setUser] = useState<{ uid: string; displayName: string; color: string; avatar?: string } | null>(null);
  const [regName, setRegName] = useState('');
  const [avatarColor, setAvatarColor] = useState('from-emerald-400 to-teal-500');
  const [selectedAvatar, setSelectedAvatar] = useState('👾'); // Preset emoji or base64 data URL

  // Lobby states
  const [lobbyIdInput, setLobbyIdInput] = useState('');
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [activeLobbyId, setActiveLobbyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Solo mode state
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [soloLobby, setSoloLobby] = useState<Lobby | null>(null);

  // Melodic background music state
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.25);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Avatar Presets
  const avatarPresets = ['👾', '🤖', '🦊', '🕵️', '🚀', '🌍', '🦖', '😼'];

  // Initialize and load background music
  useEffect(() => {
    audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = musicVolume;

    const savedVolume = localStorage.getItem('geoguessr_music_volume');
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      setMusicVolume(vol);
      audioRef.current.volume = vol;
    }

    const savedPlayStatus = localStorage.getItem('geoguessr_music_playing');
    if (savedPlayStatus === 'true') {
      // Browsers block autoplay, so we prepare to play on next user interaction
      const startOnInteraction = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            setIsPlayingMusic(true);
          }).catch(() => {});
        }
        window.removeEventListener('click', startOnInteraction);
      };
      window.addEventListener('click', startOnInteraction);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update audio volume and persist setting
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
      localStorage.setItem('geoguessr_music_volume', musicVolume.toString());
    }
  }, [musicVolume]);

  const handleToggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlayingMusic) {
      audioRef.current.pause();
      setIsPlayingMusic(false);
      localStorage.setItem('geoguessr_music_playing', 'false');
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingMusic(true);
        localStorage.setItem('geoguessr_music_playing', 'true');
      }).catch(err => {
        console.warn('Playback blocked by browser autoplay policy.', err);
      });
    }
  };

  // Retreive existing local account on launch
  useEffect(() => {
    const cachedUser = localStorage.getItem('geoguessr_user_profile');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setUser(parsed);
        if (parsed.avatar) {
          setSelectedAvatar(parsed.avatar);
        }
      } catch (err) {
        localStorage.removeItem('geoguessr_user_profile');
      }
    }
  }, []);

  // Custom Avatar upload and converter
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024) {
      alert('Файл слишком большой! Пожалуйста, выберите картинку размером не более 250 КБ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setSelectedAvatar(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  // Sync lobby data in real-time when active
  useEffect(() => {
    if (!activeLobbyId) {
      setActiveLobby(null);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToLobby(activeLobbyId, (lobbyData) => {
      setLoading(false);
      if (lobbyData) {
        setActiveLobby(lobbyData);
        setErrorMsg(null);
      } else {
        setActiveLobby(null);
        setActiveLobbyId(null);
        setErrorMsg('Лобби не найдено или истек срок его действия.');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeLobbyId]);

  // Handle register submission
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;

    const newProfile = {
      uid: `usr_${Math.random().toString(36).substring(2, 9)}`,
      displayName: regName.trim(),
      color: avatarColor,
      avatar: selectedAvatar
    };

    setUser(newProfile);
    localStorage.setItem('geoguessr_user_profile', JSON.stringify(newProfile));

    // Quietly trigger sound if permitted on first active submit
    if (audioRef.current && !isPlayingMusic) {
      audioRef.current.play().then(() => {
        setIsPlayingMusic(true);
        localStorage.setItem('geoguessr_music_playing', 'true');
      }).catch(() => {});
    }
  };

  // Sign out
  const handleSignOut = () => {
    setUser(null);
    setActiveLobbyId(null);
    setIsSoloMode(false);
    localStorage.removeItem('geoguessr_user_profile');
  };

  // Create lobby
  const handleCreateLobby = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    // Generate random 4-digit code
    const generatedCode = `BTL-${Math.floor(1000 + Math.random() * 9000)}`;
    const startLoc = getRandomLocation();

    try {
      await createLobby(generatedCode, user.uid, user.displayName, 5, startLoc.id, user.avatar, user.color);
      setActiveLobbyId(generatedCode);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Не удалось создать лобби. Пожалуйста, попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  // Join lobby
  const handleJoinLobbyByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lobbyIdInput.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    const formattedCode = lobbyIdInput.trim().toUpperCase();

    try {
      await joinLobby(formattedCode, user.uid, user.displayName, user.avatar, user.color);
      setActiveLobbyId(formattedCode);
    } catch (err: any) {
      let rawMsg = 'Не удалось подключиться. Проверьте код лобби или лимит игроков (макс. 4).';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          rawMsg = parsed.error || rawMsg;
        } catch (_) {
          rawMsg = err.message;
        }
      }
      setErrorMsg(rawMsg);
    } finally {
      setLoading(false);
    }
  };

  // Start single player solo game (represented locally using simulated lobby structure)
  const handleStartSoloPlay = () => {
    if (!user) return;
    
    setErrorMsg(null);
    const mockLobbyId = `SOLO-${Date.now().toString(36).toUpperCase()}`;
    const startLoc = getRandomLocation();

    const initialPlayer: Player = {
      uid: user.uid,
      displayName: user.displayName,
      team: 'blue',
      isHost: true,
      ready: false,
      score: 0,
      lastGuess: null,
      avatar: user.avatar,
      color: user.color
    };

    const newSoloLobby: Lobby = {
      id: mockLobbyId,
      hostId: user.uid,
      players: { [user.uid]: initialPlayer },
      status: 'playing',
      currentRound: 1,
      maxRounds: 5,
      currentLocationId: startLoc.id,
      elapsedTime: 60,
      blueScore: 0,
      redScore: 0,
      createdAt: Date.now()
    };

    setSoloLobby(newSoloLobby);
    setIsSoloMode(true);
  };

  const handleLeaveGame = () => {
    setActiveLobbyId(null);
    setIsSoloMode(false);
    setSoloLobby(null);
    setErrorMsg(null);
  };

  const avatarColors = [
    { value: 'from-emerald-400 to-teal-500', name: 'Изумрудный' },
    { value: 'from-blue-500 to-cyan-400', name: 'Небесный' },
    { value: 'from-rose-500 to-pink-500', name: 'Карминный' },
    { value: 'from-violet-600 to-purple-500', name: 'Цвета Космоса' },
    { value: 'from-amber-400 to-orange-500', name: 'Солнечный' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans" id="app-root-container">
      
      {/* Dynamic Global Top Bar */}
      <header className="bg-slate-900 border-b border-slate-800 h-16 px-4 sm:px-8 flex items-center justify-between z-30 shadow-md">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={handleLeaveGame}>
          <div className="bg-emerald-500/10 p-1.5 rounded-xl border border-emerald-500/30">
            <Compass className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
            Geo-Battle Arena
          </span>
        </div>

        {/* Sync Server Indicators, Music widget & profile info */}
        <div className="flex items-center gap-3">
          
          {/* Melodic Background Music Controller */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-full border border-slate-800 text-xs">
            <button
              onClick={handleToggleMusic}
              className="p-1 text-slate-400 hover:text-emerald-400 transition cursor-pointer"
              title={isPlayingMusic ? "Пауза музыки" : "Включить мелодию"}
            >
              {isPlayingMusic ? (
                <div className="flex gap-0.5 items-end h-3.5 w-3.5">
                  <span className="w-0.5 bg-emerald-400 animate-pulse h-2.5" style={{ animationDuration: '0.6s' }} />
                  <span className="w-0.5 bg-emerald-400 animate-pulse h-4" style={{ animationDuration: '0.8s' }} />
                  <span className="w-0.5 bg-emerald-400 animate-pulse h-1.5" style={{ animationDuration: '0.5s' }} />
                  <span className="w-0.5 bg-emerald-400 animate-pulse h-3" style={{ animationDuration: '0.7s' }} />
                </div>
              ) : (
                <Music className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-mono">
              <Volume2 className="w-3 h-3 text-slate-400" />
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              className="w-12 sm:w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              title="Громкость мелодии"
              style={{ outline: 'none' }}
            />
          </div>

          {isFirebaseEnabled ? (
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              Онлайн (Firebase)
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
              <WifiOff className="w-3.5 h-3.5" />
              Офлайн симулятор
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2 sm:gap-3 bg-slate-950 p-1 px-3 rounded-full border border-slate-800">
              <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${user.color} flex items-center justify-center text-xs shadow-inner shrink-0 overflow-hidden`}>
                {user.avatar && user.avatar.startsWith('data:image') ? (
                  <img src={user.avatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <span>{user.avatar || '👾'}</span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-300 hidden sm:inline">{user.displayName}</span>
              <button 
                onClick={handleSignOut}
                className="p-1 hover:text-rose-400 text-slate-400 rounded-lg transition shrink-0 cursor-pointer"
                title="Log Out Account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 w-full relative">
        <AnimatePresence mode="wait">
          
          {/* PROFILE CREATOR / AUTHENTICATION PAGE */}
          {!user && (
            <motion.div
              key="register-panel"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950"
            >
              <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-[32px] p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden ring-1 ring-white/5 max-h-[92vh] overflow-y-auto">
                {/* Tech grid backgrounds & glows */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b1a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b1a_1px,transparent_1px)] bg-[size:16px_16px] -z-10" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] -z-10" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10" />

                <div className="text-center flex flex-col items-center gap-1.5 mb-6">
                  <div className="h-12 w-12 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-400 border border-teal-500/30 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-teal-950/40 relative">
                    <span className="absolute inset-0 rounded-2xl border border-white/10 animate-pulse" />
                    <UserPlus className="w-5 h-5 animate-pulse" />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />
                    <span className="text-[10px] font-mono tracking-widest uppercase text-teal-400 font-bold">СОЗДАНИЕ АККАУНТА</span>
                  </div>
                  
                  <h2 className="text-2xl font-display font-extrabold text-white tracking-tight leading-tight mt-1">
                    Войти в игру
                  </h2>
                  <p className="text-xs text-slate-400 max-w-sm mt-0.5 leading-relaxed">
                    Зарегистрируйте свой боевой позывной и аватарку для координатных сражений.
                  </p>
                </div>

                <form onSubmit={handleRegister} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold">
                        NICKNAME / ПОЗЫВНОЙ
                      </label>
                      <span className="text-[9px] font-mono text-slate-500">МАКС. 15 СИМВОЛОВ</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Пример: GeoHacker_RU"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        maxLength={15}
                        className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 focus:text-white rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/30 transition-all font-semibold font-mono shadow-inner animate-none"
                      />
                    </div>
                  </div>

                  {/* AVATAR CHOOSER SECTION */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest px-1 font-bold">
                      SELECT AVATAR / АВАТАРКА И ОФОРМЛЕНИЕ
                    </label>
                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80 flex flex-col gap-3">
                      {/* Presets and custom view */}
                      <div className="flex flex-wrap gap-2.5 justify-center items-center">
                        {avatarPresets.map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSelectedAvatar(preset)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all relative ${
                              selectedAvatar === preset 
                                ? 'bg-slate-800 ring-2 ring-teal-400 text-white scale-110 shadow-lg shadow-teal-500/25' 
                                : 'bg-slate-900 border border-slate-800 opacity-60 hover:opacity-100 hover:scale-105 cursor-pointer'
                            }`}
                          >
                            <span>{preset}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-center items-center">
                        <span className="text-[9px] font-mono text-slate-600 uppercase">ИЛИ ЗАГРУЗИТЕ СВОЮ С КОМПЬЮТЕРА</span>
                      </div>

                      {/* File Uploader integration */}
                      <div className="flex items-center justify-center">
                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-705 text-slate-300 hover:text-white rounded-xl text-[11px] font-semibold tracking-wider font-mono cursor-pointer transition select-none">
                          <Upload className="w-3.5 h-3.5 text-teal-400" />
                          ЗАГРУЗИТЬ КАРТИНКУ
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/jpg" 
                            onChange={handleAvatarUpload} 
                            className="hidden" 
                          />
                        </label>
                      </div>

                      {/* Display Preview */}
                      <div className="flex justify-center items-center gap-2 mt-1">
                        <span className="text-[9px] font-mono text-slate-500">ТЕКУЩИЙ ПРЕВЬЮ:</span>
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm overflow-hidden shadow border border-slate-700">
                          {selectedAvatar.startsWith('data:image') ? (
                            <img src={selectedAvatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <span>{selectedAvatar}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center font-bold">
                      SIGNATURE COLOR ENERGY / ЦВЕТОВАЯ СИГНАТУРА
                    </label>
                    <div className="flex gap-3 justify-center">
                      {avatarColors.map(color => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setAvatarColor(color.value)}
                          className={`w-9 h-9 rounded-full bg-gradient-to-tr ${color.value} transition-all relative ${
                            avatarColor === color.value 
                              ? 'scale-110 shadow-xl shadow-teal-500/20 ring-4 ring-offset-[4px] ring-offset-slate-900 ring-teal-500' 
                              : 'hover:scale-105 opacity-50 hover:opacity-100 cursor-pointer'
                          }`}
                          title={color.name}
                        >
                          {avatarColor === color.value && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-slate-950 rounded-full" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition shadow-lg shadow-teal-950/55 hover:shadow-teal-500/30 border border-teal-500 hover:border-teal-400 active:scale-95 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    DEPLOY ID / ВОЙТИ В КЛИЕНТ
                    <ArrowRight className="w-4 h-4 text-teal-200" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ACTIVE MULTIPLAYER GAME SCREEN */}
          {user && activeLobbyId && activeLobby && activeLobby.status !== 'lobby' && (
            <motion.div
              key="multiplayer-active-screen"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GameScreen lobby={activeLobby} currentUserId={user.uid} />
            </motion.div>
          )}

          {/* ACTIVE SOLO MODE GAME SCREEN */}
          {user && isSoloMode && soloLobby && (
            <motion.div
              key="solo-active-screen"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GameScreen 
                lobby={soloLobby} 
                currentUserId={user.uid} 
                onLeaveGame={handleLeaveGame}
              />
            </motion.div>
          )}

          {/* MULTIPLAYER LOBBY ROOM */}
          {user && activeLobbyId && activeLobby && activeLobby.status === 'lobby' && (
            <motion.div
              key="lobby-room-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="container mx-auto py-8"
            >
              <div className="px-4">
                <button
                  onClick={handleLeaveGame}
                  className="mb-4 text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  ← Выйти из лобби
                </button>
              </div>
              <LobbyRoom lobby={activeLobby} currentUserId={user.uid} />
            </motion.div>
          )}

          {/* HOME DASHBOARD SCREEN */}
          {user && !activeLobbyId && !isSoloMode && (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950"
            >
              <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                
                {/* Visual Intro Info Grid */}
                <div className="flex flex-col gap-6 text-center md:text-left pr-0 md:pr-4">
                  <div className="flex items-center justify-center md:justify-start gap-2 animate-none">
                    <span className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-[9px] font-mono font-bold tracking-widest uppercase">
                      СТАТУС: ОНЛАЙН
                    </span>
                    <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-[9px] font-mono font-bold tracking-widest uppercase">
                      ПАНОРАМЫ 360°
                    </span>
                  </div>

                  <div>
                    <h1 className="text-5xl sm:text-6xl font-display font-extrabold text-white tracking-tight leading-[0.95] mb-4">
                      Spatial <br />
                      <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm">
                        GEO-BATTLE
                      </span>
                    </h1>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto md:mx-0">
                      Исследуйте детализированные панорамы уличного уровня, находите географические подсказки, оценивайте локацию по микро-ориентирам и соревнуйтесь в точной расстановке меток.
                    </p>
                  </div>

                  {/* High Tech Metrics Panel */}
                  <div className="grid grid-cols-3 gap-4 border-t border-slate-900 pt-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">КЛИПКЕЙС ДРУЗЕЙ</span>
                      <strong className="text-white text-md font-display mt-0.5">ДО 4 ЧЕЛОВЕК</strong>
                    </div>
                    <div className="flex flex-col border-l border-slate-900 pl-4">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">КОМАНДНОЕ ДЕЛЕНИЕ</span>
                      <strong className="text-teal-400 text-md font-display mt-0.5">BLUE vs RED</strong>
                    </div>
                    <div className="flex flex-col border-l border-slate-900 pl-4">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">ПЛОЩАДКА</span>
                      <strong className="text-white text-md font-display mt-0.5">КАРТЫ ИСТОРИИ</strong>
                    </div>
                  </div>
                </div>

                {/* Interactive Options list */}
                <div className="flex flex-col gap-5">
                  
                  {/* PLAY SOLO BUTTON CARD */}
                  <div 
                    onClick={handleStartSoloPlay}
                    className="group bg-slate-900/40 hover:bg-slate-900/90 border border-slate-800/80 hover:border-teal-500/30 p-6 rounded-[28px] cursor-pointer transition-all duration-300 flex items-center justify-between shadow-lg relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl -z-10" />
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-105 group-hover:border-teal-400/50 transition-all duration-300 shadow-md">
                        <Globe2 className="w-6 h-6 text-teal-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider group-hover:text-teal-400 transition-colors">
                            Играть Одному
                          </h3>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 bg-teal-950 text-teal-400 border border-teal-800/40 rounded uppercase font-bold">SOLO</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Одиночный тренировочный заезд по случайным местам планеты.</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>

                  {/* MULTIPLAYER AREA */}
                  <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-[32px] p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -z-10" />
                    
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                        Multiplayer Arena / Мультиплеер
                      </h3>
                    </div>

                    {/* Create Lobby button */}
                    <button
                      disabled={loading}
                      onClick={handleCreateLobby}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition shadow-lg shadow-blue-950/40 border border-blue-500/40 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Gamepad2 className="w-4 h-4" />
                      Создать Новое Лобби
                    </button>

                    <div className="relative flex items-center justify-center my-1 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                      <div className="absolute left-0 right-0 h-[1px] bg-slate-800" />
                      <span className="relative px-3 bg-slate-900">Присоединиться по коду / JOIN ROOM</span>
                    </div>

                    {/* Join by code form */}
                    <form onSubmit={handleJoinLobbyByCode} className="flex gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Код лобби, напр: BTL-4821"
                        value={lobbyIdInput}
                        onChange={(e) => setLobbyIdInput(e.target.value)}
                        className="flex-1 bg-slate-950/95 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-mono font-bold tracking-widest uppercase focus:outline-none focus:border-blue-500 text-slate-200 focus:text-white transition shadow-inner"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider rounded-2xl border border-slate-755 transition active:scale-95 duration-200 cursor-pointer text-center"
                      >
                        Войти
                      </button>
                    </form>

                    {/* Error indicator under lobby controls */}
                    {errorMsg && (
                      <div className="p-3 bg-rose-950/50 text-rose-400 text-xs rounded-xl border border-rose-900/60 font-mono text-[10px] leading-relaxed">
                        ⚠️ ВНИМАНИЕ: {errorMsg}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
