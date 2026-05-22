import { get } from 'lodash';
import type { CardCompare, CardState } from '../types/GameState';
import { getValue } from './utils';

const twoOfAKind = (cardsByValue: Map<string, CardCompare>) => {
  // By adding underscore to key (_key), we get typescript to ignore that key isn't being used
  // eslint-disable-next-line
  const twoOfAKind = [...cardsByValue.entries()].filter(([_key, value]) => value.count === 2);  
  const returnValue = (twoOfAKind || []).map(group => get(group, '[1].cards', []).map((card: CardState) => (getValue(get(card, 'number')))));
  return returnValue;
}

const threeOfAKind = (cardsByValue: Map<string, CardCompare>) => {
  // By adding underscore to key (_key), we get typescript to ignore that key isn't being used
  // eslint-disable-next-line
  const threeOfAKind = [...cardsByValue.entries()].filter(([_key, value]) => value.count === 3);
  const returnValue = get(threeOfAKind, '[0][1].cards', []).map((card: CardState) => (getValue(get(card, 'number'))));
  return returnValue;
}

const fourOfAKind = (cardsByValue: Map<string, CardCompare>) => {
  // By adding underscore to key (_key), we get typescript to ignore that key isn't being used
  // eslint-disable-next-line
  const fourOfAKind = [...cardsByValue.entries()].filter(([_key, value]) => value.count === 4);
  const returnValue = get(fourOfAKind, '[0][1].cards', []).map((card: CardState) => (getValue(get(card, 'number'))));
  return returnValue;
}

const straight = (allCards: CardState[]) => {
  // By adding underscore to key (_key), we get typescript to ignore that key isn't being used
  // eslint-disable-next-line
  let straightCount = 0;
  let lastValue = 0;
  let cardList: number[] = [];
  allCards.forEach(card => {
    if (lastValue - 1 === getValue(card.number)) {
      straightCount++;
      cardList = [...cardList, getValue(card.number)];
    } else {
      if (cardList.length >= 5) {
      return cardList;
    }
      straightCount = 1;
      cardList = [getValue(card.number)];
    }
    lastValue = getValue(card.number);
  });
  return cardList;
}

const flush = (cardsBySuit: Map<string, CardCompare>) => {
  // By adding underscore to key (_key), we get typescript to ignore that key isn't being used
  // eslint-disable-next-line
  const flush = [...cardsBySuit.entries()].find(([_key, value]) => value.count >= 5) || [];
  const returnValue = flush[1]?.cards?.map((card: CardState) => (getValue(card.number))) || [];
  return returnValue || [];
}


export {
  twoOfAKind,
  threeOfAKind, 
  fourOfAKind,
  straight,
  flush,
}

