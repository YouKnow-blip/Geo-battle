/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Team = 'blue' | 'red';

export interface Player {
  uid: string;
  displayName: string;
  team: Team;
  isHost: boolean;
  ready: boolean;
  score: number;
  lastGuess: {
    lat: number;
    lng: number;
    distance: number; // in km
    points: number;
  } | null;
  avatar?: string;
  color?: string;
}

export interface Lobby {
  id: string; // the invite lobby code (e.g., 4-digit code)
  hostId: string;
  players: { [uid: string]: Player };
  status: 'lobby' | 'playing' | 'round-results' | 'ended';
  currentRound: number;
  maxRounds: number;
  currentLocationId: string;
  elapsedTime: number; // to sync timer countdown
  blueScore: number;
  redScore: number;
  createdAt: number;
}

export interface GameLocation {
  id: string;
  pKey: string; // Mapillary Image Key
  lat: number;
  lng: number;
  name: string;
  country: string;
  description: string;
}

export interface RoundGuess {
  userId: string;
  displayName: string;
  team: Team;
  lat: number;
  lng: number;
  distance: number;
  points: number;
}
