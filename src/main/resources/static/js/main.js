'use strict';

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');

var stompClient = null;
var username = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

async function checkUsername(username) {
    try {
        const response = await fetch('/api/check-username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: username })
        });

        if (response.status === 409) {
            return { available: false, message: 'Tên người dùng đã tồn tại, vui lòng chọn tên khác' };
        }

        return await response.json();
    } catch (error) {
        console.error('Error checking username:', error);
        return { available: false, message: 'Lỗi khi kiểm tra username' };
    }
}

async function connect(event) {
    event.preventDefault();
    console.log('Connect function called');
    username = document.querySelector('#name').value.trim();

    if (!username) {
        alert("Vui lòng nhập tên người dùng hợp lệ.");
        return;
    }

    console.log('Checking username:', username);
    const checkResult = await checkUsername(username);
    console.log('Check result:', checkResult);

    if (!checkResult.available) {
        showError(checkResult.message);
        return;
    }

    console.log('Attempting WebSocket connection...');
    var socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.connect({ username: username }, onConnected, onError);
}

function onConnected() {
    console.log('Connected successfully!');
    
    // Subscribe to the Public Topic
    stompClient.subscribe('/topic/public', onMessageReceived);
    
    // Subscribe to online count updates
    stompClient.subscribe('/topic/online-count', onOnlineCountReceived);

    // Tell your username to the server
    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    );

    // Yêu cầu số lượng người dùng online ngay khi kết nối thành công
    stompClient.send("/app/chat.getOnlineCount", {}, {});

    usernamePage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    connectingElement.classList.add('hidden');
}

function onError(error) {
    console.error("Connection error:", error);
    connectingElement.classList.remove('hidden');
    connectingElement.textContent = 'Không thể kết nối đến server. Vui lòng thử lại!';
    showError("Lỗi kết nối: " + error);
}

function sendMessage(event) {
    var messageContent = messageInput.value.trim();
    if(messageContent && stompClient) {
        var chatMessage = {
            sender: username,
            content: messageInput.value,
            type: 'CHAT'
        };
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        messageInput.value = '';
    }
    event.preventDefault();
}

// Thêm biến để quản lý recording
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Thêm hàm xử lý voice recording
async function handleVoiceRecording() {
    const voiceButton = document.getElementById('voiceButton');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const reader = new FileReader();
                
                reader.onload = () => {
                    const audioBase64 = reader.result.split(',')[1];
                    
                    // Gửi audio qua WebSocket
                    if (stompClient) {
                        const chatMessage = {
                            type: 'AUDIO',
                            sender: username,
                            content: 'Audio Message',
                            fileContent: audioBase64,
                            fileType: 'audio/wav',
                            fileName: 'voice_message.wav'
                        };
                        
                        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
                    }
                };
                
                reader.readAsDataURL(audioBlob);
                audioChunks = [];
            };

            mediaRecorder.start();
            isRecording = true;
            voiceButton.classList.add('recording');
            voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            
        } catch (error) {
            console.error('Lỗi khi truy cập microphone:', error);
            showError('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        voiceButton.classList.remove('recording');
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
    }
}

// Cập nhật hàm onMessageReceived để xử lý tin nhắn audio
function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    var messageElement = document.createElement('li');
    
    const isSelf = message.sender === username;
    
    if (message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        if (isSelf) messageElement.classList.add('self');
        var textElement = document.createElement('p');
        textElement.textContent = message.sender + ' đã tham gia phòng chat';
        messageElement.appendChild(textElement);
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        if (isSelf) messageElement.classList.add('self');
        var textElement = document.createElement('p');
        textElement.textContent = message.sender + ' đã rời phòng chat';
        messageElement.appendChild(textElement);
    } else {
        messageElement.classList.add('chat-message');
        if (isSelf) messageElement.classList.add('self');

        // Avatar
        var avatarElement = document.createElement('div');
        avatarElement.classList.add('message-avatar');
        avatarElement.style.background = getAvatarColor(message.sender);
        avatarElement.textContent = message.sender.charAt(0).toUpperCase();

        // Message content container
        var messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        // Sender name
        var senderElement = document.createElement('div');
        senderElement.classList.add('message-sender');
        senderElement.textContent = message.sender;

        messageContent.appendChild(senderElement);

        if (message.type === 'AUDIO') {
            // Tạo audio player
            const audioContainer = document.createElement('div');
            audioContainer.classList.add('audio-message');
            
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = `data:${message.fileType};base64,${message.fileContent}`;
            
            audioContainer.appendChild(audio);
            messageContent.appendChild(audioContainer);
        } else if (message.type === 'FILE') {
            // Tạo container cho nội dung tin nhắn
            var fileElement = document.createElement('div');
            fileElement.classList.add('file-content');

            if (message.fileType && message.fileType.startsWith('image/')) {
                // Hiển thị ảnh
                var img = document.createElement('img');
                img.src = `data:${message.fileType};base64,${message.fileContent}`;
                img.style.maxWidth = '300px';
                img.style.maxHeight = '200px';
                img.style.cursor = 'pointer';
                
                // Thêm chức năng click để xem ảnh full size
                img.onclick = function() {
                    window.open(img.src, '_blank');
                };
                
                fileElement.appendChild(img);
            } else if (message.fileType && message.fileType.startsWith('video/')) {
                // Hiển thị video
                var video = document.createElement('video');
                video.src = `data:${message.fileType};base64,${message.fileContent}`;
                video.controls = true;
                video.style.maxWidth = '300px';
                fileElement.appendChild(video);
            } else if (message.fileContent) {
                // Hiển thị link tải xuống cho các file khác
                var link = document.createElement('a');
                link.href = `data:${message.fileType};base64,${message.fileContent}`;
                link.download = message.fileName || 'download';
                link.innerHTML = `<i class="fas fa-file"></i> ${message.fileName || 'Tải xuống file'}`;
                link.classList.add('file-download');
                fileElement.appendChild(link);
            }

            messageContent.appendChild(senderElement);
            messageContent.appendChild(fileElement);
        } else {
            // ... existing text message code ...
        }

        messageElement.appendChild(avatarElement);
        messageElement.appendChild(messageContent);
    }

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function getAvatarColor(messageSender) {
    const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)'
    ];

    let hash = 0;
    for (let i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    let index = Math.abs(hash % colors.length);
    return colors[index];
}

usernameForm.addEventListener('submit', connect, true)
messageForm.addEventListener('submit', sendMessage, true)

// Danh sách emoji theo category
const emojis = {
    smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸'],
    foods: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍'],
    objects: ['💡', '🔦', '🕯', '📱', '📲', '💻', '⌨', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽']
};

// Khởi tạo emoji picker
function initEmojiPicker() {
    const emojiButton = document.getElementById('emojiButton');
    const emojiPicker = document.getElementById('emojiPicker');
    const messageInput = document.getElementById('message');

    // Hiển thị/ẩn emoji picker
    emojiButton.addEventListener('click', () => {
        emojiPicker.classList.toggle('hidden');
        if (!emojiPicker.classList.contains('hidden')) {
            loadEmojis('smileys'); // Load emoji mặc định
        }
    });

    // Xử lý chọn category
    document.querySelectorAll('.emoji-category').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelector('.emoji-category.active')?.classList.remove('active');
            button.classList.add('active');
            loadEmojis(button.dataset.category);
        });
    });

    // Load emojis cho category
    function loadEmojis(category) {
        const emojiList = document.querySelector('.emoji-list');
        emojiList.innerHTML = '';

        emojis[category].forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', () => {
                messageInput.value += emoji;
                messageInput.focus();
            });
            emojiList.appendChild(emojiItem);
        });
    }

    // Đóng emoji picker khi click ngoài
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && !emojiButton.contains(e.target)) {
            emojiPicker.classList.add('hidden');
        }
    });
}

// Gọi hàm khởi tạo khi trang đã load
document.addEventListener('DOMContentLoaded', initEmojiPicker);

// Dark mode toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    // Debug: Kiểm tra trạng thái theme
    console.log('Current theme:', document.documentElement.getAttribute('data-theme'));
    
    darkModeToggle.addEventListener('change', () => {
        const newTheme = darkModeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        // Debug: Log khi theme thay đổi
        console.log('Theme changed to:', newTheme);
    });
});

function showError(errorMessage) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = errorMessage;
    errorElement.style.display = 'block';
}

// Thêm hàm xử lý số lượng người dùng online
function onOnlineCountReceived(payload) {
    console.log('Received online count payload:', payload);
    try {
        const count = parseInt(payload.body);
        const onlineCountElement = document.querySelector('.online-count');
        if (onlineCountElement) {
            onlineCountElement.textContent = count;
        }
    } catch (error) {
        console.error('Error processing online count:', error);
    }
}

// Thêm HTML cho số lượng người dùng online
function addOnlineCountElement() {
    const onlineButton = document.querySelector('.online-button');
    const countSpan = document.createElement('span');
    countSpan.className = 'online-count';
    countSpan.style.marginLeft = '10px';
    countSpan.style.fontSize = '14px';
}

// Gọi hàm này khi trang được load
document.addEventListener('DOMContentLoaded', addOnlineCountElement);

// Thêm xử lý file input
const fileInput = document.getElementById('imageInput');
fileInput.addEventListener('change', handleFileSelect);

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Kiểm tra kích thước file (giới hạn 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showError('File quá lớn. Vui lòng chọn file nhỏ hơn 5MB');
        return;
    }

    console.log('Selected file:', file);
    console.log('File type:', file.type);
    console.log('File size:', file.size);

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileContent = e.target.result.split(',')[1]; // Lấy phần Base64 sau dấu phẩy
        
        console.log('File content length:', fileContent.length);
        
        // Gửi file qua WebSocket
        if (stompClient) {
            const chatMessage = {
                type: 'FILE',
                sender: username,
                content: file.name, // Sử dụng tên file làm content
                fileContent: fileContent,
                fileName: file.name,
                fileType: file.type
            };

            console.log('Sending file message:', chatMessage); // Debug log
            stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        }
    };

    // Xử lý lỗi khi đọc file
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        showError('Lỗi khi đọc file. Vui lòng thử lại.');
    };

    reader.readAsDataURL(file);
}

// Thêm event listener cho nút voice
document.addEventListener('DOMContentLoaded', function() {
    const voiceButton = document.getElementById('voiceButton');
    voiceButton.addEventListener('click', handleVoiceRecording);
});