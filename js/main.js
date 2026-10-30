import { initWorld, previewCharacter, startGame, setPaused } from './world.js';
import { initUI, openLock, openMinigame, toast, showWin, openNote, askQuestion, choose } from './ui.js';
import { initAudio, sfx, ambience } from './audio.js';

initWorld(document.getElementById('scene'), {
  openLock, openMinigame, openNote, askQuestion, choose, toast, sfx, ambience,
  onEscape: showWin,
});

initUI({
  onPreview: previewCharacter,
  onStart: startGame,
  setPaused,
});

// Browsers only allow sound after a user gesture.
const unlock = () => { initAudio(); ambience(0); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);

document.getElementById('boot')?.remove();
