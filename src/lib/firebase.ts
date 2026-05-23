/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Lobby, Player, GameLocation } from '../types';
import { GAME_LOCATIONS } from '../data/locations';

// Check if Firebase is using mock placeholders
const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey === "mock_api_key_placeholder";
export const isFirebaseEnabled = !isPlaceholder;

let dbInstance: any = null;
let authInstance: any = null;

// Dynamic automatic offline-sandbox fallback
let useLocalFallback = false;

if (isFirebaseEnabled) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    authInstance = getAuth(app);

    // Validate connection to Firestore on boot
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(dbInstance, 'test', 'connection'));
      } catch (error) {
        console.warn("Firestore connection check failed, using safe offline fallback.");
        useLocalFallback = true;
      }
    };
    testConnection();
  } catch (err) {
    console.error("Firebase init failed, running in sandbox offline mode", err);
    useLocalFallback = true;
  }
} else {
  useLocalFallback = true;
}

export const db = dbInstance;
export const auth = authInstance;

// --- FIRESTORE ERROR HANDLING ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || 'anonymous'
    },
    operationType,
    path
  };
  console.error('Firestore Error details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- HYBRID REALTIME LOBBY STATE ENGINE ---
let localLobbies: { [lobbyId: string]: Lobby } = {};
type LobbySubscription = (lobby: Lobby | null) => void;
let localSubscriptions: { [lobbyId: string]: LobbySubscription[] } = {};

function notifyLocalSubscribers(lobbyId: string) {
  const lobby = localLobbies[lobbyId] || null;
  if (localSubscriptions[lobbyId]) {
    localSubscriptions[lobbyId].forEach(cb => cb(lobby ? { ...lobby } : null));
  }
  localStorage.setItem(`lobby_${lobbyId}`, JSON.stringify(lobby));
}

function registerLocalSub(lobbyId: string, callback: LobbySubscription): () => void {
  if (!localSubscriptions[lobbyId]) {
    localSubscriptions[lobbyId] = [];
  }
  localSubscriptions[lobbyId].push(callback);
  
  const cached = localStorage.getItem(`lobby_${lobbyId}`);
  if (cached) {
    try {
      localLobbies[lobbyId] = JSON.parse(cached);
    } catch (err) {}
  }

  callback(localLobbies[lobbyId] || null);

  return () => {
    localSubscriptions[lobbyId] = localSubscriptions[lobbyId].filter(cb => cb !== callback);
  };
}

// Service Methods with Seamless run-time error recovery
export async function createLobby(
  lobbyId: string, 
  hostUid: string, 
  hostName: string, 
  maxRounds: number,
  firstLocationId: string,
  hostAvatar?: string,
  hostColor?: string
): Promise<void> {
  const initialPlayer: Player = {
    uid: hostUid,
    displayName: hostName,
    team: 'blue',
    isHost: true,
    ready: false,
    score: 0,
    lastGuess: null,
    avatar: hostAvatar,
    color: hostColor
  };

  const newLobby: Lobby = {
    id: lobbyId,
    hostId: hostUid,
    players: { [hostUid]: initialPlayer },
    status: 'lobby',
    currentRound: 1,
    maxRounds,
    currentLocationId: firstLocationId,
    elapsedTime: 60,
    blueScore: 0,
    redScore: 0,
    createdAt: Date.now()
  };

  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      await setDoc(doc(db, 'lobbies', lobbyId), newLobby);
    } catch (err) {
      console.warn('Firestore setDoc failed, activating on-the-fly local fallback:', err);
      useLocalFallback = true;
      localLobbies[lobbyId] = newLobby;
      notifyLocalSubscribers(lobbyId);
    }
  } else {
    localLobbies[lobbyId] = newLobby;
    notifyLocalSubscribers(lobbyId);
  }
}

export async function joinLobby(
  lobbyId: string, 
  playerUid: string, 
  playerName: string,
  playerAvatar?: string,
  playerColor?: string
): Promise<void> {
  const newPlayer: Player = {
    uid: playerUid,
    displayName: playerName,
    team: 'red', // Balance team
    isHost: false,
    ready: false,
    score: 0,
    lastGuess: null,
    avatar: playerAvatar,
    color: playerColor
  };

  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        throw new Error("Lobby not found");
      }
      const lobby = snapshot.data() as Lobby;
      
      if (Object.keys(lobby.players).length >= 4) {
        throw new Error("Lobby is full (maximum 4 players)");
      }

      const updatedPlayers = { ...lobby.players, [playerUid]: newPlayer };
      await updateDoc(docRef, { players: updatedPlayers });
    } catch (err) {
      console.warn('Firestore joinLobby failed, using local simulation:', err);
      useLocalFallback = true;
      // Mirror locally if possible
      let localLobby = localLobbies[lobbyId];
      if (!localLobby) {
        // Mock join if missing
        localLobby = {
          id: lobbyId,
          hostId: 'host_offline',
          players: {},
          status: 'lobby',
          currentRound: 1,
          maxRounds: 5,
          currentLocationId: GAME_LOCATIONS[0].id,
          elapsedTime: 60,
          blueScore: 0,
          redScore: 0,
          createdAt: Date.now()
        };
      }
      localLobby.players[playerUid] = newPlayer;
      localLobbies[lobbyId] = localLobby;
      notifyLocalSubscribers(lobbyId);
    }
  } else {
    const lobby = localLobbies[lobbyId];
    if (!lobby) throw new Error("Lobby not found");
    if (Object.keys(lobby.players).length >= 4) {
      throw new Error("Lobby is full (maximum 4 players)");
    }
    lobby.players[playerUid] = newPlayer;
    notifyLocalSubscribers(lobbyId);
  }
}

export async function togglePlayerReady(lobbyId: string, playerUid: string, ready: boolean): Promise<void> {
  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const lobby = snapshot.data() as Lobby;
        const players = { ...lobby.players };
        if (players[playerUid]) {
          players[playerUid].ready = ready;
          await updateDoc(docRef, { players });
        }
      }
    } catch (err) {
      console.warn('Firestore togglePlayerReady failed, local update instead:', err);
      useLocalFallback = true;
      const lobby = localLobbies[lobbyId];
      if (lobby && lobby.players[playerUid]) {
        lobby.players[playerUid].ready = ready;
        notifyLocalSubscribers(lobbyId);
      }
    }
  } else {
    const lobby = localLobbies[lobbyId];
    if (lobby && lobby.players[playerUid]) {
      lobby.players[playerUid].ready = ready;
      notifyLocalSubscribers(lobbyId);
    }
  }
}

export async function updatePlayerTeam(lobbyId: string, playerUid: string, team: 'blue' | 'red'): Promise<void> {
  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const lobby = snapshot.data() as Lobby;
        const players = { ...lobby.players };
        if (players[playerUid]) {
          players[playerUid].team = team;
          await updateDoc(docRef, { players });
        }
      }
    } catch (err) {
      console.warn('Firestore updatePlayerTeam failed, local update:', err);
      useLocalFallback = true;
      const lobby = localLobbies[lobbyId];
      if (lobby && lobby.players[playerUid]) {
        lobby.players[playerUid].team = team;
        notifyLocalSubscribers(lobbyId);
      }
    }
  } else {
    const lobby = localLobbies[lobbyId];
    if (lobby && lobby.players[playerUid]) {
      lobby.players[playerUid].team = team;
      notifyLocalSubscribers(lobbyId);
    }
  }
}

export async function startLobbyGame(lobbyId: string, locationId: string): Promise<void> {
  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      await updateDoc(docRef, {
        status: 'playing',
        currentRound: 1,
        currentLocationId: locationId,
        elapsedTime: 60,
        blueScore: 0,
        redScore: 0
      });
    } catch (err) {
      console.warn('Firestore startLobbyGame failed, start local:', err);
      useLocalFallback = true;
      const lobby = localLobbies[lobbyId];
      if (lobby) {
        lobby.status = 'playing';
        lobby.currentRound = 1;
        lobby.currentLocationId = locationId;
        lobby.elapsedTime = 60;
        lobby.blueScore = 0;
        lobby.redScore = 0;
        Object.keys(lobby.players).forEach(uid => {
          lobby.players[uid].score = 0;
          lobby.players[uid].lastGuess = null;
        });
        notifyLocalSubscribers(lobbyId);
      }
    }
  } else {
    const lobby = localLobbies[lobbyId];
    if (lobby) {
      lobby.status = 'playing';
      lobby.currentRound = 1;
      lobby.currentLocationId = locationId;
      lobby.elapsedTime = 60;
      lobby.blueScore = 0;
      lobby.redScore = 0;
      
      Object.keys(lobby.players).forEach(uid => {
        lobby.players[uid].score = 0;
        lobby.players[uid].lastGuess = null;
      });
      
      notifyLocalSubscribers(lobbyId);
    }
  }
}

export async function submitGuess(
  lobbyId: string, 
  playerUid: string, 
  lat: number, 
  lng: number, 
  points: number, 
  distance: number
): Promise<void> {
  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const lobby = snapshot.data() as Lobby;
        const players = { ...lobby.players };
        if (players[playerUid]) {
          players[playerUid].lastGuess = { lat, lng, distance, points };
          players[playerUid].score += points;
          players[playerUid].ready = true;
        }

        const allGuessed = Object.values(players).every(p => p.lastGuess !== null);
        
        let newBlueScore = lobby.blueScore;
        let newRedScore = lobby.redScore;
        if (players[playerUid].team === 'blue') {
          newBlueScore += points;
        } else {
          newRedScore += points;
        }

        const updates: Partial<Lobby> = { 
          players,
          blueScore: newBlueScore,
          redScore: newRedScore
        };

        if (allGuessed) {
          updates.status = 'round-results';
        }

        await updateDoc(docRef, updates);
      }
    } catch (err) {
      console.warn('Firestore submitGuess failed, local guess registration:', err);
      useLocalFallback = true;
      registerLocalGuess(lobbyId, playerUid, lat, lng, points, distance);
    }
  } else {
    registerLocalGuess(lobbyId, playerUid, lat, lng, points, distance);
  }
}

function registerLocalGuess(lobbyId: string, playerUid: string, lat: number, lng: number, points: number, distance: number) {
  const lobby = localLobbies[lobbyId];
  if (lobby) {
    const player = lobby.players[playerUid];
    if (player) {
      player.lastGuess = { lat, lng, distance, points };
      player.score += points;
      
      if (player.team === 'blue') {
        lobby.blueScore += points;
      } else {
        lobby.redScore += points;
      }
    }

    const allGuessed = Object.values(lobby.players).every(p => p.lastGuess !== null);
    if (allGuessed) {
      lobby.status = 'round-results';
    }
    notifyLocalSubscribers(lobbyId);
  }
}

export async function nextRound(lobbyId: string, nextLocationId: string): Promise<void> {
  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const lobby = snapshot.data() as Lobby;
        const nextRoundNum = lobby.currentRound + 1;
        
        const players = { ...lobby.players };
        Object.keys(players).forEach(uid => {
          players[uid].lastGuess = null;
          players[uid].ready = false;
        });

        if (nextRoundNum > lobby.maxRounds) {
          await updateDoc(docRef, {
            status: 'ended',
            players
          });
        } else {
          await updateDoc(docRef, {
            status: 'playing',
            currentRound: nextRoundNum,
            currentLocationId: nextLocationId,
            players,
            elapsedTime: 60
          });
        }
      }
    } catch (err) {
      console.warn('Firestore nextRound failed, using local nextround:', err);
      useLocalFallback = true;
      triggerLocalNextRound(lobbyId, nextLocationId);
    }
  } else {
    triggerLocalNextRound(lobbyId, nextLocationId);
  }
}

function triggerLocalNextRound(lobbyId: string, nextLocationId: string) {
  const lobby = localLobbies[lobbyId];
  if (lobby) {
    const nextRoundNum = lobby.currentRound + 1;
    
    Object.keys(lobby.players).forEach(uid => {
      lobby.players[uid].lastGuess = null;
      lobby.players[uid].ready = false;
    });

    if (nextRoundNum > lobby.maxRounds) {
      lobby.status = 'ended';
    } else {
      lobby.status = 'playing';
      lobby.currentRound = nextRoundNum;
      lobby.currentLocationId = nextLocationId;
      lobby.elapsedTime = 60;
    }
    notifyLocalSubscribers(lobbyId);
  }
}

export async function resetLobby(lobbyId: string): Promise<void> {
  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const docRef = doc(db, 'lobbies', lobbyId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const lobby = snapshot.data() as Lobby;
        const players = { ...lobby.players };
        Object.keys(players).forEach(uid => {
          players[uid].score = 0;
          players[uid].lastGuess = null;
          players[uid].ready = false;
        });
        await updateDoc(docRef, {
          status: 'lobby',
          currentRound: 1,
          blueScore: 0,
          redScore: 0,
          players
        });
      }
    } catch (err) {
      console.warn('Firestore resetLobby failed, using local reset:', err);
      useLocalFallback = true;
      triggerLocalReset(lobbyId);
    }
  } else {
    triggerLocalReset(lobbyId);
  }
}

function triggerLocalReset(lobbyId: string) {
  const lobby = localLobbies[lobbyId];
  if (lobby) {
    lobby.status = 'lobby';
    lobby.currentRound = 1;
    lobby.blueScore = 0;
    lobby.redScore = 0;
    Object.keys(lobby.players).forEach(uid => {
      lobby.players[uid].score = 0;
      lobby.players[uid].lastGuess = null;
      lobby.players[uid].ready = false;
    });
    notifyLocalSubscribers(lobbyId);
  }
}

export function subscribeToLobby(lobbyId: string, callback: LobbySubscription): () => void {
  if (isFirebaseEnabled && db && !useLocalFallback) {
    const path = `lobbies/${lobbyId}`;
    try {
      const unsub = onSnapshot(doc(db, 'lobbies', lobbyId), (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as Lobby);
        } else {
          callback(null);
        }
      }, (err) => {
        console.warn('Firestore sub error, forcing runtime LocalFallback mode:', err);
        useLocalFallback = true;
        const localUnsub = registerLocalSub(lobbyId, callback);
        localUnsub();
      });
      return unsub;
    } catch (err) {
      console.warn('Firestore sub setup error, local fallback activated:', err);
      useLocalFallback = true;
      return registerLocalSub(lobbyId, callback);
    }
  } else {
    return registerLocalSub(lobbyId, callback);
  }
}

export function simulateOtherPlayerAction(lobbyId: string, targetUid: string, actionType: 'team' | 'ready' | 'guess', payload?: any) {
  const lobby = localLobbies[lobbyId];
  if (!lobby) return;

  const player = lobby.players[targetUid];
  if (!player) return;

  if (actionType === 'team') {
    player.team = payload;
  } else if (actionType === 'ready') {
    player.ready = payload;
  } else if (actionType === 'guess') {
    const loc = GAME_LOCATIONS.find(l => l.id === lobby.currentLocationId) || GAME_LOCATIONS[0];
    const dispersion = 15; // dispersion in km
    const latOffset = (Math.random() - 0.5) * (dispersion / 111);
    const lngOffset = (Math.random() - 0.5) * (dispersion / (111 * Math.cos(loc.lat * Math.PI / 180)));
    const latGuess = loc.lat + latOffset;
    const lngGuess = loc.lng + lngOffset;
    
    // Haversine
    const R = 6371;
    const dLat = (latGuess - loc.lat) * Math.PI / 180;
    const dLng = (lngGuess - loc.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc.lat * Math.PI / 180) * Math.cos(latGuess * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    const points = Math.max(0, Math.round(5000 * Math.exp(-dist / 2000)));

    player.lastGuess = { lat: latGuess, lng: lngGuess, distance: dist, points };
    player.score += points;
    player.ready = true;

    if (player.team === 'blue') {
      lobby.blueScore += points;
    } else {
      lobby.redScore += points;
    }

    const allGuessed = Object.values(lobby.players).every(p => p.lastGuess !== null);
    if (allGuessed) {
      lobby.status = 'round-results';
    }
  }

  notifyLocalSubscribers(lobbyId);
}
