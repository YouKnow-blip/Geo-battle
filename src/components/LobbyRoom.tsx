/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Users, 
  User as UserIcon, 
  Check, 
  ArrowRightLeft, 
  Play, 
  PlusCircle, 
  Copy, 
  Sparkles, 
  ShieldAlert,
  Gamepad2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Lobby, Player, Team } from '../types';
import { 
  togglePlayerReady, 
  updatePlayerTeam, 
  startLobbyGame, 
  simulateOtherPlayerAction 
} from '../lib/firebase';
import { getRandomLocation } from '../data/locations';

interface LobbyRoomProps {
  lobby: Lobby;
  currentUserId: string;
}

export default function LobbyRoom({ lobby, currentUserId }: LobbyRoomProps) {
  const [copied, setCopied] = useState(false);
  const playersList = Object.values(lobby.players);
  const me = lobby.players[currentUserId];
  const isHost = lobby.hostId === currentUserId;

  const bluePlayers = playersList.filter(p => p.team === 'blue');
  const redPlayers = playersList.filter(p => p.team === 'red');

  const copyCode = () => {
    navigator.clipboard.writeText(lobby.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReady = async () => {
    if (!me) return;
    await togglePlayerReady(lobby.id, currentUserId, !me.ready);
  };

  const handleSwitchTeam = async () => {
    if (!me) return;
    const nextTeam: Team = me.team === 'blue' ? 'red' : 'blue';
    await updatePlayerTeam(lobby.id, currentUserId, nextTeam);
  };

  const handleJoinTeam = async (targetTeam: Team) => {
    if (!me || me.team === targetTeam) return;
    await updatePlayerTeam(lobby.id, currentUserId, targetTeam);
  };

  const handleStartGame = async () => {
    const startLoc = getRandomLocation();
    await startLobbyGame(lobby.id, startLoc.id);
  };

  // Tool to add custom local bots/friends for testing the 4-player team mechanics
  const handleAddLocalAI = () => {
    const placeholderNames = ['Roman', 'Elena', 'Ksenia', 'Arthur', 'Maxim', 'Dmitry'];
    const activeNames = playersList.map(p => p.displayName);
    const availableNames = placeholderNames.filter(n => !activeNames.includes(n));
    
    if (playersList.length >= 4) {
      alert("Lobby is full! Max 4 players.");
      return;
    }

    const nextName = availableNames[Math.floor(Math.random() * availableNames.length)] || 'Player Bot';
    const fakeUid = `bot_user_${Date.now()}`;
    const botTeam: Team = bluePlayers.length <= redPlayers.length ? 'blue' : 'red';
    const presetsList = ['🤖', '🦊', '🚀', '🕵️', '👾', '🌍'];
    const randomAvatar = presetsList[Math.floor(Math.random() * presetsList.length)];

    // Directly add player to the local lobby state using simulateOtherPlayerAction
    const simulatedPlayer: Player = {
      uid: fakeUid,
      displayName: nextName,
      team: botTeam,
      isHost: false,
      ready: true,
      score: 0,
      lastGuess: null,
      avatar: randomAvatar
    };

    // Inject into lobby
    lobby.players[fakeUid] = simulatedPlayer;
    
    // Auto-sync
    if (lobby.players[fakeUid]) {
      // Small trigger to force react renders
      togglePlayerReady(lobby.id, fakeUid, true);
    }
  };

  const allPlayersReady = playersList.every(p => p.ready || p.isHost);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 py-4 px-4 sm:px-6">
      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center justify-between shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b1a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b1a_1px,transparent_1px)] bg-[size:14px_14px] -z-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-[80px] -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -z-10" />

        <div className="flex flex-col gap-2 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-teal-400 font-bold">TACTICAL BRIEFING CHAMBER</span>
          </div>
          <h1 className="text-3xl font-display font-extrabold text-white tracking-tight leading-none">
            Geo-Battle Arena
          </h1>
          <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
            Team up to 4 fighters, customize your squad divisions, verify street clues, and launch the real-time simulation coordinate clash.
          </p>
        </div>

        {/* Invite Code display */}
        <div className="flex flex-col gap-2 items-center sm:items-end w-full sm:w-auto shrink-0">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">INVITE KEY / КОД ЛОББИ</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="bg-slate-950/90 border border-slate-800 px-6 py-3.5 rounded-2xl font-mono text-xl font-bold tracking-widest text-[#10b981] flex items-center justify-center min-w-[140px] shadow-inner font-semibold">
              {lobby.id}
            </div>
            <button
              onClick={copyCode}
              className="p-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white rounded-2xl border border-slate-700 transition cursor-pointer flex items-center justify-center"
              title="Copy Lobby ID"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Team Dividing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BLUE TEAM */}
        <div 
          onClick={() => handleJoinTeam('blue')}
          className={`bg-slate-900/40 border-2 rounded-[28px] p-6 transition-all duration-300 flex flex-col min-h-[300px] cursor-pointer hover:bg-slate-900/70 relative overflow-hidden group ${
            me?.team === 'blue' 
              ? 'border-blue-500/50 shadow-xl shadow-blue-500/5 bg-slate-900/80 ring-1 ring-blue-500/30' 
              : 'border-slate-800 hover:border-blue-500/30'
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -z-10 group-hover:bg-blue-500/10 transition" />
          
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-500/10">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 animate-pulse" />
              <h2 className="text-base font-display font-extrabold text-blue-400 uppercase tracking-wider">Blue Squad / Синие</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider font-bold">{bluePlayers.length} / 2 FIGHTERS</span>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {bluePlayers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-[11px] text-center py-10">
                <Users className="w-8 h-8 opacity-20 mb-2.5 text-blue-400" />
                SQUAD VACANT
                <span className="text-[9px] text-blue-400/70 uppercase max-w-[170px] mt-1 tracking-wider font-bold">CLICK TO ASSIGN BLUE TEAM</span>
              </div>
            ) : (
              bluePlayers.map(player => (
                <div 
                  key={player.uid} 
                  className={`flex items-center justify-between p-4 rounded-2xl border ${
                    player.uid === currentUserId 
                      ? 'bg-slate-950/80 border-blue-500/35 shadow-md shadow-blue-950/60' 
                      : 'bg-slate-950/45 border-slate-805'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shrink-0 overflow-hidden">
                      {player.avatar && player.avatar.startsWith('data:image') ? (
                        <img src={player.avatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm">{player.avatar || '👾'}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5 text-slate-200 font-mono uppercase tracking-wide">
                        {player.displayName}
                        {player.isHost && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[8px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-semibold">
                            Commander
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">HASH: {player.uid.substring(0, 7)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {player.ready || player.isHost ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        READY
                      </span>
                    ) : (
                      <span className="bg-slate-950/85 text-slate-500 border border-slate-800 text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-lg font-bold">
                        AWAITING
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RED TEAM */}
        <div 
          onClick={() => handleJoinTeam('red')}
          className={`bg-slate-900/40 border-2 rounded-[28px] p-6 transition-all duration-300 flex flex-col min-h-[300px] cursor-pointer hover:bg-slate-900/70 relative overflow-hidden group ${
            me?.team === 'red' 
              ? 'border-red-500/50 shadow-xl shadow-red-500/5 bg-slate-900/80 ring-1 ring-red-500/30' 
              : 'border-slate-800 hover:border-red-500/20'
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -z-10 group-hover:bg-red-500/10 transition" />
          
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-red-500/10">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-red-500 rounded-full shadow-lg shadow-red-500/50 animate-pulse" />
              <h2 className="text-base font-display font-extrabold text-red-400 uppercase tracking-wider">Red Squad / Красные</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider font-bold">{redPlayers.length} / 2 FIGHTERS</span>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {redPlayers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-[11px] text-center py-10">
                <Users className="w-8 h-8 opacity-20 mb-2.5 text-red-400" />
                SQUAD VACANT
                <span className="text-[9px] text-red-400/70 uppercase max-w-[170px] mt-1 tracking-wider font-bold">CLICK TO ASSIGN RED TEAM</span>
              </div>
            ) : (
              redPlayers.map(player => (
                <div 
                  key={player.uid} 
                  className={`flex items-center justify-between p-4 rounded-2xl border ${
                    player.uid === currentUserId 
                      ? 'bg-slate-950/80 border-red-500/30' 
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-450 shadow-sm shrink-0 overflow-hidden">
                      {player.avatar && player.avatar.startsWith('data:image') ? (
                        <img src={player.avatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm">{player.avatar || '👾'}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5 text-slate-200 font-mono uppercase tracking-wide">
                        {player.displayName}
                        {player.isHost && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[8px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-semibold">
                            Commander
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">HASH: {player.uid.substring(0, 7)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {player.ready || player.isHost ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        READY
                      </span>
                    ) : (
                      <span className="bg-slate-950/85 text-slate-500 border border-slate-800 text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-lg font-bold">
                        AWAITING
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Control Actions Panel */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-[28px] shadow-2xl flex flex-col gap-4">
        {/* Helper info and bot injector */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-950/60 p-4 rounded-2xl border border-slate-800/70 text-xs">
          <div className="flex items-start gap-2.5 text-slate-400">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-bold text-slate-300 font-mono uppercase tracking-wider text-[10px]">COMBAT PROTOCOL SECURED</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed">Max lobby limit: 4 players. Teams score matches concurrently based on client-side Mapillary guesses.</p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            {playersList.length < 4 && (
              <button
                onClick={handleAddLocalAI}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-850 hover:bg-slate-800 hover:text-white text-slate-300 rounded-xl font-mono text-[11px] uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border border-slate-755 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-teal-400" />
                Add Sim Friend
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2">
          {/* Quick instructions or switches */}
          <button
            onClick={handleSwitchTeam}
            className="w-full sm:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider rounded-2xl border border-slate-755 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-teal-400 animate-pulse" />
            Switch Colors ({me?.team === 'blue' ? 'Red' : 'Blue'})
          </button>

          <div className="flex gap-3 w-full sm:w-auto items-center">
            {/* Ready Toggle for standard members */}
            {!isHost && (
              <button
                onClick={handleToggleReady}
                className={`w-full sm:w-auto px-8 py-3.5 font-bold text-xs rounded-2xl transition duration-200 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide border cursor-pointer ${
                  me?.ready
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30'
                }`}
              >
                {me?.ready ? 'Deselect Ready' : 'Tick Ready'}
              </button>
            )}

            {/* Host Start button */}
            {isHost && (
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  disabled={playersList.length < 2 && lobby.players['sim'] === undefined}
                  onClick={handleStartGame}
                  className="px-8 py-3.5 font-bold text-xs text-white rounded-2xl uppercase tracking-wider transition scale-100 active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer bg-teal-600 hover:bg-teal-500 border border-teal-500 shadow-teal-950/35"
                >
                  <Play className="w-4 h-4 fill-current text-white animate-pulse" />
                  Launch Battle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
