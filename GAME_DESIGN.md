# Bull Race — Complete Game Reference

Everything below reflects the live codebase. Use this as a design doc, onboarding guide, or wiki draft.

---

## 1. What Is Bull Race?

**Bull Race** is a browser-based **multiplayer bull-racing MMO**. You play as a rancher on a shared isometric ranch: gather materials, breed and equip bulls, dress your character, enter **global scheduled races**, bet gold, trade on a **player market**, swap gold with **Ansem** for **$ANSEM** tokens, and explore with other players in real time via WebSockets.

**Core loop:** Gather → upgrade stable/den → breed/forge/equip bulls → race & bet → earn gold → repeat (or deposit gold to Ansem during an open cycle).

---

## 2. Technology (for developers)

| Layer | Stack |
|--------|--------|
| Client | Vite + React, 2D canvas (isometric voxels via `bullraceArt.js`) |
| Server | Fastify + Socket.io |
| Database | PostgreSQL + Prisma |
| Shared logic | `@bullrace/shared` (world gen, race sim, economy math) |
| Optional chain | Solana SPL token (wallet link, gold↔token market, daily wheel gate, Ansem airdrops) |

**Monorepo layout:**

```
bullrace/
├── apps/client/          # React UI + canvas renderer
├── apps/server/          # API, sockets, race scheduler, Prisma
├── packages/shared/      # World, races, economy, items, bulls
└── Bull Run game design spec/  # Original HTML prototype (reference)
```

---

## 3. The World

### Map
- **56×56 tile** grid, procedurally seeded (`WORLD_SEED = 42`)
- **Elliptical race track** in the center (tiles `trk1` / `trk2`)
- **Spawn hub** inside the track at **(28, 25)**
- **Walkover bridge** on the **west side** at ~(21.5, 31.3) — the **only** way to cross the track in/out of the infield
- Dirt roads connect major buildings; track and pasture fences block walking

### Buildings & locations

| Building | Map position (approx.) | Opens panel |
|----------|------------------------|-------------|
| Race Signup | Hub west road (19.8, 21.2) | Race |
| Daily Wheel | Hub (19.6, 23.8) | Wheel |
| **Ansem** | Hub, just right of spawn **(20.5, 27)** | Ansem |
| Betting Booth | Hub (19.7, 25.5) | Bet |
| Forge | SW (9, 32) | Forge |
| Market | SW (9, 35.5) | Market |
| Your Stable | SE (38, 37.5) | Stable |
| General Store | NE (45, 9.5) | Shop |

Ansem stands in the hub with a sign reading **“GOLD → $ANSEM”**. He is a purple-hooded NPC — click him when nearby to open the exchange panel.

You must be **near a building** (~2.5 world units) to use most actions server-side.

### Resource nodes (shared, synchronized)
- **34 trees** (wood)
- **26 rocks** (ore)
- **26 hay piles** (hay)
- Nodes **respawn 15 seconds** after depletion
- Gather action takes **1.5 seconds** (reduced by clothing bonuses)

### Dens (pasture plots)
- **26 den plots** around the map edges (left, bottom, top, right)
- **1 den per player** max
- Buy cost: **1000 gold + 5 wood**
- Den upgrades use wood + gold; capacity and spawn mechanics scale with level

---

## 4. Controls & UI

| Input | Action |
|--------|--------|
| Click ground | Walk there (pathfinding avoids obstacles) |
| Click node/building/NPC | Interact when in range |
| WASD / arrows | Pan camera |
| Bottom bar | Stable, Race, Bet, Market, Forge, Store, Items, Profile, Admin (if admin) |
| `?` button | In-game guide (full sidebar wiki) |
| Chat box | Global chat (120 char max, speech bubbles over avatars) |

**HUD:** gold, materials, character level/XP, online player count, **NEXT RACE** countdown.

### Audio (Profile)
- **Music** — shuffles between `BullRace.mp3` and `rideitout.mp3`
- **Sound FX** — procedural WebAudio synth for UI/game events
- Independent mute + volume sliders; settings persist in `localStorage`

---

## 5. Account & Authentication

### Required to play
- **Username + password** registration/login
- Cloud saves tied to your account
- **Display name** shown on ranch and race results

### Optional: Solana wallet
Link from **Profile** when you want:
- **Gold-for-tokens** market (sell/buy gold with SPL tokens on-chain)
- **Daily fortune wheel** (requires holding **10,000 tokens**)
- **Ansem deposits** (wallet required so tokens can be airdropped when a cycle closes)

Wallet linking uses a **free signature** only — never your seed phrase. One wallet per account.

### New player starter kit
- **0 gold**, 0 materials
- **1 common bull** (random coat, plain trait) already **following** you
- Starter bull stats: Speed 72, Stamina 65, Accel 65, Temper 4, Energy 100, Level 1

---

## 6. Ansem — Gold → $ANSEM Exchange

**Ansem** is an in-world NPC in the central hub who runs periodic **gold-for-token exchange cycles**.

### How it works (player)
1. An admin opens a cycle with a **gold target** and a **$ANSEM value** (USD notional for the pool).
2. While the cycle is **open**, players walk up to Ansem and **deposit gold** (100g increments, presets, or all gold).
3. Deposits are **pro-rata**: your share of the total gold collected = your share of the $ANSEM airdrop when the cycle closes.
4. You must have a **wallet linked in Profile** before depositing — Ansem airdrops $ANSEM to that address after close.
5. When no cycle is open, the panel shows *“Ansem isn't trading right now.”*

### UI details
- Progress bar: collected gold vs. target gold
- Shows cycle’s **$ANSEM pool value**, your deposited gold, and your % of the pool
- Quick amounts: 100 / 500 / 1000 / All

### Admin operations
Admins (`ADMIN_USERNAMES` env, default `dev`) get an **⚙ Admin** button:
- **Open cycle** — set target gold + $ANSEM value; closes any prior open cycle
- **Close cycle** — stops deposits; admin manually airdrops depositors off-chain using the depositor list (wallet + gold + %)
- View all depositors sorted by contribution

### API
- `GET /ansem` — current cycle state for logged-in player
- `POST /ansem/deposit` — `{ amount }` gold deposit (must be near Ansem)

---

## 7. Your Rancher (Character)

### Leveling
- **Max level: 25**
- **1 XP per resource unit** gathered
- XP to next level: `1000 × 1.4^(level−1)` — steep curve
- Perks:
  - **+1 gather yield every 5 levels**
  - **Level 10:** 2nd bull can follow you
  - **Level 25:** 3rd bull can follow you

### Movement & gathering speed
- Base walk speed: **4.4** world units/sec
- Clothing bonuses stack (capped **+60%** walk, **+70%** gather speed)

### Clothing slots
**Hat, Outfit, Boots, Gloves** — one item per slot, equipped from **Items → Your outfit**.

**Rarities:** Common → Uncommon → Rare → Epic → Legendary (bigger % bonus).

See **General Store** in-game or `packages/shared/src/charItems.ts` for the full catalog and prices.

**Wheel-only clothing** (not sold in store): Gilded Stetson, Cattle Baron Coat, Midas Grips, Comet Runners, Frontier Marshal Hat, etc.

---

## 8. Bulls — The Heart of the Game

### Core stats
| Stat | Role in races |
|------|----------------|
| **Speed** | Top-end pace |
| **Stamina** | Endurance over laps |
| **Accel** | Burst / cornering |
| **Temper** | Behavioral variance in simulation |
| **Energy** | 0–100; races cost 100 |
| **Level / XP** | Raises stat caps; XP from races |

### Bull locations
| Location | Meaning |
|----------|---------|
| `stable` | In your stable — train, breed, equip, list on market |
| `den` | Stored in your pasture plot |
| `following` | Walks behind you on the map — **required to enter races** |

### Rarity tiers

| Rarity | Drop rate (den/breed base) | Stat roll range | Max bull level |
|--------|---------------------------|-----------------|----------------|
| Common | 76% | 48–62 | 22 |
| Uncommon | 20% | 56–70 | 25 |
| Rare | 3% | 62–76 | 28 |
| Legendary | 1% | 68–82 | 35 |

Breeding with rarer parents adds a small **rarity boost** to offspring rolls.

### Traits (visual + identity)

**Common:** always plain (`normal`)

**Uncommon pool** (45% trait chance): Spotted, Longhorn

**Rare pool** (75% trait chance): Golden, Zebra, Shadow, Rainbow

**Legendary pool** (100% trait chance): Ghost, Skeleton, Unicorn, Inferno

### Coat colors
Base palette: reds, creams, blacks, blues, tans, purples, browns (~6–8 hex colors). Gear **coat** items can override display color.

### Bull XP & leveling
- Win: **60 XP**; other places: `max(10, 40 − position×5)`
- Level-up threshold: **level × 100 XP**
- Stat cap: base by rarity + **level × 15**

### Bull care actions (Stable panel)

| Action | Cost | Effect |
|--------|------|--------|
| **Train** | Hay (`50 + level×25`) | +3 to chosen stat |
| **Rest** | 80g | +50 energy |
| **Breed** | 500g + 2 stable bulls | ~2 min wait → new calf |
| **Follow me** | — | Bull follows on map (max 1/2/3 by char level) |
| **Rename / Delete** | — | Management |

### Energy regeneration
- Max energy: **100**
- Base regen: **3/min** at stable level 1
- Scales: `3 × (1 + 0.5 × (stableLevel − 1))` per minute
- Server ticks every **20 seconds**

---

## 9. Stable Upgrades

### Slots
`2 + floor(stableLevel / 2)` bull slots (Lv1 = 2, Lv2 = 3, Lv4 = 4…)

### Upgrade costs (per level)
- **Wood banked** in 10-unit chunks: `50×level + 100×level²` (Lv1→2 = **150 wood**)
- **Gold to finish** when wood bar full: `75 × level` (Lv1→2 = **75g**)

Higher stable = faster energy regen for all bulls.

---

## 10. Dens & Pastures

| Mechanic | Value |
|----------|-------|
| Max dens per player | **1** |
| Purchase | **1000g + 5 wood** |
| Base capacity | **3 bulls** |
| Capacity per level | `3 + (level−1)×2` |
| Wild bull spawn | Every **60 minutes** per den |
| Wood to level up | **35 wood** per upgrade action |
| Wood per level target | **40 × level** invested |
| Gold to level up | `150 × level²` |

Den-spawned bulls use the same rarity/trait/stat roll tables as breeding.

---

## 11. Gathering

1. Click a tree / rock / hay pile near you
2. **1.5s** gather bar (faster with gloves/outfit bonuses)
3. Receive **2–4 resources** (+ character level bonus)
4. Node depleted for **15s** (broadcast to all players)
5. Earn **1 XP per resource** toward character level

---

## 12. Forge & Bull Gear

### Forging
- Stand at **Forge**, spend **100–10,000 ore**
- More ore = lower common chance, higher epic/legendary odds

### Gear slots
**Coat, Horns, Hooves, Tail Wrap, Harness**

### Forge rarity → stat bonus
| Rarity | Bonus amount |
|--------|--------------|
| Common | 0 |
| Uncommon | +40 |
| Rare | +70 |
| Epic | +110 |
| Legendary | +160 |

### Champion gear (wheel exclusive)
**Champion** bull gear rolls **+130 (Epic)** or **+180 (Legendary)** — above forge maximums. Wheel jackpot only.

---

## 13. Global Races

### Schedule
- Default interval: **every 360 seconds (6 min)** (`RACE_INTERVAL_SEC` env override)
- **5 laps** per race
- Results painted on infield ~**10 seconds**, then next countdown

### Entry rules
- **Player bulls only** — no NPC fill-ins
- Bull must be **following you**
- Bull must have **100 energy** (full)
- **One bull per player** per race
- **No gold entry fee** — only energy

### Prizes (total purse: 1000g, split by field size)

Example for 6 runners: 1st 420g, 2nd 280g, 3rd 180g, 4th 120g, 5th–6th 0g. Scales for smaller fields.

### Race simulation
- Field locked and **pre-simulated** before start (persisted — no re-roll mid-race)
- Live standings broadcast to all clients
- Stats + equipped gear + temper drive outcomes

---

## 14. Betting

- **BETS booth** in the hub
- Wager **gold** on any entered bull before race lock
- Odds from **Monte Carlo simulation** (~1500 trials)
- **5% house edge** on payouts
- Winning bets pay `stake × odds`; losers forfeit stake

---

## 15. Economy & Marketplace

### Gold sources
- Race prizes, betting wins, selling on market, daily wheel
- (Not from Ansem — deposits **spend** gold for future $ANSEM)

### Gold sinks
- Breeding, rest, stable upgrades, den purchase/upgrades, training hay, store clothing, NPC bundles, **Ansem deposits**

### Player market listing types
| Type | Notes |
|------|-------|
| **Materials** | Stacks of 100 / 500 / 1000; price = gold per 100 units |
| **Bulls** | From stable |
| **Gear & clothing** | Unequipped items |
| **Gold for tokens** | Wallet required; on-chain SPL payment |

**Market fee:** **5%** on all sales.

**Cancel listings:** Materials, bulls, and items cancel **instantly**. Gold-for-token listings have a **30-second cancel cooldown**.

### NPC shop (at Market)
| Bundle | Price |
|--------|-------|
| Hay ×10 | 35g |
| Wood ×10 | 55g |
| Ore ×10 | 85g |

Plus **2 rotating shop bulls** per session with stat-based prices.

---

## 16. Solana / Token Features

**Production token mint** (`.env.example`): `G7iNNpEBpLSnq99hBqd7MqWje2TpEQCtD5keRj8hpump`

### Gold ↔ Token market (player listings)
- List gold for a token price (wallet signature required)
- Buyers pay via Solana transaction to treasury wallet
- Server verifies on-chain via Helius RPC

### Daily wheel gate
- Hold **≥ 10,000 tokens** in linked wallet
- **1 free spin per UTC day**

### Ansem (see §6)
Separate from the player market — admin-run cycles, pro-rata gold deposits, manual $ANSEM airdrop on close.

---

## 17. Daily Fortune Wheel

Located in the hub next to spawn.

| Outcome | Weight | Reward |
|---------|--------|--------|
| Small gold | 55% | 25–75g |
| Gold pouch | 27% | 100–250g |
| Big gold | 12% | 400–800g |
| Huge gold | 4% | 1200–2000g |
| **Jackpot** | 2% | Exclusive daily item |

Jackpot alternates: even UTC days = legendary/epic **clothing**; odd days = **Champion bull gear**. Same jackpot shown to all players that day.

---

## 18. Multiplayer & Social

### Real-time sync (Socket.io)
- Player positions & following bulls
- Chat & speech bubbles
- Resource node depletion/respawn
- Race grid, live animation, results
- Market listing created/sold/cancelled
- Pasture updates & den spawns

Other players see your display name, character level, shirt color, and up to **3 following bulls**.

---

## 19. Progression Paths

| Archetype | Path |
|-----------|------|
| **Casual rancher** | Gather → stable → breed → race occasionally |
| **Racer** | Optimize stats + gear → enter every race → bet |
| **Trader** | Farm materials → flip market listings |
| **Collector** | Hunt legendary traits via breeding + dens |
| **Token holder** | Wallet → wheel + market + **Ansem cycles** |

---

## 20. Quick Numbers Reference

| Constant | Value |
|----------|-------|
| World size | 56×56 |
| Race laps | 5 |
| Race interval | 360s (default) |
| Race entry energy | 100 |
| Race purse | 1000g total |
| Breed cost / time | 500g / 2 min |
| Rest | 80g → +50 energy |
| Gather time | 1.5s |
| Node respawn | 15s |
| Den price | 1000g + 5 wood |
| Den spawn interval | 60 min |
| Market fee | 5% |
| Wheel token requirement | 10,000 |
| Max character level | 25 |
| Max following bulls | 3 (at Lv25) |
| Forge ore range | 100–10,000 |
| Ansem position | (20.5, 27) |

---

## 21. FAQ

**Why can't I enter a race?**  
Bull must follow you, have 100 energy, and you can only enter one bull before lock.

**Why can't I deposit gold to Ansem?**  
A cycle must be open, you need a linked wallet, and enough gold. Stand next to Ansem in the hub.

**Why can't I spin the wheel or use the token market?**  
Link a Solana wallet in Profile. Wheel also requires 10,000+ tokens.

**How do I reach the track center?**  
Use the **west bridge** — only crossing.

**Is gold real money?**  
Gold is in-game. Token market and Ansem use real SPL tokens on Solana — only approve transactions you intend.

**Mobile?**  
Works in mobile browser; landscape recommended.

**In-game help?**  
Press **`?`** for the full guide with bull & gear galleries.

---

## 22. Key Source Files

| Area | Path |
|------|------|
| In-game guide | `apps/client/src/ui/gameGuideContent.tsx` |
| Ansem service | `apps/server/src/services/ansem.ts` |
| Ansem UI | `apps/client/src/ui/GameUI.tsx` (`AnsemPanel`, `AdminPanel`) |
| World build | `packages/shared/src/world/buildWorld.ts` |
| Bull rarity | `packages/shared/src/bullRarity.ts` |
| Race engine | `packages/shared/src/race/` |
| Game services | `apps/server/src/services/game.ts` |
| Constants | `packages/shared/src/constants.ts` |

---

*Last updated to reflect the Bull Race rebrand and Ansem gold→$ANSEM exchange.*
