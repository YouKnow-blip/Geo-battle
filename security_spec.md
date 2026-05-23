# Security Specification: Mapillary Geo-Battle Arena

This document defines the data safety, integrity, and behavioral invariants of the Firestore schema used by Mapillary Geo-Battle Arena.

## 1. Data Invariants

- **Uniqueness of Lobbies:** Lobbies are identified by a dense, unique path ID (e.g., `MAPI-4821`). The document ID must exactly match the internal payload ID (`id == lobbyId`).
- **Bounded Matches:** A lobby can have a maximum of 4 players (`players.keys().size() <= 4`) to prevent denial-of-service/wallet-exhaustion attacks on state sync.
- **State Progression:** The game state can progress through a defined linear lifecycle: `lobby` -> `playing` -> `round-results` -> `ended`. 
- **Immutable Meta:** The creation timestamp `createdAt` and the original unique lobby code metadata is immortal and cannot be mutated or overridden once the document is registered.
- **Score Integrity:** Points and scores can only be positive integers.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following 12 attack payloads highlight attempts to breach data invariants and how they are intercepted.

### 1-4: Identity & Ownership Spoofing
1. **The ID Poisoning Attack**: Attempting to create a lobby with a massive 1MB noise key in the path: `/lobbies/VERY_LONG_GARBAGE_KEY_123456...`
2. **The Host Identity Hijack**: Attempting to update a lobby to change the `hostId` to a different user ID after game initiation.
3. **The Score Forgery**: Submitting direct guess point gains that are negative (`points: -500`) to sabotage opponents.
4. **The Ghost Player Infiltration**: Writing more than 4 players into the `players` map of a lobby.

### 5-8: State & Timeline Sabotage
5. **The Time Machine Mutation**: Mutating a lobby's historic `createdAt` value forward or backward to bypass retention filters.
6. **The Skip Stage Jump**: Moving a lobby from `lobby` state directly to `ended` state, bypassing active gameplay.
7. **The Infinite Game Counter**: Incrementing `currentRound` higher than `maxRounds` allowed.
8. **The Round Score Reset**: Tampering with or resetting Blue/Red team scores mid-game to alter final results.

### 9-12: Resource & Schema Poisoning
9. **The Payload Shadow Bloat**: Adding custom admin fields like `isAdminOrMod = true` into the lobby document (Shadow field attack).
10. **The Negative Distance Coordinates**: Submitting a negative distance or coordinate map parameter.
11. **The Type Disruption Injection**: Overwriting `currentRound` with a boolean type `true` to crash calculating algorithms.
12. **The Orphaned Delete Attempt**: Requesting standard client-side deletion of active lobbies to disrupt other participants' frames.

---

## 3. Rules Implementation Strategy

Our Firestore standard security profile allows public matches via decentralized Sparsely Distributed Lobby Code tokens (`MAPI-XXXX`), asserting strict structural validations on any read or write block to bypass need for standard user logins while securing memory bounds against malicious injectors.
