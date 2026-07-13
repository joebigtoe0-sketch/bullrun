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
  WHEEL_MIN_TOKENS,
  stableWoodNeed,
  stableGoldNeed,
} from '@bullrace/shared';
import type { ReactNode } from 'react';
import { BullGallery, GearGallery } from './GuideGalleries';

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
        title: 'Welcome to Bull Race',
        body: (
          <>
            <P>
              <Strong>Bull Race</Strong> is a bull racing MMO. Gather materials, breed and equip bulls, dress up your
              rancher, enter global races, bet gold, trade on the player market, and explore the ranch with other
              players in real time.
            </P>
            <P>
              You spawn at the <Strong>central hub</Strong> inside the race track — race signup, the betting booth, and
              the daily fortune wheel are all right there. The <Strong>walkover bridge</Strong> on the west side is the
              only way in and out of the infield.
            </P>
          </>
        ),
      },
      {
        id: 'account',
        title: 'Account & Wallet',
        body: (
          <>
            <P>
              Sign up with a <Strong>username and password</Strong> — that&apos;s all you need to play. Your display
              name is what other players see on the ranch and in race results.
            </P>
            <P>
              Connecting a <Strong>Solana wallet</Strong> is optional. Do it from <Strong>Profile</Strong> when you
              want the token features:
            </P>
            <UL>
              <LI>Selling gold for SPL tokens (and buying token listings) on the market.</LI>
              <LI>Spinning the <Strong>daily wheel</Strong> (requires holding {WHEEL_MIN_TOKENS.toLocaleString()} tokens).</LI>
            </UL>
            <UL>
              <LI>The game only asks for a free link signature and marketplace transactions you start — never your seed phrase.</LI>
              <LI>A wallet can only be linked to one account.</LI>
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
              <LI><Strong>Bottom bar</Strong> opens Stable, Race, Bet, Market, Forge, Store, Items, Profile, and this guide (?).</LI>
              <LI><Strong>Chat</Strong> — type in the chat box to talk with everyone online.</LI>
              <LI>The track blocks walking — cross it over the <Strong>bridge</Strong> west of the hub.</LI>
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
              Click resource nodes on the map — <Strong>wood</Strong> (axe), <Strong>ore</Strong> (pickaxe), and{' '}
              <Strong>hay</Strong> (pitchfork) — while standing nearby. A short gather bar fills; you receive a random
              bundle when it completes.
            </P>
            <P>
              Nodes respawn after depletion. Clothing from the <Strong>General Store</Strong> speeds up gathering and
              walking — see the next section.
            </P>
          </>
        ),
      },
      {
        id: 'leveling',
        title: 'Character Level',
        body: (
          <>
            <P>
              Every resource you gather gives <Strong>1 XP</Strong>. Your level (shown next to your name and in the
              top-left bar) unlocks perks — leveling is slow and the climb gets much steeper, capping at{' '}
              <Strong>level 25</Strong> for now.
            </P>
            <UL>
              <LI><Strong>More yield</Strong> — +1 resource per gather every 5 levels.</LI>
              <LI><Strong>Level 10</Strong> — a second bull can follow you.</LI>
              <LI><Strong>Level 25</Strong> — a third bull can follow you.</LI>
            </UL>
          </>
        ),
      },
      {
        id: 'clothing',
        title: 'Clothing & General Store',
        body: (
          <>
            <P>
              The <Strong>General Store</Strong> (north-east homestead, or the Store button) sells clothing for your
              rancher: <Strong>hat, outfit, boots, and gloves</Strong>. Each piece gives a % bonus — walk speed, wood
              cutting, mining, or hay gathering — and shows on your character.
            </P>
            <UL>
              <LI>Rarities run <Strong>Common → Uncommon → Rare → Epic → Legendary</Strong>; better rarity, bigger bonus.</LI>
              <LI>Wear pieces from <Strong>Items → Your outfit</Strong>. One item per slot.</LI>
              <LI>Clothing can be resold on the player market.</LI>
              <LI>The rarest clothing only drops from the <Strong>daily wheel jackpot</Strong>.</LI>
            </UL>
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
        title: 'Forge & Bull Gear',
        body: (
          <>
            <P>
              At the <Strong>Forge</Strong>, spend ore ({FORGE_MIN_ORE}+) to roll random bull gear — coats, horns,
              hooves, tail wraps, and harnesses. Rarity improves with more ore. Equip gear onto a bull from the Stable
              panel or <Strong>Items</Strong> to boost race stats.
            </P>
            <P>
              <Strong>Champion</Strong> gear with rolls beyond the forge&apos;s best exists only as a daily wheel
              jackpot. Bull gear can be sold on the player market too.
            </P>
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
              Races run on a server timer — check the <Strong>NEXT RACE</Strong> countdown at the top of the screen or
              painted on the infield. Sign up at the <Strong>RACE SIGNUP</Strong> kiosk in the hub. When the grid
              appears, registered bulls line up; then the race plays out live for everyone.
            </P>
            <UL>
              <LI><Strong>Player bulls only</Strong> — no NPC fill-ins.</LI>
              <LI>Entry costs <Strong>{RACE_ENTRY_ENERGY} energy</Strong> (bull must be at full {BULL_MAX_ENERGY}).</LI>
              <LI><Strong>One bull per player</Strong> per race.</LI>
              <LI>Your bull must be <Strong>following you</Strong> to enter.</LI>
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
              At the <Strong>BETS</Strong> booth in the hub, wager gold on any entered bull before the race starts. Odds
              are simulated from stats and gear. Adjust your bet amount with +/−, then pick a bull.
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
              <LI><Strong>Gear & clothing</Strong> — list unequipped bull gear and rancher clothing for gold.</LI>
              <LI><Strong>Gold for tokens</Strong> — sell gold for SPL tokens on-chain (wallet required, buyers pay via wallet).</LI>
              <LI><Strong>NPC shop</Strong> — buy material bundles with gold.</LI>
            </UL>
            <P>Browse open listings from other players and buy instantly if you have enough gold. All sales pay a 5% fee.</P>
            <P>
              You can <Strong>cancel your own listings</Strong> anytime. Material, bull, and item listings return
              instantly. Gold-for-token listings have a <Strong>30 second cancel delay</Strong> so buyers mid-checkout
              aren&apos;t sniped.
            </P>
          </>
        ),
      },
      {
        id: 'wheel',
        title: 'Daily Fortune Wheel',
        body: (
          <>
            <P>
              The <Strong>DAILY WHEEL</Strong> stands in the hub next to spawn. One free spin per day (UTC). To spin you
              must have a wallet connected in Profile holding at least{' '}
              <Strong>{WHEEL_MIN_TOKENS.toLocaleString()} tokens</Strong>.
            </P>
            <UL>
              <LI>Most spins win gold — small amounts are common, big pouches are rare.</LI>
              <LI>The <Strong>JACKPOT</Strong> is the day&apos;s exclusive item — rare/legendary bull gear or clothing you can&apos;t get anywhere else. Everyone sees the same jackpot item each day; it&apos;s shown in the wheel popup.</LI>
            </UL>
          </>
        ),
      },
      {
        id: 'gold',
        title: 'Gold',
        body: (
          <>
            <P>
              Gold comes from race prizes, selling on the market, betting wins, and the daily wheel. Spend it on
              breeding, resting, dens, training, store clothing, and NPC shop bundles.
            </P>
          </>
        ),
      },
    ],
  },
  {
    label: 'Gallery',
    sections: [
      {
        id: 'bull-gallery',
        title: 'All Bulls & Traits',
        body: (
          <>
            <P>
              Every bull trait in the game, live. Traits are rolled when a bull is born (breeding, den spawns, shop) —
              rarer bulls roll from cooler pools.
            </P>
            <BullGallery />
          </>
        ),
      },
      {
        id: 'gear-gallery',
        title: 'All Gear & Clothing',
        body: (
          <>
            <P>Everything equippable — bull gear from the forge, clothing from the store, and wheel exclusives.</P>
            <GearGallery />
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
            <H3>Why can&apos;t I spin the wheel or sell gold for tokens?</H3>
            <P>Those need a Solana wallet — connect one from Profile. The wheel also requires holding {WHEEL_MIN_TOKENS.toLocaleString()} tokens.</P>
            <H3>How do I get into the middle of the track?</H3>
            <P>Use the walkover bridge on the west side — it&apos;s the only crossing.</P>
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
