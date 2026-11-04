'use strict';

/* =========================================================
   1. Calculator engine (no DOM, no eval)
   ========================================================= */

const OPERATORS = ['+', '-', '×', '÷'];
const MAX_LENGTH = 18;
const MAX_RESULT = 1e15;

/**
 * Evaluates an expression like "12+3×-4÷2" using a small
 * recursive-descent parser, which respects operator precedence.
 *   expression = term (("+" | "-") term)*
 *   term       = factor (("×" | "÷") factor)*
 *   factor     = "-" factor | number
 */
function evaluate(expr) {
  let pos = 0;

  const fail = () => { throw new Error('Invalid expression'); };

  function number() {
    const start = pos;
    while (pos < expr.length && /[\d.]/.test(expr[pos])) pos++;
    const text = expr.slice(start, pos);
    if (!text || text === '.' || (text.match(/\./g) || []).length > 1) fail();
    return parseFloat(text);
  }

  function factor() {
    if (expr[pos] === '-') { pos++; return -factor(); }
    return number();
  }

  function term() {
    let value = factor();
    while (expr[pos] === '×' || expr[pos] === '÷') {
      const op = expr[pos++];
      const right = factor();
      if (op === '÷') {
        if (right === 0) throw new Error('Cannot divide by zero');
        value /= right;
      } else {
        value *= right;
      }
    }
    return value;
  }

  function expression() {
    let value = term();
    while (expr[pos] === '+' || expr[pos] === '-') {
      const op = expr[pos++];
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  if (!expr) fail();
  const result = expression();
  if (pos < expr.length) fail();
  if (!Number.isFinite(result) || Math.abs(result) >= MAX_RESULT) {
    throw new Error('Result is too large');
  }
  // Round away floating-point noise (0.1 + 0.2 -> 0.3)
  return parseFloat(result.toPrecision(12));
}

/** Converts a number to a plain string (never scientific notation). */
function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
}

/** Holds calculator state and the rules for each button. */
function createCalculator() {
  const state = { expression: '', history: '', error: '', justEvaluated: false };

  const isOperator = (ch) => OPERATORS.includes(ch);
  const lastChar = () => state.expression.slice(-1);
  const currentNumber = () => (state.expression.match(/[\d.]*$/) || [''])[0];

  function reset() {
    state.expression = '';
    state.history = '';
    state.error = '';
    state.justEvaluated = false;
  }

  /** Typing a number after a result or an error starts fresh. */
  function startFreshIfNeeded() {
    if (state.error || state.justEvaluated) reset();
  }

  function inputDigit(digit) {
    startFreshIfNeeded();
    if (state.expression.length >= MAX_LENGTH) return;
    if (currentNumber() === '0') {
      state.expression = state.expression.slice(0, -1) + digit; // no leading zeros
    } else {
      state.expression += digit;
    }
  }

  function inputDecimal() {
    startFreshIfNeeded();
    if (state.expression.length >= MAX_LENGTH) return;
    const number = currentNumber();
    if (number.includes('.')) return;
    state.expression += number === '' ? '0.' : '.';
  }

  function inputOperator(op) {
    if (state.error) return;
    state.justEvaluated = false; // keep calculating with the previous result
    state.history = '';
    const last = lastChar();

    if (state.expression === '') {
      if (op === '-') state.expression = '-'; // allow a negative first number
      return;
    }
    if (isOperator(last)) {
      // Allow a negative sign after another operator (e.g. 5×-3)
      if (op === '-' && last !== '-') {
        if (state.expression.length < MAX_LENGTH) state.expression += op;
        return;
      }
      // Otherwise replace the previous operator(s)
      let trimmed = state.expression;
      while (isOperator(trimmed.slice(-1))) trimmed = trimmed.slice(0, -1);
      if (trimmed === '') return;
      state.expression = trimmed + op;
      return;
    }
    if (state.expression.length < MAX_LENGTH) state.expression += op;
  }

  function backspace() {
    if (state.error) { reset(); return; }
    state.justEvaluated = false;
    state.history = '';
    state.expression = state.expression.slice(0, -1);
  }

  function clear() { reset(); }

  /** % turns the number being typed into hundredths (50 -> 0.5). */
  function inputPercent() {
    if (state.error) return;
    const number = currentNumber();
    if (number === '' || number === '.') return;
    const value = formatNumber(parseFloat(number) / 100);
    state.expression = state.expression.slice(0, -number.length) + value;
    state.justEvaluated = false;
    state.history = '';
  }

  /** ± flips the sign of the number being typed. */
  function inputNegate() {
    if (state.error) return;
    const number = currentNumber();
    if (number === '') return;
    const start = state.expression.length - number.length;
    const before = state.expression[start - 1];
    let head = state.expression.slice(0, start);
    if (before === '-') {
      const isUnary = start - 1 === 0 || isOperator(state.expression[start - 2]);
      head = isUnary ? head.slice(0, -1) : head.slice(0, -1) + '+';
    } else if (before === '+') {
      head = head.slice(0, -1) + '-';
    } else {
      head += '-';
    }
    state.expression = head + number;
    state.justEvaluated = false;
    state.history = '';
  }

  function calculate() {
    if (state.error || state.expression === '') return;
    let expr = state.expression;
    while (isOperator(expr.slice(-1))) expr = expr.slice(0, -1); // "5+" -> "5"
    if (expr === '' || !/[+\-×÷]/.test(expr.slice(1))) {
      state.expression = expr;
      return; // nothing to calculate yet
    }
    try {
      const result = formatNumber(evaluate(expr));
      state.history = expr + ' =';
      state.expression = result;
      state.justEvaluated = true;
    } catch (err) {
      state.history = expr;
      state.expression = '';
      state.error = err.message;
    }
  }

  /** Live result shown while typing, e.g. "= 14". */
  function getPreview() {
    if (state.error) return '';
    if (state.justEvaluated) return state.history;
    let expr = state.expression;
    while (isOperator(expr.slice(-1))) expr = expr.slice(0, -1);
    if (!/[+\-×÷]/.test(expr.slice(1))) return '';
    try { return '= ' + formatNumber(evaluate(expr)); } catch { return ''; }
  }

  return { state, inputDigit, inputDecimal, inputOperator, backspace, clear, calculate, getPreview, inputPercent, inputNegate };
}

/* =========================================================
   2. User interface (buttons + keyboard)
   ========================================================= */

if (typeof document !== 'undefined') {
  const calc = createCalculator();
  const resultEl = document.getElementById('result');
  const historyEl = document.getElementById('history');
  const keysEl = document.querySelector('.keys');

  function render() {
    const { expression, error, history } = calc.state;
    const text = error || expression.replace(/-/g, '−') || '0';
    resultEl.textContent = text;
    historyEl.textContent = error ? history.replace(/-/g, '−') : (calc.getPreview() || '').replace(/-/g, '−');

    resultEl.classList.toggle('error', Boolean(error));
    resultEl.classList.toggle('medium', !error && text.length > 9 && text.length <= 13);
    resultEl.classList.toggle('small', !error && text.length > 13);
    resultEl.scrollLeft = resultEl.scrollWidth;
  }

  function press(action, value) {
    switch (action) {
      case 'digit':     calc.inputDigit(value); break;
      case 'decimal':   calc.inputDecimal(); break;
      case 'operator':  calc.inputOperator(value); break;
      case 'equals':    calc.calculate(); break;
      case 'backspace': calc.backspace(); break;
      case 'clear':     calc.clear(); break;
      case 'percent':   calc.inputPercent(); break;
      case 'negate':    calc.inputNegate(); break;
    }
    render();
  }

  // Mouse / touch
  keysEl.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) press(button.dataset.action, button.dataset.value);
  });

  // Keyboard
  const KEY_ALIASES = { x: '*', X: '*', ',': '.', '=': 'Enter', Delete: 'Escape' };

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = KEY_ALIASES[event.key] || event.key;
    const button = keysEl.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (!button) return;

    event.preventDefault(); // stops Enter re-clicking a focused button, "/" quick-find, etc.
    press(button.dataset.action, button.dataset.value);

    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), 120);
  });

  render();
}

// Allows the engine to be tested in Node (ignored in the browser)
if (typeof module !== 'undefined') module.exports = { evaluate, formatNumber, createCalculator };
