let currentImageName = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recordedAudioURL = null;

// 添加画布相关变量
let isDrawing = false;
let drawingContext = null;
let lastX = 0;
let lastY = 0;
let canvasScale = { x: 1, y: 1 };
let imageNaturalSize = { width: 0, height: 0 };

// 添加矩形绘制相关变量
let startX = 0;
let startY = 0;
let rectCoords = null;

// 初始化语音识别
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';

// 加载历史图片
async function loadHistoryImages() {
    try {
        const response = await fetch('/images');
        const data = await response.json();
        
        const gallery = document.getElementById('imageGallery');
        gallery.innerHTML = ''; // 清空现有内容
        
        data.images.forEach(image => {
            const container = document.createElement('div');
            container.className = 'thumbnail-container shrink-0';
            
            const img = document.createElement('img');
            img.src = image.data;
            img.className = 'image-thumbnail';
            img.onclick = () => selectImage(image.name, image.data);
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-button';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation(); // 防止触发图片选择
                await deleteImage(image.name);
            };
            
            container.appendChild(img);
            container.appendChild(deleteBtn);
            gallery.appendChild(container);
        });
        
        // 更新空状态显示
        updateEmptyState(data.images.length === 0);
        
    } catch (error) {
        console.error('Failed to load images:', error);
    }
}

// 修改删除图片函数
async function deleteImage(imageName) {
    try {
        const response = await fetch(`/images/${imageName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // 如果删除的是当前选中的图片，清除选中状态
            if (imageName === currentImageName) {
                clearCurrentImage();
            }
            // 重新加载图片列表
            await loadHistoryImages();
        } else {
            const errorData = await response.json();
            console.error('Failed to delete image:', errorData.detail);
            alert('Failed to delete image: ' + (errorData.detail || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        alert('Error deleting image: ' + error.message);
    }
}

// 添加清除当前图片函数
function clearCurrentImage() {
    currentImageName = null;
    const currentImage = document.getElementById('currentImage');
    const drawingCanvas = document.getElementById('drawingCanvas');
    
    currentImage.src = '';
    currentImage.classList.remove('visible');
    drawingCanvas.classList.remove('visible');
    
    // 清除画布内容
    if (drawingContext) {
        drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
    
    // 显示空状态
    updateEmptyState(true);
}

// 添加更新空状态显示函数
function updateEmptyState(isEmpty) {
    const emptyState = document.getElementById('emptyState');
    const currentImage = document.getElementById('currentImage');
    const drawingCanvas = document.getElementById('drawingCanvas');
    
    if (isEmpty) {
        emptyState.classList.add('visible');
        currentImage.classList.remove('visible');
        drawingCanvas.classList.remove('visible');
    } else {
        emptyState.classList.remove('visible');
    }
}

// 修改选择图片函数
function selectImage(imageName, imageData) {
    currentImageName = imageName;
    const currentImage = document.getElementById('currentImage');
    const drawingCanvas = document.getElementById('drawingCanvas');
    
    // 更新图片
    currentImage.src = imageData;
    currentImage.classList.add('visible');
    drawingCanvas.classList.add('visible');
    
    // 隐藏空状态
    updateEmptyState(false);
    
    // 初始化画布
    initializeCanvas();
    
    // 添加画布事件监听
    addCanvasEventListeners();
    
    // 更新缩略图选中状态
    const thumbnails = document.querySelectorAll('.image-thumbnail');
    thumbnails.forEach(thumbnail => {
        if (thumbnail.src === imageData) {
            thumbnail.classList.add('active');
        } else {
            thumbnail.classList.remove('active');
        }
    });
}

// 初始化画布
function initializeCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    const container = document.getElementById('imageContainer');
    const currentImage = document.getElementById('currentImage');
    
    // 等待图片完全加载
    if (!currentImage.complete) {
        currentImage.onload = () => initializeCanvas();
        return;
    }
    
    // 获取图片实际显示尺寸
    const rect = currentImage.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    
    // 设置画布尺寸与图片显示尺寸完全相同
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    // 设置画布样式尺寸
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    // 设置画布位置，与图片完全重叠
    canvas.style.top = `${rect.top - container.getBoundingClientRect().top}px`;
    canvas.style.left = `${rect.left - container.getBoundingClientRect().left}px`;
    
    drawingContext = canvas.getContext('2d');
    drawingContext.strokeStyle = '#FF0000';
    drawingContext.lineWidth = 2;
}

// 添加画布事件监听
function addCanvasEventListeners() {
    const canvas = document.getElementById('drawingCanvas');
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 添加清除按钮事件
    const clearButton = document.getElementById('clearCanvas');
    if (clearButton) {
        clearButton.addEventListener('click', clearDrawing);
    }
}

// 开始绘制
function startDrawing(e) {
    isDrawing = true;
    const coords = getRelativeCoordinates(e.clientX, e.clientY);
    startX = coords.x;
    startY = coords.y;
}

// 绘制过程
function draw(e) {
    if (!isDrawing) return;
    
    const canvas = document.getElementById('drawingCanvas');
    const coords = getRelativeCoordinates(e.clientX, e.clientY);
    
    // 清除之前的绘制内容
    drawingContext.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制新矩形
    drawingContext.beginPath();
    drawingContext.rect(
        Math.min(startX, coords.x),
        Math.min(startY, coords.y),
        Math.abs(coords.x - startX),
        Math.abs(coords.y - startY)
    );
    drawingContext.stroke();
    
    // 保存矩形坐标（相对坐标）
    rectCoords = {
        x1: Math.min(startX, coords.x) / canvas.width,
        y1: Math.min(startY, coords.y) / canvas.height,
        x2: Math.max(startX, coords.x) / canvas.width,
        y2: Math.max(startY, coords.y) / canvas.height
    };
}

// 停止绘制
function stopDrawing() {
    isDrawing = false;
}

// 清除绘制
function clearDrawing() {
    const canvas = document.getElementById('drawingCanvas');
    drawingContext.clearRect(0, 0, canvas.width, canvas.height);
    rectCoords = null;
}

// 获取相对坐标
function getRelativeCoordinates(x, y) {
    const canvas = document.getElementById('drawingCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
        x: x - rect.left,
        y: y - rect.top
    };
}

// 页面加载时获取历史图片
document.addEventListener('DOMContentLoaded', () => {
    loadHistoryImages();
    
    // 添加粘贴事件监听
    document.addEventListener('paste', handlePaste);
});

// 添加粘贴处理函数
async function handlePaste(e) {
    // 获取剪贴板数据
    const items = e.clipboardData.items;
    
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            // 获取图片文件
            const file = item.getAsFile();
            const timestamp = new Date().getTime();
            const filename = `pasted_image_${timestamp}.png`;
            
            // 创建带有文件名的新文件对象
            const newFile = new File([file], filename, { type: file.type });
            
            // 使用现有的上传逻辑
            const formData = new FormData();
            formData.append('file', newFile);
            
            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                // 重新加载所有图片
                await loadHistoryImages();
                
                // 选择新上传的图片
                const reader = new FileReader();
                reader.onload = (e) => {
                    selectImage(data.filename, e.target.result);
                };
                reader.readAsDataURL(newFile);
            } catch (error) {
                console.error('Upload failed:', error);
            }
            
            break;
        }
    }
}

// 修改图片上传处理
document.getElementById('imageUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        // 重新加载所有图片
        await loadHistoryImages();
        
        // 选择新上传的图片
        const reader = new FileReader();
        reader.onload = (e) => {
            selectImage(data.filename, e.target.result);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Upload failed:', error);
    }
});

// 发送消息
async function sendMessage(message) {
    if (!currentImageName) {
        alert('Please upload an image first');
        return;
    }

    // 构建标注区域信息
    let areaInfo = '';
    if (rectCoords) {
        areaInfo = `I specified the rectangular area in the image, and its relative position is (x:${(rectCoords.x1*100).toFixed(1)}%, y:${(rectCoords.y1*100).toFixed(1)}%) to (x:${(rectCoords.x2*100).toFixed(1)}%, y:${(rectCoords.y2*100).toFixed(1)}%)]`;
    }
    
    // 添加用户消息到聊天历史
    addMessageToChat('user', areaInfo + ", and " + message);
    
    // 添加正在输入提示
    addMessageToChat('ai', '', true);

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_name: currentImageName,
                message: areaInfo+ ", and " + message
            })
        });

        // 移除正在输入提示
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 添加AI响应到聊天历史
        addMessageToChat('ai', data.text);
        
        // 播放音频响应
        if (data.audio) {
            playAudioResponse(data.audio);
        }
    } catch (error) {
        // 移除正在输入提示
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        
        console.error('Chat failed:', error);
        addMessageToChat('system', 'Error: Failed to send message');
    }
}

// 添加消息到聊天历史
function addMessageToChat(role, message, isTyping = false) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}-message`;
    
    if (isTyping) {
        messageDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        messageDiv.id = 'typingIndicator';
    } else {
        // 创建消息容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 如果是AI消息，移除SSML标签并添加播放按钮
        if (role === 'ai') {
            // 移除SSML标签，只保留文本内容
            const textContent = message.replace(/<[^>]+>/g, '').trim();
            contentDiv.textContent = textContent;
            
            // 添加播放按钮
            const playButton = document.createElement('button');
            playButton.className = 'btn btn-circle btn-xs btn-primary play-button';
            playButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
            `;
            
            // 存储原始SSML用于播放
            const ssmlContent = message;
            playButton.onclick = async () => {
                try {
                    const response = await fetch('/replay-audio', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            ssml: ssmlContent
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    if (data.audio) {
                        playAudioResponse(data.audio);
                    }
                } catch (error) {
                    console.error('Failed to replay audio:', error);
                }
            };
            
            messageDiv.appendChild(playButton);
        } else {
            contentDiv.textContent = message;
        }
        
        messageDiv.appendChild(contentDiv);
    }
    
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 播放音频响应
function playAudioResponse(base64Audio) {
    if (!base64Audio) {
        console.error('No audio data received');
        return;
    }
    
    try {
        console.log('Audio data length:', base64Audio.length);
        const audio = new Audio('data:audio/wav;base64,' + base64Audio);
        
        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
        };
        
        audio.onloadeddata = () => {
            console.log('Audio loaded successfully');
        };
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Audio playback failed:', error);
            });
        }
    } catch (error) {
        console.error('Error creating audio:', error);
    }
}

// 发送按钮点击事件
document.getElementById('sendButton').addEventListener('click', () => {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (message) {
        sendMessage(message);
        input.value = '';
    }
});

// 添加语音消息到聊天窗口
function addVoiceMessageToChat(role, audioUrl) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}-message voice-message-container`;
    
    // 创建语音消息的内容容器
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content voice-message';
    
    // 添加语音图标
    const voiceIcon = document.createElement('span');
    voiceIcon.innerHTML = '🎤';
    contentDiv.appendChild(voiceIcon);
    
    // 添加状态/文本显示区域
    const textSpan = document.createElement('span');
    textSpan.className = 'voice-text';
    textSpan.textContent = 'Processing...';  // 初始状态
    contentDiv.appendChild(textSpan);
    
    // 添加音频播放器（隐藏）
    const audio = document.createElement('audio');
    audio.src = audioUrl;
    audio.controls = true;
    audio.style.display = 'none';
    contentDiv.appendChild(audio);
    
    // 添加播放按钮
    const playButton = document.createElement('button');
    playButton.className = 'btn btn-circle btn-xs btn-primary play-button';
    playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
        </svg>
    `;
    playButton.onclick = () => audio.play();
    contentDiv.appendChild(playButton);
    
    messageDiv.appendChild(contentDiv);
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    return { messageDiv, textSpan };  // 返回消息元素，以便后续更新
}

// 修改语音按钮点击事件处理
document.getElementById('voiceButton').addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm',
                audioBitsPerSecond: 16000
            });
            audioChunks = [];
            
            let voiceMessage = null;
            let textSpan = null;

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioData = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(audioData);
                const wavBlob = await convertToWav(audioBuffer);
                recordedAudioURL = URL.createObjectURL(wavBlob);
                
                // 添加语音消息到聊天窗口，并获取消息元素
                const elements = addVoiceMessageToChat('user', recordedAudioURL);
                voiceMessage = elements.messageDiv;
                textSpan = elements.textSpan;
                
                const reader = new FileReader();
                reader.readAsDataURL(wavBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result.split(',')[1];
                    
                    try {
                        textSpan.textContent = 'Recognizing...';  // 更新状态
                        
                        const response = await fetch('/speech-to-text', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                audio_data: base64Audio
                            })
                        });

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const data = await response.json();
                        if (data.text) {
                            // 更新语音消息的文本内容
                            textSpan.textContent = data.text;
                            // 发送消息到聊天系统
                            await sendMessage(data.text);
                        } else {
                            textSpan.textContent = 'Recognition failed';
                        }
                    } catch (error) {
                        console.error('Speech recognition failed:', error);
                        textSpan.textContent = 'Recognition failed';
                    }
                };
            };

            mediaRecorder.start();
            isRecording = true;
            document.getElementById('voiceButton').classList.add('recording');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please check your permissions.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        document.getElementById('voiceButton').classList.remove('recording');
    }
});

// 回车发送消息
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const message = e.target.value.trim();
        if (message) {
            sendMessage(message);
            e.target.value = '';
        }
    }
});

// 添加清除对话历史的函数
function clearChatHistory() {
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.innerHTML = '';
    // 可以考虑也通知后端清除历史
}

// 添加 WAV 转换函数
function convertToWav(audioBuffer) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // 写入 WAV 头
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * 2 * numOfChannels, true);
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // 写入音频数据
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    offset = 44;
    while (pos < audioBuffer.length) {
        for (let i = 0; i < numOfChannels; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// 添加窗口大小改变事件监听
window.addEventListener('resize', () => {
    if (currentImageName) {
        initializeCanvas();
    }
}); 