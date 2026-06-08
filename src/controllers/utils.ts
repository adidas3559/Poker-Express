import type { PlayerState, CardState, Suit, GameState, CardCompare, HandRanking } from "../types/GameState";
import { flush, fourOfAKind, straight, threeOfAKind, twoOfAKind } from "./handUtils";


const getNextActiveIndex = (players: PlayerState[], startIndex: number) => {
  let index = startIndex;
  do {
    index = (index + 1) % players.length;
  } while (players[index].status === 'busted' || players[index].status === 'folded');

  return index;
}

const getNextActivePlayer = (players: PlayerState[], startIndex: number) => {
  let index = startIndex;
  do {
    index = (index + 1) % players.length;
  } while (players[index].status === 'busted' || players[index].status === 'folded');

  return players[index];
}

const createDeck = ():CardState[] => {
  const cards: CardState[] = [];
  const suits: Array<Suit> = ['spades', 'hearts', 'diamonds', 'clubs'];
  suits.forEach(suit => {
    const suitString: Suit = suit as Suit;
    for(let i:number = 2; i <= 10; i++) {
      const newCard: CardState = { number: i.toString(), suit: suitString };
      cards.push(newCard);
    }
    cards.push({number: 'jack', suit: suitString });
    cards.push({ number: 'queen', suit: suitString });
    cards.push({ number: 'king', suit: suitString });
    cards.push({ number: 'ace', suit: suitString });
  });
  return cards;
}

const shuffleDeck = (deck:CardState[]): CardState[] => {
  let m = deck.length, t, i;

  // While there remain elements to shuffle…
  while (m) {

    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    t = deck[m];
    deck[m] = deck[i];
    deck[i] = t;
  }
  
  return deck;
}

const howManyActivePlayers = (players: PlayerState[]) => {
  const activePlayerCount = players.reduce((count, player) => {
    if (player.status === 'busted') {
      return count;
    }
    return count + 1;
  }, 0);
  
  return activePlayerCount;
}

const drawCard = (deck: CardState[]): CardState => {
  return deck.pop() as CardState;
}

const getLeftOfDealer = (game: GameState) => {
  const currentPlayerIndex = getNextActiveIndex(game.players, game.dealerIndex);
  const lastRaisePlayerIndex = getNextActiveIndex(game.players, game.dealerIndex);
  return {
    currentPlayerIndex,
    lastRaisePlayerIndex,
  }
}

const getHandRanking = (player: PlayerState, tableCards: CardState[]) => {
  const hand: CardState[] = player.hand;
  const allCards: CardState[] = [...hand, ...tableCards];
  allCards.sort((a, b) => (getValue(b.number) - getValue(a.number)));


  // key: number (each value)
  // value: { count: number, cards: card[] }
  const cardsByValue = new Map<string, CardCompare>();
  allCards.forEach(card => {
    if (cardsByValue.has(card.number)) {
      const count = (cardsByValue.get(card.number)?.count ?? 0) + 1;
      const cards = cardsByValue.get(card.number)?.cards ?? [];
      cardsByValue.set(card.number, { count: count, cards: [card, ...cards] });
    } else {
      cardsByValue.set(card.number, { count: 1, cards: [card] });
    }
  });
  const cardValues:number[] = allCards.map(card => getValue(card.number));


  // key: string (each suit)
  // value: { count: number, cards: card[] }
  const cardsBySuit = new Map<string, CardCompare>();
  allCards.forEach(card => {
    if (cardsBySuit.has(card.suit)) {
      const count = (cardsBySuit.get(card.suit)?.count ?? 0) + 1;
      const cards = cardsBySuit.get(card.suit)?.cards ?? [];
      cardsBySuit.set(card.suit, { count: count, cards: [card, ...cards] });
    } else {
      cardsBySuit.set(card.suit, { count: 1, cards: [card] });
    }
  });

  
  // added checks here
  
  

  // let relevantCards:Card[][] = [];
  let relevantCardsSimpler: number[] = [];
  let highestHand = 'highCard';
  relevantCardsSimpler = allCards.map(card => getValue(card.number));

  if (twoOfAKind(cardsByValue).length > 0) {
    highestHand = 'pair';
    relevantCardsSimpler = twoOfAKind(cardsByValue).flat();
  };
  if (twoOfAKind(cardsByValue).length > 1) {
    highestHand = 'twoPair';
    relevantCardsSimpler = twoOfAKind(cardsByValue).flat();
  }
  if (threeOfAKind(cardsByValue).length > 0) {
    highestHand = 'threeOfAKind';
    relevantCardsSimpler = threeOfAKind(cardsByValue);
  }
  if (straight(allCards).length >= 5) {
    highestHand = 'straight';
    relevantCardsSimpler = straight(allCards);
  }
  if (flush(cardsBySuit).length > 0) {
    highestHand = 'flush';
    relevantCardsSimpler = flush(cardsBySuit);
  }
  if (threeOfAKind(cardsByValue).length > 0 && twoOfAKind(cardsByValue).length > 0) {
    highestHand = 'fullHouse';
    relevantCardsSimpler = [...threeOfAKind(cardsByValue), ...twoOfAKind(cardsByValue).flat()];
  }
  if (fourOfAKind(cardsByValue).length > 0) {
    highestHand = 'fourOfAKind';
    relevantCardsSimpler = fourOfAKind(cardsByValue);
  }
  if (straight(allCards).length >= 5 && flush(cardsBySuit).length > 0) {
    highestHand = 'straightFlush';
    relevantCardsSimpler = straight(allCards);
    
    if (
      getValue(allCards[0].number) === 14 &&
      getValue(allCards[1].number) === 13 &&
      getValue(allCards[2].number) === 12 &&
      getValue(allCards[3].number) === 11 &&
      getValue(allCards[4].number) === 10
    ) {
      highestHand = 'royalFlush';
    }
  }
  
  const singleCards = cardValues.filter(card => !relevantCardsSimpler.includes(card));
  const relevantCardValues = [...relevantCardsSimpler, ...singleCards].slice(0, 5);
  
  return { highestHand, player, allCards, relevantCardValues };
}

const orderMap = new Map([
  ['ace', 14],
  ['king', 13],
  ['queen', 12],
  ['jack', 11],
]);

const getValue = (cardValue: string):number => {
  let value:number = Number(cardValue)
  if (isNaN(value)) {
    value = orderMap.get(cardValue) ?? 0;
  }

  return value;
}

const contestHands = (highestPlayers: HandRanking[]) => {
  const highestPlayersMap = new Map();
  highestPlayers.forEach(player => {
    const hand = player.highestHand;
    if (highestPlayersMap.has(hand)) {
      highestPlayersMap.set(hand, [...highestPlayersMap.get(hand), player])
    } else {
      highestPlayersMap.set(hand, [player]);
    }
  });

  const playersOrder: HandRanking[] = [];
  for (const key of highestPlayersMap.keys()) {
    const handPlayers = highestPlayersMap.get(key);
    handPlayers.sort((a:HandRanking, b:HandRanking) => {
      return compareSortedArrays(a.relevantCardValues, b.relevantCardValues);
    });
    
    playersOrder.push(...handPlayers)
  }

  // check for identicals
  const combinedPlayersHands = combineDuplicateHands(playersOrder);
  
  const combinedPlayers = combinedPlayersHands.map(item => {
    if (Array.isArray(item)) {
      return item.map(nestedItem => nestedItem.player);
    }
    return item.player;
  })

  return combinedPlayers;
}

const compareSortedArrays = (arr1: number[], arr2: number[]) => {
  if (!arr2) return arr1;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] > arr2[i]) {
      return -1;
    }
    if (arr2[i] > arr1[i]) {
      return 1;
    }
  }
  return 0
}

function arraysEqual(a: number[], b: number[]): boolean {                                          
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

type nestedHandRanking = (HandRanking | HandRanking[])[];

function combineDuplicateHands(players: HandRanking[]): nestedHandRanking {
  const playersCombined: nestedHandRanking = [];
  if (players.length <= 1) {
    return players;
  }
  for (let i = 0; i < players.length; i++) {
    const currentPlayer = players[i];
    if (i === players.length - 1) {
      const arrayHasLastPlayer = playersCombined.flat().some(player => player.player.id === players[i].player.id);
      if (!arrayHasLastPlayer) {
        playersCombined.push(currentPlayer);
      }
      continue;
    }
    
    const prevPlayer = players[i + 1];
    if (arraysEqual(currentPlayer.relevantCardValues, prevPlayer.relevantCardValues)) {
      // check if prevPlayer is already in group
      if (Array.isArray(playersCombined[playersCombined.length - 1])) {
        playersCombined[playersCombined.length - 1] = [...playersCombined[playersCombined.length - 1] as HandRanking[], currentPlayer];
        // playersCombined.push([prevPlayer, currentPlayer]);
      } else {
        playersCombined.push([prevPlayer, currentPlayer]);
      }
      // else puch players into 
    } else {
      playersCombined.push(currentPlayer);
    }
  }
  return playersCombined;
}


const copyPlayers = (players: PlayerState[]): PlayerState[] =>
  players.map(player => ({ ...player, hand: [...player.hand] }));

export {
  getNextActiveIndex,
  getNextActivePlayer,
  createDeck,
  shuffleDeck,
  howManyActivePlayers,
  drawCard,
  getLeftOfDealer,
  getHandRanking,
  getValue,
  contestHands,
  copyPlayers,
}