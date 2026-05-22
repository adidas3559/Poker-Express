export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type CardState = {
  number: string; // 'ace' | 'king' | 'queen' | 'jack' | '2'-'10'
  suit: Suit;
};

export type CardCompare = {
  count: number,
  cards: CardState[],
}

export type HandRanking = {
  highestHand: string;
  player: PlayerState;
  allCards: CardState[],
  relevantCardValues: number[],
}

export type PlayerStatus = 'active' | 'folded' | 'busted';

export type PlayerState = {
  id: string;       // unique identifier — will be socket ID in multiplayer
  name: string;
  hand: CardState[];
  chips: number;
  currentBet: number; // amount committed to the pot this round
  status: PlayerStatus;
};

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'end';

export type GameState = {
  players: PlayerState[];
  deck: CardState[];          // remaining cards — only the server should read this
  tableCards: CardState[];
  pot: number;
  currentBet: number;         // the highest bet on the table this round
  smallBlind: number;
  bigBlind: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  lastRaisePlayerIndex: number; // betting round ends when action returns to this player
  phase: GamePhase;
  winners: (PlayerState | PlayerState[])[]; // array because of side pots — a nested array means a tie
  error: string,
};
