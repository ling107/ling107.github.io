// 全局变量
let gameState = {
    words: [], // 单词数组 [[word, answer], ...] 
    currentWords: [], // 当前游戏单词
    currentIndex: 0, // 当前使用的单词索引
    selectedCards: [], // 已选择的卡片
    matchedPairs: 0, // 已匹配的对数
    gameStartTime: null,
    gameTimer: null,
    isGameActive: false,
    usedIndices: [], // 记录已使用的随机单词索引
    pairColors: [], // 存储每对单词的颜色
    settings: {
        enableSound: true, // 是否启用发音
        autoPlaySound: true, // 是否自动播放发音
        preferredVoice: null, // 首选语音
        darkMode: false, // 暗色模式
        animationSpeed: 1, // 动画速度
        favoriteWords: [], // 收藏的单词
        wordColumn: 0, // 单词所在列
        meaningColumn: 1, // 释义所在列
        startRow: 0, // 起始行（从第几行开始导入）
        voiceType: 'en-US', // 发音类型：en-US或en-GB
        randomWordMode: false, // 随机单词模式
        columnVisibility: { // 列可见性设置
            word: true,
            meaning: true
        }
    },
    wordStatus: {
        familiar: [], // 熟悉的单词
        vague: [],    // 模糊的单词
        unfamiliar: [] // 陌生的单词
    },
    wordVisibility: {}, // 存储单词/释义显示状态
    memoryState: {
        currentWordIndex: 0, // 当前记忆的单词索引
        learnedWords: [], // 已学会的单词
        difficultWords: [], // 困难单词
        filterType: 'all' // 记忆筛选类型：all, familiar, vague, unfamiliar
    },
    gameProgress: {
        currentIndex: 0, // 当前游戏进度索引
        matchedPairs: 0, // 已匹配的对数
        usedWords: [] // 已使用的单词索引
    },
    wordStats: {
        playedCount: {}, // {单词: 游戏次数}
        matchedCount: {}, // {单词: 匹配成功次数}
        lastPlayed: {} // {单词: 最后游玩时间戳}
    },
    // 新增：单词表筛选状态
    wordListFilter: {
        currentFilter: 'all', // 当前筛选类型
        searchKeyword: '' // 搜索关键词
    }
};

// 语音合成相关变量
let speechSynthesis = window.speechSynthesis;
let availableVoices = [];

// 初始化语音合成
function initSpeechSynthesis() {
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = function() {
            availableVoices = speechSynthesis.getVoices();
            updateVoiceOptions();
        };
        
        // 立即获取语音列表
        availableVoices = speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
            updateVoiceOptions();
        }
    }
}

// 单词发音功能 - 增强跨平台兼容性
function speakWord(text) {
    if (!gameState.settings.enableSound) return;
    
    try {
        // 检测特殊浏览器并使用备用方案
        const userAgent = navigator.userAgent;
        const isMiuiBrowser = /MiuiBrowser/.test(userAgent);
        const isHuaweiBrowser = /HuaweiBrowser/.test(userAgent);
        const isQQBrowser = /QQBrowser/.test(userAgent);
        const isUCBrowser = /UCBrowser/.test(userAgent);
        
        // 对于特殊浏览器，优先使用在线TTS服务
        if (isMiuiBrowser || isHuaweiBrowser || isQQBrowser || isUCBrowser) {
            // 尝试使用有道词典API
            const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`);
            audio.play().catch(e => {
                console.log("有道发音失败，尝试本地TTS:", e);
                fallbackToLocalTTS(text);
            });
            return;
        }
        
        // 优先使用Web Speech API
        if ('speechSynthesis' in window) {
            // 停止当前播放的语音
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 1;
            
            // 设置语音类型
            utterance.lang = gameState.settings.voiceType || 'en-US';
            
            // 选择语音
            if (gameState.settings.preferredVoice) {
                const selectedVoice = availableVoices.find(voice => 
                    voice.name === gameState.settings.preferredVoice
                );
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }
            
            // 错误处理
            utterance.onerror = function(event) {
                console.error('语音合成错误:', event.error);
                fallbackToLocalTTS(text);
            };
            
            speechSynthesis.speak(utterance);
        } else {
            fallbackToLocalTTS(text);
        }
    } catch (e) {
        console.error("发音异常:", e);
        showToast("发音失败", "error");
    }
}

// 备用TTS方案
function fallbackToLocalTTS(text) {
    try {
        // 尝试使用预录音频
        const audio = new Audio(`/audio/${encodeURIComponent(text)}.mp3`);
        audio.play().catch(e => {
            console.error("本地音频播放失败:", e);
            showToast("发音功能不可用", "error");
        });
    } catch (e) {
        console.error("备用发音方案失败:", e);
    }
}

// 更新语音选项
function updateVoiceOptions() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;
    
    // 清空现有选项
    voiceSelect.innerHTML = '<option value="">默认语音</option>';
    
    // 根据设置的语音类型筛选语音
    const filteredVoices = availableVoices.filter(voice => {
        return voice.lang.startsWith(gameState.settings.voiceType);
    });
    
    filteredVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
    });
    
    // 设置当前选中的语音
    if (gameState.settings.preferredVoice) {
        voiceSelect.value = gameState.settings.preferredVoice;
    }
}

// 初始化卡片事件 - 增强触控支持
function initCardEvents() {
    const cards = document.querySelectorAll('.word-card');
    cards.forEach(card => {
        // 移除旧的事件监听器
        card.removeEventListener('click', handleCardClick);
        card.removeEventListener('touchend', handleCardClick);
        
        // 添加新的事件监听器
        card.addEventListener('click', handleCardClick);
        card.addEventListener('touchend', function(e) {
            e.preventDefault();
            handleCardClick(e);
        }, { passive: false });
    });
}

// 处理卡片点击 - 增强触控支持和自动发音
function handleCardClick(event) {
    if (!gameState.isGameActive) {
        // 如果游戏未开始，先开始游戏
        startGame();
    }
    
    const card = event.currentTarget;
    const cardText = card.dataset.text;
    
    // 自动发音功能 - 修复发音逻辑
    if (gameState.settings.enableSound && gameState.settings.autoPlaySound) {
        // 只对英文单词发音，不对中文释义发音
        if (card.dataset.type === 'word' && !/[\u4e00-\u9fa5]/.test(cardText)) {
            speakWord(cardText);
        }
    }
    
    // 如果卡片已经匹配或已选择，则忽略
    if (card.classList.contains('matched') || card.classList.contains('selected')) {
        return;
    }
    
    // 选择卡片
    card.classList.add('selected');
    gameState.selectedCards.push(card);
    
    // 如果选择了两张卡片，检查匹配
    if (gameState.selectedCards.length === 2) {
        const [card1, card2] = gameState.selectedCards;
        const pair1 = parseInt(card1.dataset.pair);
        const pair2 = parseInt(card2.dataset.pair);
        
        if (pair1 === pair2) {
            // 匹配成功
            card1.classList.remove('selected');
            card2.classList.remove('selected');
            card1.classList.add('matched');
            card2.classList.add('matched');
            
            // 应用配对颜色
            const pairColor = gameState.pairColors[pair1];
            card1.style.background = pairColor;
            card2.style.background = pairColor;
            card1.style.color = '#fff';
            card2.style.color = '#fff';
            
            gameState.matchedPairs++;
            
            // 更新单词统计
            const word = card1.dataset.type === 'word' ? card1.dataset.text : card2.dataset.text;
            updateWordPlayStats(word, true);
            
            // 检查游戏是否完成
            if (gameState.matchedPairs === gameState.currentWords.length) {
                setTimeout(() => {
                    endGame();
                }, 1000);
            }
            
            showToast('匹配成功！', 'success');
        } else {
            // 匹配失败
            card1.classList.add('mismatch', 'animate__animated', 'animate__shakeX');
            card2.classList.add('mismatch', 'animate__animated', 'animate__shakeX');
            
            setTimeout(() => {
                card1.classList.remove('selected', 'mismatch', 'animate__animated', 'animate__shakeX');
                card2.classList.remove('selected', 'mismatch', 'animate__animated', 'animate__shakeX');
            }, 1000);
            
            // 更新单词统计
            const word = card1.dataset.type === 'word' ? card1.dataset.text : card2.dataset.text;
            updateWordPlayStats(word, false);
            
            showToast('匹配失败，请重试', 'error');
        }
        
        gameState.selectedCards = [];
    }
}

// 更新游戏面板 - 初始化卡片事件
function updateGameBoard() {
    const gameBoard = document.getElementById('gameBoard');
    if (!gameBoard) return;
    
    // 清空游戏面板
    gameBoard.innerHTML = '';
    
    if (gameState.words.length === 0) {
        gameBoard.innerHTML = '<div class="col-span-full text-center text-gray-500 text-lg">请先导入单词表</div>';
        return;
    }
    
    // 获取当前游戏单词
    gameState.currentWords = getCurrentWords();
    
    if (gameState.currentWords.length === 0) {
        gameBoard.innerHTML = '<div class="col-span-full text-center text-gray-500 text-lg">没有更多单词了，请重新开始</div>';
        return;
    }
    
    // 生成配对颜色
    gameState.pairColors = generatePairColors(gameState.currentWords.length);
    
    // 创建单词卡片数组（每个单词对创建两张卡片）
    const cards = [];
    gameState.currentWords.forEach((wordPair, index) => {
        // 单词卡片
        cards.push({
            text: wordPair[0],
            pair: index,
            type: 'word',
            color: gameState.pairColors[index]
        });
        // 释义卡片
        cards.push({
            text: wordPair[1],
            pair: index,
            type: 'meaning',
            color: gameState.pairColors[index]
        });
    });
    
    // 打乱卡片顺序
    const shuffledCards = shuffleArray(cards);
    
    // 创建卡片元素
    shuffledCards.forEach((card, index) => {
        const cardElement = createWordCard(card, index);
        gameBoard.appendChild(cardElement);
    });
    
    // 初始化卡片事件
    initCardEvents();
}

// 创建单词卡片
function createWordCard(card, index) {
    const cardElement = document.createElement('div');
    cardElement.className = 'word-card animate__animated animate__fadeIn';
    cardElement.dataset.text = card.text;
    cardElement.dataset.pair = card.pair;
    cardElement.dataset.type = card.type;
    cardElement.style.animationDelay = `${index * 0.1}s`;
    
    cardElement.innerHTML = `
        <div class="word-text">${card.text}</div>
        ${card.type === 'word' ? '<div class="sound-icon">🔊</div>' : ''}
    `;
    
    return cardElement;
}

// 获取当前游戏单词 - 修复随机单词选择问题
function getCurrentWords() {
    const wordCount = parseInt(document.getElementById('wordCountSlider').value);
    
    if (gameState.settings.randomWordMode) {
        // 随机模式：从所有单词中随机选择
        const shuffled = shuffleArray([...gameState.words]);
        return shuffled.slice(0, wordCount);
    } else {
        // 顺序模式：按顺序选择单词
        const startIndex = gameState.currentIndex;
        const endIndex = Math.min(startIndex + wordCount, gameState.words.length);
        
        if (startIndex >= gameState.words.length) {
            return [];
        }
        
        return gameState.words.slice(startIndex, endIndex);
    }
}

// 生成配对颜色
function generatePairColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 360 / count) % 360;
        colors.push(`linear-gradient(135deg, hsl(${hue}, 70%, 60%) 0%, hsl(${hue}, 70%, 80%) 100%)`);
    }
    return colors;
}

// 打乱数组
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 开始游戏
function startGame() {
    if (gameState.words.length === 0) {
        showToast('请先导入单词表！', 'warning');
        return;
    }
    
    gameState.isGameActive = true;
    gameState.gameStartTime = Date.now();
    gameState.selectedCards = [];
    gameState.matchedPairs = 0;
    
    // 开始计时
    startTimer();
    
    // 更新游戏面板
    updateGameBoard();
    
    showToast('游戏开始！', 'success');
}

// 开始新游戏
function startNewGame(resetAll = false) {
    if (resetAll) {
        // 仅重置游戏进度，保留单词表数据
        gameState.currentIndex = 0;
    }
    
    // 重置游戏状态
    gameState.selectedCards = [];
    gameState.matchedPairs = 0;
    gameState.isGameActive = true;
    gameState.gameStartTime = Date.now();
    
    // 停止旧计时器
    if (gameState.gameTimer) {
        clearInterval(gameState.gameTimer);
    }
    
    // 开始新计时器
    startTimer();
    
    // 更新游戏面板
    updateGameBoard();
    
    showToast(resetAll ? '全部重新开始！' : '继续游戏！', 'success');
}

// 开始计时
function startTimer() {
    if (gameState.gameTimer) {
        clearInterval(gameState.gameTimer);
    }
    
    gameState.gameTimer = setInterval(updateTimer, 100);
}

// 更新计时器
function updateTimer() {
    if (!gameState.isGameActive || !gameState.gameStartTime) return;
    
    const elapsed = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
    const timerElement = document.getElementById('gameTime');
    if (timerElement) {
        timerElement.textContent = `${elapsed}秒`;
    }
}

// 结束游戏
function endGame() {
    gameState.isGameActive = false;
    
    if (gameState.gameTimer) {
        clearInterval(gameState.gameTimer);
        gameState.gameTimer = null;
    }
    
    const elapsed = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
    
    // 显示完成模态框
    const modal = document.getElementById('gameModal');
    const finalTime = document.getElementById('finalTime');
    
    if (modal && finalTime) {
        finalTime.textContent = `${elapsed}秒`;
        modal.classList.remove('hidden');
        modal.querySelector('.modal-content').classList.add('animate__bounceIn');
    }
    
    // 更新进度
    gameState.currentIndex += gameState.currentWords.length;
    
    showToast('恭喜完成！', 'success');
}

// 继续挑战
function continueChallenge() {
    const modal = document.getElementById('gameModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // 检查是否还有更多单词
    if (gameState.currentIndex >= gameState.words.length) {
        showToast('所有单词已完成！', 'info');
        return;
    }
    
    startNewGame(false);
}

// 关闭游戏模态框
function closeGameModal() {
    const modal = document.getElementById('gameModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 更新单词数量显示
function updateWordCountDisplay() {
    const slider = document.getElementById('wordCountSlider');
    const display = document.getElementById('wordCountDisplay');
    
    if (slider && display) {
        display.textContent = `${slider.value}对`;
    }
}

// 处理滑块变化
function handleSliderChange(event) {
    updateWordCountDisplay();
    
    // 如果游戏未进行，更新游戏面板
    if (!gameState.isGameActive) {
        updateGameBoard();
    }
}

// 处理文件导入
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            // 预览数据
            showExcelPreview(jsonData);
        } catch (error) {
            console.error('文件解析错误:', error);
            showToast('文件格式不正确，请选择Excel文件', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// 显示Excel预览
function showExcelPreview(data) {
    const modal = document.getElementById('excelPreviewModal');
    const tbody = document.getElementById('excelPreviewBody');
    
    if (!modal || !tbody) return;
    
    // 清空表格
    tbody.innerHTML = '';
    
    // 填充预览数据（最多显示10行）
    const startRow = gameState.settings.startRow || 0;
    const previewData = data.slice(startRow, startRow + 10);
    previewData.forEach(row => {
        const tr = document.createElement('tr');
        const wordColumn = gameState.settings.wordColumn || 0;
        const meaningColumn = gameState.settings.meaningColumn || 1;
        
        tr.innerHTML = `
            <td>${row[wordColumn] || ''}</td>
            <td>${row[meaningColumn] || ''}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // 存储完整数据以供确认导入时使用
    modal.dataset.importData = JSON.stringify(data);
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 确认导入
function confirmImport() {
    const modal = document.getElementById('excelPreviewModal');
    const data = JSON.parse(modal.dataset.importData || '[]');
    
    const overwrite = document.getElementById('overwriteCheckbox').checked;
    const shuffle = document.getElementById('shuffleCheckbox').checked;
    const skipDuplicates = document.getElementById('skipDuplicatesCheckbox').checked;
    
    // 解析单词数据
    const startRow = gameState.settings.startRow || 0;
    const wordColumn = gameState.settings.wordColumn || 0;
    const meaningColumn = gameState.settings.meaningColumn || 1;
    
    const newWords = data
        .slice(startRow) // 从设置的起始行开始
        .filter(row => row && row[wordColumn] && row[meaningColumn])
        .map(row => [row[wordColumn].toString().trim(), row[meaningColumn].toString().trim()]);
    
    if (newWords.length === 0) {
        showToast('没有找到有效的单词数据', 'error');
        return;
    }
    
    // 处理重复单词
    let finalWords = newWords;
    if (skipDuplicates && !overwrite) {
        const existingWords = new Set(gameState.words.map(w => w[0]));
        finalWords = newWords.filter(w => !existingWords.has(w[0]));
    }
    
    // 更新单词列表
    if (overwrite) {
        gameState.words = finalWords;
        gameState.currentIndex = 0;
    } else {
        gameState.words = [...gameState.words, ...finalWords];
    }
    
    // 打乱顺序
    if (shuffle) {
        shuffleArray(gameState.words);
    }
    
    // 保存到本地存储
    saveToLocalStorage();
    
    // 更新游戏面板
    updateGameBoard();
    
    // 关闭模态框
    modal.classList.add('hidden');
    
    showToast(`成功导入${finalWords.length}个单词`, 'success');
}

// 取消导入
function cancelImport() {
    const modal = document.getElementById('excelPreviewModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 保存到本地存储
function saveToLocalStorage() {
    try {
        localStorage.setItem('wordGameWords', JSON.stringify(gameState.words));
        localStorage.setItem('wordGameCurrentIndex', gameState.currentIndex.toString());
        localStorage.setItem('wordGameSettings', JSON.stringify(gameState.settings));
        localStorage.setItem('wordGameWordStatus', JSON.stringify(gameState.wordStatus));
        localStorage.setItem('wordGameWordStats', JSON.stringify(gameState.wordStats));
        localStorage.setItem('wordGameWordVisibility', JSON.stringify(gameState.wordVisibility));
        localStorage.setItem('wordGameTitle', document.getElementById('gameTitle').textContent);
    } catch (error) {
        console.error('保存失败:', error);
        showToast('保存失败', 'error');
    }
}

// 从本地存储加载数据
function loadStoredData() {
    try {
        const storedWords = localStorage.getItem('wordGameWords');
        const storedIndex = localStorage.getItem('wordGameCurrentIndex');
        const storedSettings = localStorage.getItem('wordGameSettings');
        const storedWordStatus = localStorage.getItem('wordGameWordStatus');
        const storedWordStats = localStorage.getItem('wordGameWordStats');
        const storedWordVisibility = localStorage.getItem('wordGameWordVisibility');
        const storedTitle = localStorage.getItem('wordGameTitle');
        
        if (storedWords) {
            gameState.words = JSON.parse(storedWords);
        }
        
        if (storedIndex) {
            gameState.currentIndex = parseInt(storedIndex);
        }
        
        if (storedSettings) {
            gameState.settings = { ...gameState.settings, ...JSON.parse(storedSettings) };
        }
        
        if (storedWordStatus) {
            gameState.wordStatus = JSON.parse(storedWordStatus);
        }
        
        if (storedWordStats) {
            gameState.wordStats = JSON.parse(storedWordStats);
        }
        
        if (storedWordVisibility) {
            gameState.wordVisibility = JSON.parse(storedWordVisibility);
        }
        
        if (storedTitle) {
            document.getElementById('gameTitle').textContent = storedTitle;
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 显示Toast通知
function showToast(message, type = 'info') {
    // 移除现有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} animate__animated animate__fadeInRight`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
        toast.classList.remove('animate__fadeInRight');
        toast.classList.add('animate__fadeOutRight');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 更新单词游戏统计
function updateWordPlayStats(word, matched) {
    if (!gameState.wordStats.playedCount[word]) {
        gameState.wordStats.playedCount[word] = 0;
    }
    if (!gameState.wordStats.matchedCount[word]) {
        gameState.wordStats.matchedCount[word] = 0;
    }
    
    gameState.wordStats.playedCount[word]++;
    if (matched) {
        gameState.wordStats.matchedCount[word]++;
    }
    gameState.wordStats.lastPlayed[word] = Date.now();
    
    saveToLocalStorage();
}

// 设置面板相关函数
function toggleSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            initSettings();
        }
    }
}

function initSettings() {
    // 初始化设置面板的值
    const soundToggle = document.getElementById('soundToggle');
    const autoPlayToggle = document.getElementById('autoPlayToggle');
    const voiceTypeSelect = document.getElementById('voiceTypeSelect');
    const wordColumnInput = document.getElementById('wordColumnInput');
    const meaningColumnInput = document.getElementById('meaningColumnInput');
    const startRowInput = document.getElementById('startRowInput');
    const randomWordToggle = document.getElementById('randomWordToggle');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const animationSpeedSlider = document.getElementById('animationSpeedSlider');
    
    if (soundToggle) soundToggle.checked = gameState.settings.enableSound;
    if (autoPlayToggle) autoPlayToggle.checked = gameState.settings.autoPlaySound;
    if (voiceTypeSelect) voiceTypeSelect.value = gameState.settings.voiceType;
    if (wordColumnInput) wordColumnInput.value = gameState.settings.wordColumn;
    if (meaningColumnInput) meaningColumnInput.value = gameState.settings.meaningColumn;
    if (startRowInput) startRowInput.value = gameState.settings.startRow || 0;
    if (randomWordToggle) randomWordToggle.checked = gameState.settings.randomWordMode;
    if (darkModeToggle) darkModeToggle.checked = gameState.settings.darkMode;
    if (animationSpeedSlider) animationSpeedSlider.value = gameState.settings.animationSpeed;
    
    updateVoiceOptions();
}

function saveSettings() {
    const soundToggle = document.getElementById('soundToggle');
    const autoPlayToggle = document.getElementById('autoPlayToggle');
    const voiceTypeSelect = document.getElementById('voiceTypeSelect');
    const voiceSelect = document.getElementById('voiceSelect');
    const wordColumnInput = document.getElementById('wordColumnInput');
    const meaningColumnInput = document.getElementById('meaningColumnInput');
    const startRowInput = document.getElementById('startRowInput');
    const randomWordToggle = document.getElementById('randomWordToggle');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const animationSpeedSlider = document.getElementById('animationSpeedSlider');
    
    if (soundToggle) gameState.settings.enableSound = soundToggle.checked;
    if (autoPlayToggle) gameState.settings.autoPlaySound = autoPlayToggle.checked;
    if (voiceTypeSelect) gameState.settings.voiceType = voiceTypeSelect.value;
    if (voiceSelect) gameState.settings.preferredVoice = voiceSelect.value;
    if (wordColumnInput) gameState.settings.wordColumn = parseInt(wordColumnInput.value) || 0;
    if (meaningColumnInput) gameState.settings.meaningColumn = parseInt(meaningColumnInput.value) || 1;
    if (startRowInput) gameState.settings.startRow = parseInt(startRowInput.value) || 0;
    if (randomWordToggle) gameState.settings.randomWordMode = randomWordToggle.checked;
    if (darkModeToggle) gameState.settings.darkMode = darkModeToggle.checked;
    if (animationSpeedSlider) gameState.settings.animationSpeed = parseFloat(animationSpeedSlider.value) || 1;
    
    // 应用暗色模式
    if (gameState.settings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // 应用动画速度
    document.documentElement.style.setProperty('--animation-speed', gameState.settings.animationSpeed);
    
    saveToLocalStorage();
    showToast('设置已保存', 'success');
}

// 单词表管理相关函数
function openWordListModal() {
    const modal = document.getElementById('wordListModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateWordListContent();
    }
}

function closeWordListModal() {
    const modal = document.getElementById('wordListModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 新增：单词表筛选功能
function filterWordList(filterType) {
    gameState.wordListFilter.currentFilter = filterType;
    updateWordListContent();
    
    // 更新筛选按钮状态
    const filterButtons = document.querySelectorAll('.stats-filter-btn');
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filterType) {
            btn.classList.add('active');
        }
    });
}

// 新增：获取筛选后的单词列表
function getFilteredWords() {
    const filter = gameState.wordListFilter.currentFilter;
    const searchKeyword = gameState.wordListFilter.searchKeyword.toLowerCase();
    
    let filteredWords = [...gameState.words];
    
    // 根据筛选类型过滤
    switch (filter) {
        case 'matched':
            filteredWords = filteredWords.filter(([word]) => 
                gameState.wordStats.matchedCount[word] > 0
            );
            break;
        case 'unmatched':
            filteredWords = filteredWords.filter(([word]) => 
                !gameState.wordStats.matchedCount[word] || gameState.wordStats.matchedCount[word] === 0
            );
            break;
        case 'favorite':
            filteredWords = filteredWords.filter(([word]) => 
                gameState.settings.favoriteWords.includes(word)
            );
            break;
        case 'familiar':
            filteredWords = filteredWords.filter(([word]) => 
                gameState.wordStatus.familiar.includes(word)
            );
            break;
        case 'vague':
            filteredWords = filteredWords.filter(([word]) => 
                gameState.wordStatus.vague.includes(word)
            );
            break;
        case 'unfamiliar':
            filteredWords = filteredWords.filter(([word]) => 
                gameState.wordStatus.unfamiliar.includes(word)
            );
            break;
        default:
            // 'all' - 不过滤
            break;
    }
    
    // 根据搜索关键词过滤
    if (searchKeyword) {
        filteredWords = filteredWords.filter(([word, meaning]) => 
            word.toLowerCase().includes(searchKeyword) || 
            meaning.toLowerCase().includes(searchKeyword)
        );
    }
    
    return filteredWords;
}

// 更新单词表内容 - 优化界面，新增统计信息和筛选功能
function updateWordListContent() {
    const content = document.getElementById('wordListContent');
    if (!content) return;
    
    if (gameState.words.length === 0) {
        content.innerHTML = '<div class="word-list-empty">暂无单词数据</div>';
        return;
    }
    
    // 计算统计信息
    const stats = {
        total: gameState.words.length,
        matched: 0,
        unmatched: 0,
        favorite: gameState.settings.favoriteWords.length,
        familiar: gameState.wordStatus.familiar.length,
        vague: gameState.wordStatus.vague.length,
        unfamiliar: gameState.wordStatus.unfamiliar.length
    };
    
    // 计算已配对和未配对的单词数
    gameState.words.forEach(([word]) => {
        if (gameState.wordStats.matchedCount[word] > 0) {
            stats.matched++;
        } else {
            stats.unmatched++;
        }
    });
    
    // 获取筛选后的单词
    const filteredWords = getFilteredWords();
    
    // 创建表格
    const table = document.createElement('table');
    table.className = 'word-list-table';
    
    // 表头行
    table.innerHTML = `
        <thead>
            <tr>
                <th>序号</th>
                <th>单词 <button onclick="toggleColumnVisibility('word')">👁️</button></th>
                <th>释义 <button onclick="toggleColumnVisibility('meaning')">👁️</button></th>
                <th>状态</th>
                <th>操作</th>
                <th>游戏统计</th>
            </tr>
        </thead>
        <tbody id="wordTableBody">
            ${filteredWords.map((word, index) => {
                const originalIndex = gameState.words.findIndex(w => w[0] === word[0] && w[1] === word[1]);
                const playedCount = gameState.wordStats.playedCount[word[0]] || 0;
                const matchedCount = gameState.wordStats.matchedCount[word[0]] || 0;
                const lastPlayed = gameState.wordStats.lastPlayed[word[0]];
                
                // 获取单词状态
                let wordStatus = '';
                if (gameState.wordStatus.familiar.includes(word[0])) {
                    wordStatus = 'familiar';
                } else if (gameState.wordStatus.vague.includes(word[0])) {
                    wordStatus = 'vague';
                } else if (gameState.wordStatus.unfamiliar.includes(word[0])) {
                    wordStatus = 'unfamiliar';
                }
                
                // 获取单词和释义的显示状态
                const wordVisible = gameState.wordVisibility[word[0]]?.word !== false;
                const meaningVisible = gameState.wordVisibility[word[0]]?.meaning !== false;
                
                return `
                    <tr>
                        <td>${originalIndex + 1}</td>
                        <td class="word-col ${wordVisible ? '' : 'covered'}">${word[0]}</td>
                        <td class="meaning-col ${meaningVisible ? '' : 'covered'}">${word[1]}</td>
                        <td>
                            <select class="word-status-select" onchange="updateWordStatus('${word[0]}', this.value)">
                                <option value="" ${wordStatus === '' ? 'selected' : ''}>未标记</option>
                                <option value="familiar" ${wordStatus === 'familiar' ? 'selected' : ''}>熟悉</option>
                                <option value="vague" ${wordStatus === 'vague' ? 'selected' : ''}>模糊</option>
                                <option value="unfamiliar" ${wordStatus === 'unfamiliar' ? 'selected' : ''}>陌生</option>
                            </select>
                        </td>
                        <td class="word-actions">
                            <button class="word-action-btn" onclick="speakWord('${word[0]}')" title="发音">🔊</button>
                            <button class="word-action-btn" onclick="toggleFavorite('${word[0]}')" title="收藏">
                                ${gameState.settings.favoriteWords.includes(word[0]) ? '❤️' : '🤍'}
                            </button>
                            <button class="word-action-btn" onclick="toggleWordCover('${word[0]}', 'word')" title="遮挡/显示单词">
                                ${wordVisible ? '👁️' : '👁️‍🗨️'}
                            </button>
                            <button class="word-action-btn" onclick="toggleWordCover('${word[0]}', 'meaning')" title="遮挡/显示释义">
                                ${meaningVisible ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </td>
                        <td>
                            ${playedCount}/${matchedCount}
                            ${lastPlayed ? `<br><small>${new Date(lastPlayed).toLocaleDateString()}</small>` : ''}
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
    
    content.innerHTML = '';
    content.appendChild(table);
    
    // 更新统计数字
    document.getElementById('totalCount').textContent = stats.total;
    document.getElementById('matchedCount').textContent = stats.matched;
    document.getElementById('unmatchedCount').textContent = stats.unmatched;
    document.getElementById('favoriteCount').textContent = stats.favorite;
    document.getElementById('familiarCount').textContent = stats.familiar;
    document.getElementById('vagueCount').textContent = stats.vague;
    document.getElementById('unfamiliarCount').textContent = stats.unfamiliar;
    
    // 绑定导出按钮事件
    const exportBtn = document.getElementById('exportWordsBtn');
    if (exportBtn) {
        exportBtn.onclick = exportWordList;
    }
}

// 切换单词/释义遮挡状态
function toggleWordCover(word, type) {
    if (!gameState.wordVisibility[word]) {
        gameState.wordVisibility[word] = {};
    }
    
    gameState.wordVisibility[word][type] = !gameState.wordVisibility[word][type];
    
    // 保存状态
    saveToLocalStorage();
    
    // 更新单词表显示
    updateWordListContent();
}

// 切换整列单词/释义遮挡状态
function toggleColumnVisibility(type) {
    // 检查当前状态
    let allCovered = true;
    const cells = document.querySelectorAll(`.${type}-col`);
    
    cells.forEach(cell => {
        if (!cell.classList.contains('covered')) {
            allCovered = false;
        }
    });
    
    // 根据当前状态切换所有单词的遮挡状态
    gameState.words.forEach(([word]) => {
        if (!gameState.wordVisibility[word]) {
            gameState.wordVisibility[word] = {};
        }
        gameState.wordVisibility[word][type] = allCovered;
    });
    
    // 保存状态
    saveToLocalStorage();
    
    // 更新单词表显示
    updateWordListContent();
}

// 导出单词表功能
function exportWordList() {
    try {
        // 获取当前筛选后的单词
        const filteredWords = getFilteredWords();
        
        // 准备导出数据，考虑遮挡状态
        const exportData = filteredWords.map(([word, meaning]) => {
            const wordVisible = gameState.wordVisibility[word]?.word !== false;
            const meaningVisible = gameState.wordVisibility[word]?.meaning !== false;
            
            return {
                word: wordVisible ? word : '[已遮挡]',
                meaning: meaningVisible ? meaning : '[已遮挡]'
            };
        });
        
        // 生成CSV内容
        const csvContent = exportData.map(item => `${item.word},${item.meaning}`).join('\n');
        
        // 创建Blob对象
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // 创建下载链接
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = '单词表.csv';
        link.style.display = 'none';
        
        // 添加到文档并触发点击
        document.body.appendChild(link);
        link.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 100);
        
        showToast('单词表导出成功', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败，请重试', 'error');
    }
}

// 更新单词状态
function updateWordStatus(word, status) {
    // 从所有状态中移除该单词
    Object.keys(gameState.wordStatus).forEach(key => {
        const index = gameState.wordStatus[key].indexOf(word);
        if (index > -1) {
            gameState.wordStatus[key].splice(index, 1);
        }
    });
    
    // 如果选择了状态，则添加到对应状态
    if (status) {
        if (!gameState.wordStatus[status]) {
            gameState.wordStatus[status] = [];
        }
        gameState.wordStatus[status].push(word);
    }
    
    // 保存状态
    saveToLocalStorage();
    
    // 更新单词表显示
    updateWordListContent();
    
    // 显示提示
    const statusText = {
        familiar: '熟悉',
        vague: '模糊',
        unfamiliar: '陌生'
    };
    
    showToast(`已将 "${word}" 标记为${status ? statusText[status] : '未标记'}`, 'success');
}

function toggleFavorite(word) {
    const favorites = gameState.settings.favoriteWords;
    const index = favorites.indexOf(word);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('已取消收藏', 'info');
    } else {
        favorites.push(word);
        showToast('已添加到收藏', 'success');
    }
    
    saveToLocalStorage();
    updateWordListContent();
}

// 单词记忆相关函数
function startWordMemory(reset = false, filterType = 'all') {
    if (reset) {
        gameState.memoryState.currentWordIndex = 0;
    }
    
    // 设置记忆筛选类型
    gameState.memoryState.filterType = filterType;
    
    const modal = document.getElementById('wordMemoryModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateMemoryCard();
    }
}

// 修复单词记忆卡片与单词表的链接问题
function updateMemoryCard() {
    const card = document.getElementById('wordMemoryCard');
    const progressCurrent = document.getElementById('progressCurrent');
    const progressTotal = document.getElementById('progressTotal');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const currentWordIndex = document.getElementById('currentWordIndex');
    const totalWords = document.getElementById('totalWords');
    
    if (!card || gameState.words.length === 0) return;
    
    // 根据筛选类型获取要记忆的单词
    let wordsToMemorize = [...gameState.words];
    
    if (gameState.memoryState.filterType !== 'all') {
        const statusType = gameState.memoryState.filterType;
        wordsToMemorize = gameState.words.filter(word => 
            gameState.wordStatus[statusType]?.includes(word[0])
        );
    }
    
    if (wordsToMemorize.length === 0) {
        showToast(`没有${getStatusText(gameState.memoryState.filterType)}的单词`, 'warning');
        closeWordMemoryModal();
        return;
    }
    
    const currentIndex = gameState.memoryState.currentWordIndex;
    
    // 确保索引在有效范围内
    if (currentIndex >= wordsToMemorize.length) {
        gameState.memoryState.currentWordIndex = 0;
    }
    
    const currentWord = wordsToMemorize[gameState.memoryState.currentWordIndex];
    
    if (!currentWord) {
        closeWordMemoryModal();
        showToast('记忆完成！', 'success');
        return;
    }
    
    // 更新进度
    const progressPercent = Math.round((currentIndex + 1) / wordsToMemorize.length * 100);
    
    if (progressCurrent) progressCurrent.textContent = currentIndex + 1;
    if (progressTotal) progressTotal.textContent = wordsToMemorize.length;
    if (progressBarFill) progressBarFill.style.width = `${progressPercent}%`;
    if (progressPercentage) progressPercentage.textContent = `${progressPercent}%`;
    if (currentWordIndex) currentWordIndex.textContent = currentIndex + 1;
    if (totalWords) totalWords.textContent = wordsToMemorize.length;
    
    // 更新卡片内容
    card.innerHTML = `
        <div class="word-memory-card-inner">
            <div class="word-memory-card-front">
                <div class="memory-index">${currentIndex + 1}/${wordsToMemorize.length}</div>
                <button class="memory-sound-btn" onclick="speakWord('${currentWord[0]}')" title="发音">🔊</button>
                <div class="word-memory-word">${currentWord[0]}</div>
                <div class="flip-hint">点击翻转查看释义</div>
            </div>
            <div class="word-memory-card-back">
                <div class="memory-index">${currentIndex + 1}/${wordsToMemorize.length}</div>
                <div class="word-memory-word">${currentWord[0]}</div>
                <div class="word-memory-meaning">${currentWord[1]}</div>
                <div class="flip-hint">点击翻转查看单词</div>
            </div>
        </div>
    `;
    
    // 重置翻转状态
    card.classList.remove('flipped');
    
    // 自动发音
    if (gameState.settings.enableSound && gameState.settings.autoPlaySound) {
        setTimeout(() => {
            speakWord(currentWord[0]);
        }, 300);
    }
    
    // 更新导航按钮状态
    const prevBtn = document.getElementById('prevMemoryBtn');
    const nextBtn = document.getElementById('nextMemoryBtn');
    
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === wordsToMemorize.length - 1;
}

// 获取当前单词
function getCurrentMemoryWord() {
    let wordsToMemorize = [...gameState.words];
    
    if (gameState.memoryState.filterType !== 'all') {
        const statusType = gameState.memoryState.filterType;
        wordsToMemorize = gameState.words.filter(word => 
            gameState.wordStatus[statusType]?.includes(word[0])
        );
    }
    
    const currentIndex = gameState.memoryState.currentWordIndex;
    return wordsToMemorize[currentIndex];
}

// 发音当前单词
function speakCurrentWord() {
    const currentWord = getCurrentMemoryWord();
    if (currentWord) {
        speakWord(currentWord[0]);
    }
}

// 切换当前单词收藏状态
function toggleCurrentFavorite() {
    const currentWord = getCurrentMemoryWord();
    if (currentWord) {
        toggleFavorite(currentWord[0]);
    }
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'familiar': '熟悉',
        'vague': '模糊',
        'unfamiliar': '陌生',
        'all': '全部'
    };
    return statusMap[status] || status;
}

function flipCard() {
    const card = document.getElementById('wordMemoryCard');
    if (card) {
        card.classList.toggle('flipped');
    }
}

function prevMemoryWord() {
    if (gameState.memoryState.currentWordIndex > 0) {
        gameState.memoryState.currentWordIndex--;
        updateMemoryCard();
    }
}

function nextMemoryWord() {
    // 获取当前筛选类型下的单词数量
    let wordsToMemorize = [...gameState.words];
    
    if (gameState.memoryState.filterType !== 'all') {
        const statusType = gameState.memoryState.filterType;
        wordsToMemorize = gameState.words.filter(word => 
            gameState.wordStatus[statusType]?.includes(word[0])
        );
    }
    
    if (gameState.memoryState.currentWordIndex < wordsToMemorize.length - 1) {
        gameState.memoryState.currentWordIndex++;
        updateMemoryCard();
    }
}

function markWordStatus(status) {
    // 获取当前筛选类型下的单词
    let wordsToMemorize = [...gameState.words];
    
    if (gameState.memoryState.filterType !== 'all') {
        const statusType = gameState.memoryState.filterType;
        wordsToMemorize = gameState.words.filter(word => 
            gameState.wordStatus[statusType]?.includes(word[0])
        );
    }
    
    const currentIndex = gameState.memoryState.currentWordIndex;
    const currentWord = wordsToMemorize[currentIndex];
    
    if (!currentWord) return;
    
    const word = currentWord[0];
    
    // 从所有状态中移除该单词
    Object.keys(gameState.wordStatus).forEach(key => {
        const index = gameState.wordStatus[key].indexOf(word);
        if (index > -1) {
            gameState.wordStatus[key].splice(index, 1);
        }
    });
    
    // 添加到新状态
    if (!gameState.wordStatus[status]) {
        gameState.wordStatus[status] = [];
    }
    gameState.wordStatus[status].push(word);
    
    saveToLocalStorage();
    
    const statusText = {
        familiar: '熟悉',
        vague: '模糊',
        unfamiliar: '陌生'
    };
    
    showToast(`已标记为${statusText[status]}`, 'success');
    
    // 自动跳转到下一个单词
    setTimeout(() => {
        nextMemoryWord();
    }, 500);
}

function closeWordMemoryModal() {
    const modal = document.getElementById('wordMemoryModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 统计功能相关函数
function openStatsModal() {
    const modal = document.getElementById('statsModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateStatsDisplay();
    }
}

function closeStatsModal() {
    const modal = document.getElementById('statsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function resetStats() {
    if (confirm('确定要重置所有统计数据吗？此操作不可撤销。')) {
        // 重置统计数据
        gameState.wordStats = {
            playedCount: {},
            matchedCount: {},
            lastPlayed: {}
        };
        
        // 保存到本地存储
        saveToLocalStorage();
        
        // 更新统计显示
        updateStatsDisplay();
        
        showToast('统计数据已重置', 'success');
    }
}

function updateStatsDisplay() {
    // 计算总体统计
    const totalGamesPlayed = calculateTotalGamesPlayed();
    const totalGameTime = calculateTotalGameTime();
    const avgGameTime = calculateAverageGameTime();
    const bestGameTime = calculateBestGameTime();
    
    // 计算单词统计
    const totalWords = gameState.words.length;
    const learnedWords = calculateLearnedWords();
    const familiarWords = gameState.wordStatus.familiar.length;
    const unfamiliarWords = gameState.wordStatus.unfamiliar.length;
    
    // 更新统计显示
    document.getElementById('totalGamesPlayed').textContent = totalGamesPlayed;
    document.getElementById('totalGameTime').textContent = formatTime(totalGameTime);
    document.getElementById('avgGameTime').textContent = formatTime(avgGameTime);
    document.getElementById('bestGameTime').textContent = bestGameTime ? formatTime(bestGameTime) : '-';
    
    document.getElementById('totalWords').textContent = totalWords;
    document.getElementById('learnedWords').textContent = learnedWords;
    document.getElementById('familiarWordsCount').textContent = familiarWords;
    document.getElementById('unfamiliarWordsCount').textContent = unfamiliarWords;
    
    // 更新学习进度
    const learningProgress = totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0;
    document.getElementById('learningProgressBar').style.width = `${learningProgress}%`;
    document.getElementById('learningProgressText').textContent = `${learningProgress}%`;
    
    // 更新最近游戏记录
    updateRecentGames();
}

function calculateTotalGamesPlayed() {
    // 计算总游戏次数（根据匹配成功的单词对数）
    let totalGames = 0;
    Object.values(gameState.wordStats.matchedCount).forEach(count => {
        totalGames += count;
    });
    return totalGames;
}

function calculateTotalGameTime() {
    // 这里假设每次匹配平均需要10秒
    // 实际应用中可以记录真实的游戏时间
    return calculateTotalGamesPlayed() * 10;
}

function calculateAverageGameTime() {
    const totalGames = calculateTotalGamesPlayed();
    return totalGames > 0 ? calculateTotalGameTime() / totalGames : 0;
}

function calculateBestGameTime() {
    // 在实际应用中，应该记录每次游戏的完成时间
    // 这里返回一个模拟的最佳时间
    return calculateTotalGamesPlayed() > 0 ? Math.max(5, calculateAverageGameTime() * 0.7) : null;
}

function calculateLearnedWords() {
    // 计算已学习的单词数量（至少匹配过一次的单词）
    return Object.keys(gameState.wordStats.matchedCount).length;
}

function formatTime(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)}秒`;
    } else if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
    } else {
        return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
    }
}

function updateRecentGames() {
    const recentGamesContainer = document.getElementById('recentGames');
    if (!recentGamesContainer) return;
    
    // 获取最近匹配的单词（按最后游玩时间排序）
    const recentWords = Object.entries(gameState.wordStats.lastPlayed)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (recentWords.length === 0) {
        recentGamesContainer.innerHTML = '<div class="stats-no-data">暂无游戏记录</div>';
        return;
    }
    
    // 生成最近游戏记录HTML
    recentGamesContainer.innerHTML = recentWords.map(([word, timestamp]) => {
        const playedCount = gameState.wordStats.playedCount[word] || 0;
        const matchedCount = gameState.wordStats.matchedCount[word] || 0;
        const date = new Date(timestamp).toLocaleString();
        
        return `
            <div class="stats-game-record">
                <div class="stats-game-word">${word}</div>
                <div class="stats-game-info">
                    <div class="stats-game-date">${date}</div>
                    <div class="stats-game-result">匹配: ${matchedCount}/${playedCount}</div>
                </div>
            </div>
        `;
    }).join('');
}

// 设置事件监听器 - 修复设置按钮无响应问题
function setupEventListeners() {
    // 标题编辑
    const gameTitle = document.getElementById('gameTitle');
    if (gameTitle) {
        gameTitle.addEventListener('click', function() {
            const newTitle = prompt('请输入新标题:', this.textContent);
            if (newTitle && newTitle.trim()) {
                this.textContent = newTitle.trim();
                saveToLocalStorage();
            }
        });
    }
    
    // 滑块事件
    const wordCountSlider = document.getElementById('wordCountSlider');
    if (wordCountSlider) {
        wordCountSlider.addEventListener('input', handleSliderChange);
    }
    
    // 导入按钮
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');
    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileImport);
    }
    
    // 单词表按钮
    const wordListBtn = document.getElementById('wordListBtn');
    if (wordListBtn) {
        wordListBtn.addEventListener('click', openWordListModal);
    }
    
    // 统计按钮
    const statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        statsBtn.addEventListener('click', openStatsModal);
    }
    
    // 设置按钮 - 修复无响应问题
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        // 完全重新绑定事件
        settingsBtn.replaceWith(settingsBtn.cloneNode(true));
        const newSettingsBtn = document.getElementById('settingsBtn');
        
        newSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('设置按钮被点击'); // 调试日志
            toggleSettingsPanel();
        });
    }
    
    // 设置面板关闭按钮
    const closeSettings = document.getElementById('closeSettings');
    if (closeSettings) {
        closeSettings.addEventListener('click', function() {
            const panel = document.getElementById('settingsPanel');
            if (panel) {
                panel.classList.remove('open');
            }
        });
    }
    
    // 保存设置按钮
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // 游戏模态框按钮
    const continueBtn = document.getElementById('continueBtn');
    const closeModal = document.getElementById('closeModal');
    if (continueBtn) continueBtn.addEventListener('click', continueChallenge);
    if (closeModal) closeModal.addEventListener('click', closeGameModal);
    
    // Excel预览模态框按钮
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    if (confirmImportBtn) confirmImportBtn.addEventListener('click', confirmImport);
    if (cancelImportBtn) cancelImportBtn.addEventListener('click', cancelImport);
    
    // 单词表模态框按钮
    const closeWordListBtn = document.getElementById('closeWordListBtn');
    if (closeWordListBtn) closeWordListBtn.addEventListener('click', closeWordListModal);
    
    // 记忆模态框按钮
    const closeMemoryBtn = document.getElementById('closeMemoryBtn');
    if (closeMemoryBtn) {
        closeMemoryBtn.addEventListener('click', closeWordMemoryModal);
    }
    
    // 记忆卡片点击翻转
    const wordMemoryCard = document.getElementById('wordMemoryCard');
    if (wordMemoryCard) {
        wordMemoryCard.addEventListener('click', flipCard);
    }
    
    // 语音类型选择
    const voiceTypeSelect = document.getElementById('voiceTypeSelect');
    if (voiceTypeSelect) {
        voiceTypeSelect.addEventListener('change', function() {
            gameState.settings.voiceType = this.value;
            updateVoiceOptions();
        });
    }
    
    // 新增：单词表搜索功能
    const wordListSearch = document.getElementById('wordListSearch');
    if (wordListSearch) {
        wordListSearch.addEventListener('input', function() {
            gameState.wordListFilter.searchKeyword = this.value;
            updateWordListContent();
        });
    }
    
    // 统计模态框按钮
    const closeStatsBtn = document.getElementById('closeStatsBtn');
    if (closeStatsBtn) {
        closeStatsBtn.addEventListener('click', closeStatsModal);
    }
    
    const resetStatsBtn = document.getElementById('resetStatsBtn');
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', resetStats);
    }
}

// 初始化游戏
function initializeGame() {
    console.log('开始初始化游戏');
    
    loadStoredData();
    setupEventListeners();
    updateWordCountDisplay();
    initSpeechSynthesis();
    initSettings();
    
    // 应用暗色模式设置
    if (gameState.settings.darkMode) {
        document.body.classList.add('dark-mode');
    }
    
    // 应用动画速度设置
    document.documentElement.style.setProperty('--animation-speed', gameState.settings.animationSpeed);
    
    console.log('游戏初始化完成');
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化');
    initializeGame();
});

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('全局错误:', e.error);
    showToast('发生了一个错误，请刷新页面重试', 'error');
});

// 未处理的Promise错误
window.addEventListener('unhandledrejection', function(e) {
    console.error('未处理的Promise错误:', e.reason);
    showToast('发生了一个错误，请刷新页面重试', 'error');
});