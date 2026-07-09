import {
  BULL_MAX_ENERGY,
  RACE_ENTRY_ENERGY,
  ENERGY_REGEN_BASE_PER_MIN,
  ENERGY_REGEN_TICK_MS,
  MARKET_LIST_QUANTITIES,
  FORGE_MIN_ORE,
  BREED_COST,
  REST_COST,
  REST_ENERGY,
  stableWoodNeed,
  stableGoldNeed,
} from '@bullrun/shared';
import type { ReactNode } from 'react';

export interface GuideSection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface GuideGroup {
  label: string;
  sections: GuideSection[];
}

function P({ children }: { children: ReactNode }) {
  return <p className="guide-p">{children}</p>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="guide-h3">{children}</h3>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="guide-ul">{children}</ul>;
}

function LI({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

function Strong({ children }: { children: ReactNode }) {
  return <strong className="guide-strong">{children}</strong>;
}

const energyPerTick = Math.max(1, Math.round((ENERGY_REGEN_BASE_PER_MIN * ENERGY_REGEN_TICK_MS) / 60_000));

export const GUIDE_GROUPS: GuideGroup[] = [
  {
    label: 'Getting Started',
    sections: [
      {
        id: 'intro',
        title: 'Welcome to Bull Run',
        body: (
          <>
            <P>
              <Strong>Bull Run</Strong> is a bull racing MMO. Connect your Solana wallet, gather materials,
              breed and equip bulls, enter global races, bet gold, trade on the market, and explore the ranch with other
              players in real time.
            </P>
            <P>
              Your wallet is your account — no password. Hold the required SPL token balance to enter the world after
              signing in.
            </P>
          </>
        ),
      },
      {
        id: 'wallet',
        title: 'Wallet & Access',
        body: (
          <>
            <P>
              Connect a Solana wallet, then sign a free message to prove ownership. Pick a display name — that&apos;s
              what other players see on the ranch and in race results.
            </P>
            <UL>
              <LI>The game only asks for login signatures and marketplace transactions you start — never your seed phrase.</LI>
              <LI>Disconnect anytime from Profile.</LI>
            </UL>
          </>
        ),
      },
      {
        id: 'controls',
        title: 'Moving & Camera',
        body: (
          <>
            <UL>
              <LI><Strong>Click the ground</Strong> to walk. Click trees, rocks, hay piles, and buildings to interact when close enough.</LI>
              <LI><Strong>WASD / arrow keys</Strong> pan the camera.</LI>
              <LI><Strong>Bottom bar</Strong> opens Stable, Race, Bet, Market, Forge, Items, Profile, and this guide (?).</LI>
              <LI><Strong>Chat</Strong> — type in the chat box to talk with everyone online.</LI>
            </UL>
          </>
        ),
      },
    ],
  },
  {
    label: 'Ranch Life',
    sections: [
      {
        id: 'gathering',
        title: 'Gathering Materials',
        body: (
          <>
            <P>
              Click resource nodes on the map — <Strong>hay</Strong>, <Strong>ore</Strong>, and <Strong>wood</Strong> —
              while standing nearby. A short gather bar fills; you receive a random bundle when it completes.
            </P>
            <P>Nodes respawn after depletion. New players start with 0 of each material — gather before training, forging, or upgrading.</P>
          </>
        ),
      },
      {
        id: 'stable',
        title: 'Stable & Bulls',
        body: (
          <>
            <P>
              Your <Strong>Stable</Strong> holds bulls. Bank wood in 10-unit chunks, then pay gold to level up and unlock
              more slots. Level 1 needs <Strong>{stableWoodNeed(1)} wood + {stableGoldNeed(1)}g</Strong> (costs rise each level).
              Each bull has speed, stamina, accel, level, XP, and energy.
            </P>
            <UL>
              <LI><Strong>Follow me</Strong> — one bull can follow you on the map (needed to enter races).</LI>
              <LI><Strong>Train</Strong> — spend hay to boost a stat.</LI>
              <LI><Strong>Rest</Strong> — {REST_COST}g restores {REST_ENERGY} energy.</LI>
              <LI><Strong>Breed</Strong> — {BREED_COST}g + two bulls, ~2 min wait for a new calf.</LI>
              <LI><Strong>Rename / delete</Strong> — manage bulls you don&apos;t want.</LI>
            </UL>
            <P>
              Energy regens passively: <Strong>{energyPerTick} energy every {ENERGY_REGEN_TICK_MS / 1000}s</Strong> ({ENERGY_REGEN_BASE_PER_MIN}/min at stable level 1). Higher stable level = faster recovery.
            </P>
          </>
        ),
      },
      {
        id: 'items',
        title: 'Forge & Equipment',
        body: (
          <>
            <P>
              At the <Strong>Forge</Strong>, spend ore ({FORGE_MIN_ORE}+) to roll random coat items. Rarity improves with
              more ore. Equip items from your bag onto a bull to boost stats in races.
            </P>
            <P>Open <Strong>Items</Strong> from the bottom bar to equip or unequip gear.</P>
          </>
        ),
      },
      {
        id: 'dens',
        title: 'Dens & Pastures',
        body: (
          <>
            <P>
              Buy a <Strong>den</Strong> plot on the map (gold + wood) to house extra bulls. Move bulls between stable
              and den. Pastures can spawn wild bulls over time — watch for notifications.
            </P>
          </>
        ),
      },
    ],
  },
  {
    label: 'Racing',
    sections: [
      {
        id: 'races',
        title: 'Global Races',
        body: (
          <>
            <P>
              Races run on a server timer — check the <Strong>NEXT RACE</Strong> countdown at the top of the screen or at
              the track. When the grid appears, registered player bulls line up; then the race plays out live for everyone.
            </P>
            <UL>
              <LI><Strong>Player bulls only</Strong> — no NPC fill-ins. Only wallets that entered appear.</LI>
              <LI>Entry costs <Strong>{RACE_ENTRY_ENERGY} energy</Strong> (bull must be at full {BULL_MAX_ENERGY}).</LI>
              <LI><Strong>One bull per player</Strong> per race.</LI>
              <LI>Your bull must be <Strong>following you</Strong> to enter at the Race booth.</LI>
              <LI>Top finishers earn gold and XP; results show ~10 seconds then the next countdown begins.</LI>
            </UL>
          </>
        ),
      },
      {
        id: 'betting',
        title: 'Betting',
        body: (
          <>
            <P>
              At the <Strong>Bet</Strong> booth, wager gold on any entered bull before the race starts. Odds are simulated
              from stats and gear. Adjust your bet amount with +/−, then pick a bull.
            </P>
            <P>Winning bets pay out at the shown multiplier; losing bets forfeit the stake.</P>
          </>
        ),
      },
    ],
  },
  {
    label: 'Economy',
    sections: [
      {
        id: 'market',
        title: 'Marketplace',
        body: (
          <>
            <UL>
              <LI><Strong>Materials</Strong> — list stacks of {MARKET_LIST_QUANTITIES.join(', ')}. Set price as <Strong>gold per 100 units</Strong> (e.g. 5g/100 → 5g for 100 hay, 25g for 500).</LI>
              <LI><Strong>Bulls</Strong> — list stable bulls for gold.</LI>
              <LI><Strong>Gold for tokens</Strong> — sell gold for SPL tokens on-chain (buyers pay via wallet).</LI>
              <LI><Strong>NPC shop</Strong> — buy material bundles with gold.</LI>
            </UL>
            <P>Browse open listings from other players and buy instantly if you have enough gold.</P>
            <P>
              You can <Strong>cancel your own listings</Strong> anytime. Material and bull listings return instantly.
              Gold-for-token listings have a <Strong>30 second cancel delay</Strong> so buyers mid-checkout aren&apos;t sniped.
            </P>
          </>
        ),
      },
      {
        id: 'gold',
        title: 'Gold',
        body: (
          <>
            <P>
              Gold comes from race prizes, selling on the market, and betting wins. Spend it on breeding, resting, dens,
              training, and NPC shop bundles.
            </P>
          </>
        ),
      },
    ],
  },
  {
    label: 'Reference',
    sections: [
      {
        id: 'faq',
        title: 'FAQ',
        body: (
          <>
            <H3>Why can&apos;t I enter a race?</H3>
            <P>Bull must follow you, have {BULL_MAX_ENERGY} energy, and you can only enter one bull per race before the lock.</P>
            <H3>Why did my bull teleport or results look wrong?</H3>
            <P>Refresh mid-race can desync — try staying connected through the finish. Report persistent bugs to the team.</P>
            <H3>Is this real money?</H3>
            <P>Gold is in-game. Gold-for-token listings use your wallet on Solana — only approve transactions you intend.</P>
            <H3>Mobile?</H3>
            <P>Works in mobile browser; landscape recommended.</P>
          </>
        ),
      },
    ],
  },
];

export const ALL_GUIDE_SECTIONS = GUIDE_GROUPS.flatMap((g) => g.sections);
