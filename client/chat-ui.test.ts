import assert from 'node:assert/strict';
import test from 'node:test';
import { chatBubbleDuration, chatBubbleText } from './chat-ui';

test('chat bubbles require both the five-word and fifty-character limits', () => {
  assert.equal(chatBubbleText('Gut gespielt, das war knapp!'), 'Gut gespielt, das war knapp!');
  assert.equal(chatBubbleText('eins zwei drei vier fünf sechs'), null);
  assert.equal(chatBubbleText('a'.repeat(50)), 'a'.repeat(50));
  assert.equal(chatBubbleText('a'.repeat(51)), null);
  assert.equal(chatBubbleText('eins zwei drei vier ' + 'a'.repeat(30)), 'eins zwei drei vier ' + 'a'.repeat(30));
  assert.equal(chatBubbleText('eins zwei drei vier ' + 'a'.repeat(31)), null);
});

test('chat bubbles normalize whitespace, reject empty text and count Unicode characters', () => {
  assert.equal(chatBubbleText(' \tGut\n gespielt! '), 'Gut gespielt!');
  assert.equal(chatBubbleText('  \n\t '), null);
  assert.equal(chatBubbleText('😀'.repeat(50)), '😀'.repeat(50));
  assert.equal(chatBubbleText('😀'.repeat(51)), null);
});

test('chat notice reading time grows with Unicode text length between five and fifteen seconds', () => {
  assert.equal(chatBubbleDuration('Hi'), 5000);
  assert.equal(chatBubbleDuration('a'.repeat(50)), 5000);
  assert.equal(chatBubbleDuration('a'.repeat(80)), 8000);
  assert.equal(chatBubbleDuration('😀'.repeat(80)), 8000);
  assert.equal(chatBubbleDuration('a'.repeat(150)), 15000);
  assert.equal(chatBubbleDuration('a'.repeat(300)), 15000);
});
