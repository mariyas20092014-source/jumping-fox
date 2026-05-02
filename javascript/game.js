/* --- CONFIGURATION --- */
const IMAGES = {
    idle: 'images/fox.gif',
    jump: 'images/jumping-fox.png',
    fall: 'images/fox1.png'
};

const TOTAL_STEPS = 6; // Number of jumps to cross the river

// Pool of questions. Game will randomly pick 6 of these per playthrough.
const DEFAULT_QUESTION_POOL = [
    { q: "I ... zebras in the zoo yesterday", options: ["said", "saw", "left"], a: "saw" },
    { q: "They ... to the shop yesterday", options: ["said", "went", "lost"], a: "went" },
    { q: "My brother ... the keys yesterday", options: ["went", "lost", "came"], a: "lost" },
    { q: "We ... home late yesterday", options: ["came", "had", "saw"], a: "came" },
    { q: "I ... my notebook under the bed", options: ["went", "found", "lost"], a: "found" },
    { q: "My friend ... his jacket at school", options: ["said", "left", "came"], a: "left" },
    { q: "I ... six classes today", options: ["found", "had", "saw"], a: "had" },
    { q: "Our teacher ... hello ", options: ["said", "saw", "came"], a: "said" },
    { q: "My mun ... I love you", options: ["left", "said", "found"], a: "said" },
    { q: "They ... to school yesterday", options: ["found", "said", "went"], a: "went" }
];

/* --- GEMINI API CONFIGURATION --- */
const apiKey = ""; // API key provided by the execution environment
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";

/* --- GAME STATE --- */
let activeQuestions = [];
let currentStep = 0; // 0 = Left bank. 1-6 = Rocks.
let score = 0;
let isAnimating = false;
let rocksGrid = []; 
let isCustomLevel = false;

const START_POS = { left: '5%', top: '75%' };
const END_POS = { left: '95%', top: '75%' };
let lastSafePos = { left: START_POS.left, top: START_POS.top };

/* --- DOM ELEMENTS --- */
const characterEl = document.getElementById('character');
const characterBounceEl = document.getElementById('character-bounce');
const characterImgEl = document.getElementById('character-img');
const rocksContainer = document.getElementById('rocks-container');
const questionBox = document.getElementById('question-box');
const scoreDisplay = document.getElementById('score-display');
const fullscreenBtn = document.getElementById('fullscreen-btn');

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn('Fullscreen request failed:', err);
        });
        fullscreenBtn.textContent = '⛶ Exit Fullscreen';
    } else {
        document.exitFullscreen().catch(err => {
            console.warn('Exit fullscreen failed:', err);
        });
        fullscreenBtn.textContent = '⛶ Fullscreen';
    }
}

/* --- CORE LOGIC --- */

function initGame(resetToDefault = true) {
    score = 0;
    currentStep = 0;
    isAnimating = false;
    updateScore();
    hideOverlay();
    
    if (resetToDefault) {
        isCustomLevel = false;
        activeQuestions = [...DEFAULT_QUESTION_POOL].sort(() => Math.random() - 0.5).slice(0, TOTAL_STEPS);
    }

    generateRocks();
    teleportCharacter(START_POS.left, START_POS.top);
    updateBoard();
}

function generateRocks() {
    rocksContainer.innerHTML = '';
    rocksGrid = [];

    const perspectivePath = [
        [ {x: 35, y: 56}, {x: 25, y: 68}, {x: 12, y: 82} ],
        [ {x: 41, y: 56}, {x: 35, y: 68}, {x: 28, y: 82} ],
        [ {x: 47, y: 56}, {x: 45, y: 68}, {x: 44, y: 82} ],
        [ {x: 53, y: 56}, {x: 55, y: 68}, {x: 56, y: 82} ],
        [ {x: 59, y: 56}, {x: 65, y: 68}, {x: 72, y: 82} ],
        [ {x: 65, y: 56}, {x: 75, y: 68}, {x: 88, y: 82} ]
    ];

    perspectivePath.forEach(column => {
        let columnRocks = [];
        column.forEach((pos, index) => {
            const scale = index === 0 ? 0.75 : index === 1 ? 1.0 : 1.25;
            const width = 110 * scale;
            const height = 60 * scale;
            const fontSize = 18 * scale;

            const rock = document.createElement('div');
            rock.className = 'rock';
            rock.style.left = `${pos.x}%`;
            rock.style.top = `${pos.y}%`;
            rock.style.width = `${width}px`;
            rock.style.height = `${height}px`;
            rock.style.fontSize = `${fontSize}px`;
            
            rocksContainer.appendChild(rock);
            columnRocks.push(rock);
        });
        rocksGrid.push(columnRocks);
    });
}

function updateBoard() {
    rocksGrid.forEach(column => {
        column.forEach(rock => {
            rock.classList.remove('active-rock');
            rock.textContent = '';
            rock.onclick = null; 
        });
    });

    if (currentStep >= TOTAL_STEPS) {
        questionBox.textContent = "Great job! Jump to the bank!";
        questionBox.style.transform = "scale(1.1)";
        
        setTimeout(() => {
            isAnimating = true;
            setCharacterState('jump');
            characterEl.style.left = END_POS.left;
            characterEl.style.top = END_POS.top;
            characterBounceEl.classList.add('jump-anim');
            
            setTimeout(() => {
                characterBounceEl.classList.remove('jump-anim');
                setCharacterState('idle');
                showOverlay("🎉 You crossed the river! Score: " + score, "Play Again", () => initGame(true));
            }, 500);
        }, 1000);
        return;
    }

    // Normal turn setup
    questionBox.style.transform = "scale(1)";
    const currentQ = activeQuestions[currentStep];
    questionBox.innerHTML = `${currentQ.q}<br> <span style="font-size: 16px; font-weight: normal; color: #555;">(Click the glowing rock to jump!)</span>`;

    const activeRocks = rocksGrid[currentStep];
    let shuffledOptions = [...currentQ.options].sort(() => Math.random() - 0.5);

    activeRocks.forEach((rock, index) => {
        let answerText = shuffledOptions[index];
        rock.textContent = answerText;
        rock.classList.add('active-rock');
        
        let isCorrect = (answerText === currentQ.a);
        rock.onclick = () => handleRockClick(rock, isCorrect);
    });
}

function handleRockClick(rockElement, isCorrect) {
    if (isAnimating) return;
    isAnimating = true;

    setCharacterState('jump');
    characterEl.style.left = rockElement.style.left;
    characterEl.style.top = rockElement.style.top;
    characterBounceEl.classList.add('jump-anim');

    setTimeout(() => {
        characterBounceEl.classList.remove('jump-anim');

        if (isCorrect) {
            setCharacterState('idle');
            lastSafePos = { left: rockElement.style.left, top: rockElement.style.top };
            score += 10;
            updateScore();
            
            currentStep++;
            updateBoard();
            isAnimating = false;

        } else {
            // wrong
	    setCharacterState('fall');
            rockElement.classList.add('sinking');
            characterEl.classList.add('sinking');
            
            setTimeout(() => {
                showOverlay("Oops! You drowned. 💦", "Try Again", recoverFromFall);
            }, 2000);
        }
    }, 500); 
}

function recoverFromFall() {
    hideOverlay();
    characterEl.classList.remove('sinking');
    rocksContainer.querySelectorAll('.rock').forEach(r => r.classList.remove('sinking'));
    setCharacterState('idle');
    teleportCharacter(lastSafePos.left, lastSafePos.top);
    isAnimating = false;
}

function teleportCharacter(left, top) {
    characterEl.style.transition = 'none';
    characterEl.style.left = left;
    characterEl.style.top = top;
    void characterEl.offsetWidth; 
    characterEl.style.transition = 'left 0.5s linear, top 0.5s linear';
    lastSafePos = { left: left, top: top };
}

function setCharacterState(state) {
    characterImgEl.src = IMAGES[state];
}

function updateScore() {
    scoreDisplay.textContent = `Score: ${score}`;
}

/* --- MODAL UI HELPERS --- */

function showOverlay(message, buttonText, callback) {
    const msgEl = document.getElementById('overlay-msg');
    const btnEl = document.getElementById('overlay-btn');
    // Allow newlines in message
    msgEl.innerHTML = message.replace(/\n/g, '<br>');
    btnEl.textContent = buttonText;
    btnEl.onclick = callback;
    document.getElementById('overlay').classList.add('active');
}

function hideOverlay() {
    document.getElementById('overlay').classList.remove('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Start game on load
window.onload = () => initGame(true);
