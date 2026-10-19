export class DialogueManager {
  constructor(onComplete) {
    this.container = document.getElementById('dialogue-container');
    this.textEl = document.getElementById('dialogue-text');
    this.optionsEl = document.getElementById('dialogue-options');
    this.hintEl = document.getElementById('dialogue-hint');
    this.defaultOnComplete = onComplete;
    this.currentOnComplete = null;

    this.isActive = false;
    this.isTyping = false;
    this.isChoosing = false;
    this.fullText = '';
    this.currentChar = 0;
    this.typeTimer = null;
    this.allowAdvance = false;
    this.queue = [];
    this.queueIndex = 0;
    this.choices = [];
    this.selectedChoiceIndex = 0;
  }

  handlePointerDown() {
    if (!this.isActive) return;
    if (!this.isChoosing) {
      this.advance();
    }
  }

  startDialogue(input, onComplete = null) {
    const lines = Array.isArray(input) ? input : [input];
    if (this.isActive && !this.isChoosing) {
      this.queue.push(...lines);
      if (onComplete && !this.currentOnComplete) {
        this.currentOnComplete = onComplete;
      }
      return;
    }
    this.isActive = true;
    this.isChoosing = false;
    this.currentOnComplete = onComplete;
    this.queue = [...lines];
    this.queueIndex = 0;

    if (this.optionsEl) {
      this.optionsEl.innerHTML = '';
      this.optionsEl.classList.add('hidden');
    }
    this.textEl.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.showLine(this.queue[0]);
  }

  showChoices(input, onComplete = null, gameState = null) {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.isActive = true;
    this.isTyping = false;
    this.isChoosing = true;
    this.currentOnComplete = onComplete;
    if (gameState) this.gameState = gameState;

    let choicesList = [];
    let promptText = '';

    if (Array.isArray(input)) {
      choicesList = input;
    } else if (input && typeof input === 'object') {
      choicesList = input.choices || [];
      promptText = input.prompt || '';
    }

    if (this.gameState) {
      choicesList = choicesList.filter(c => {
        if (typeof c.condition === 'function') return c.condition(this.gameState);
        if (typeof c.condition === 'boolean') return c.condition;
        return true;
      });
    }

    this.choices = choicesList;
    this.selectedChoiceIndex = 0;

    if (promptText) {
      this.textEl.textContent = promptText;
      this.textEl.classList.remove('hidden');
    } else {
      this.textEl.textContent = '';
      this.textEl.classList.add('hidden');
    }

    if (this.optionsEl) {
      this.optionsEl.classList.remove('hidden');
    }
    this.hintEl.textContent = '[W/S] Navigate | [E]/[Space]/[Enter] Select';
    this.container.classList.remove('hidden');

    this.renderChoices();
  }

  renderChoices() {
    if (!this.optionsEl) return;
    this.optionsEl.innerHTML = '';
    this.choices.forEach((choice, index) => {
      const isSelected = index === this.selectedChoiceIndex;
      const el = document.createElement('div');
      el.className = `dialogue-choice ${isSelected ? 'selected' : ''}`;
      el.innerHTML = `
        <span class="choice-arrow">${isSelected ? '▶' : '&nbsp;'}</span>
        <span class="choice-label">${choice.label || choice.text || choice}</span>
      `;
      el.addEventListener('mouseenter', () => {
        this.selectedChoiceIndex = index;
        this.renderChoices();
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectChoice(index);
      });
      this.optionsEl.appendChild(el);
    });
  }

  selectChoice(index) {
    if (!this.isChoosing) return;
    const choice = this.choices[index];
    if (!choice) return;

    this.isChoosing = false;
    if (this.optionsEl) {
      this.optionsEl.innerHTML = '';
      this.optionsEl.classList.add('hidden');
    }
    this.textEl.classList.remove('hidden');

    this.pendingNextChoices = choice.nextChoices || null;

    if (typeof choice.action === 'function') {
      choice.action({ dialogue: this, choice, index, gameState: this.gameState });
    }

    if (choice.lines && choice.lines.length > 0) {
      this.queue = Array.isArray(choice.lines) ? [...choice.lines] : [choice.lines];
      this.queueIndex = 0;
      this.showLine(this.queue[0]);
    } else if (typeof choice.lines === 'string') {
      this.queue = [choice.lines];
      this.queueIndex = 0;
      this.showLine(this.queue[0]);
    } else if (this.pendingNextChoices) {
      const next = this.pendingNextChoices;
      this.pendingNextChoices = null;
      this.showChoices(next, this.currentOnComplete, this.gameState);
    } else if (typeof choice.action !== 'function') {
      this.closeDialogue();
    }
  }

  showLine(text) {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.isTyping = true;
    this.allowAdvance = false;
    this.fullText = text;
    this.currentChar = 0;

    this.textEl.textContent = '';
    this.hintEl.textContent = '[E] / [Space] Fast Forward';

    setTimeout(() => {
      this.allowAdvance = true;
    }, 120);

    this.startTypewriter();
  }

  startTypewriter() {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.typeTimer = setInterval(() => {
      this.currentChar++;
      this.textEl.textContent = this.fullText.substring(0, this.currentChar);
      if (this.currentChar >= this.fullText.length) {
        this.finishTyping();
      }
    }, 35);
  }

  finishTyping() {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.textEl.textContent = this.fullText;
    this.isTyping = false;
    const hasMore = (this.queueIndex < this.queue.length - 1) || Boolean(this.pendingNextChoices);
    this.hintEl.textContent = hasMore ? '[E] / [Space] Next' : '[E] / [Space] Close';
  }

  closeDialogue(runCallback = true) {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.isActive = false;
    this.isTyping = false;
    this.isChoosing = false;
    this.pendingNextChoices = null;
    this.queue = [];
    this.queueIndex = 0;
    this.choices = [];
    if (this.optionsEl) {
      this.optionsEl.innerHTML = '';
      this.optionsEl.classList.add('hidden');
    }
    this.textEl.classList.remove('hidden');
    this.container.classList.add('hidden');
    const cb = this.currentOnComplete || this.defaultOnComplete;
    this.currentOnComplete = null;
    if (runCallback && cb) {
      cb();
    }
  }

  advance() {
    if (!this.isActive || !this.allowAdvance || this.isChoosing) return;
    if (this.isTyping) {
      this.finishTyping();
    } else if (this.queueIndex < this.queue.length - 1) {
      this.queueIndex++;
      this.showLine(this.queue[this.queueIndex]);
    } else if (this.pendingNextChoices) {
      const next = this.pendingNextChoices;
      this.pendingNextChoices = null;
      this.showChoices(next, this.currentOnComplete, this.gameState);
    } else {
      this.closeDialogue();
    }
  }

  handleKeyDown(e) {
    if (!this.isActive) return;

    if (this.isChoosing) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (this.choices.length > 0) {
          this.selectedChoiceIndex = (this.selectedChoiceIndex - 1 + this.choices.length) % this.choices.length;
          this.renderChoices();
        }
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (this.choices.length > 0) {
          this.selectedChoiceIndex = (this.selectedChoiceIndex + 1) % this.choices.length;
          this.renderChoices();
        }
      } else if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.selectChoice(this.selectedChoiceIndex);
      }
      return;
    }

    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.advance();
    }
  }
}
