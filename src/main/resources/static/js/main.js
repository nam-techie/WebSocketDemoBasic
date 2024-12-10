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

    let inputUsername = document.querySelector('#name').value.trim();

    try {
        const response = await fetch('/api/check-username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: inputUsername })
        });

        const result = await response.json();

        if (!result.available) {
            showError(result.message);
            return;
        }

        username = result.generatedUsername || inputUsername;
        console.log('Username:', username);  // Debug log

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);

        stompClient.connect(
            {},
            function() {
                stompClient.subscribe('/topic/public', onMessageReceived);
                stompClient.subscribe('/topic/online-count', onOnlineCountReceived);
                
                stompClient.send("/app/chat.addUser",
                    {},
                    JSON.stringify({
                        sender: username,
                        type: 'JOIN'
                    })
                );
                
                stompClient.send("/app/chat.getOnlineCount", {}, {});

                usernamePage.classList.add('hidden');
                chatPage.classList.remove('hidden');
                connectingElement.classList.add('hidden');
            },
            onError
        );
    } catch (error) {
        console.error('Error during connection:', error);
        showError('Lỗi kết nối: ' + error.message);
    }
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
        JSON.stringify({ sender: username, type: 'JOIN' })
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
    event.preventDefault();

    const messageInput = document.getElementById('message');
    const messageContent = messageInput.value.trim();

    try {
        if (window.pastedImage) {
            console.log('Sending file message with type:', window.pastedImage.type);

            const chatMessage = {
                type: 'FILE',
                sender: username,
                content: messageContent || 'Đã gửi một hình ảnh',
                fileContent: window.pastedImage.content,
                fileName: window.pastedImage.name,
                fileType: window.pastedImage.type
            };

            console.log('Sending file message:', {
                type: chatMessage.type,
                sender: chatMessage.sender,
                fileType: chatMessage.fileType,
                fileName: chatMessage.fileName
            });

            stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
            removePreview();
        } else {
            const chatMessage = {
                type: 'CHAT',
                content: messageContent,
                sender: username
            };
            stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        }

        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        showError('Lỗi khi gửi tin nhắn: ' + error.message);
    }
}

// Thêm hàm để kiểm tra kích thước và loại tin nhắn
function validateMessage(chatMessage) {
    console.log('Validating message:', {
        type: chatMessage.type,
        hasFileContent: !!chatMessage.fileContent,
        fileType: chatMessage.fileType
    });

    if (chatMessage.type === 'FILE') {
        if (!chatMessage.fileContent) {
            throw new Error('Thiếu nội dung file');
        }
        if (!chatMessage.fileType) {
            throw new Error('Thiếu loại file');
        }
        // Kiểm tra kích thước base64
        const sizeInBytes = chatMessage.fileContent.length * 0.75; // Ước tính kích thước thực từ base64
        console.log('File size in bytes:', sizeInBytes);
        if (sizeInBytes > 5 * 1024 * 1024) { // 5MB limit
            throw new Error('File quá lớn (giới hạn 5MB)');
        }
    }
    return true;
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

        // Tên người gửi
        var senderElement = document.createElement('div');
        senderElement.classList.add('message-sender');
        senderElement.textContent = message.sender;
        messageElement.appendChild(senderElement);

        // Container cho avatar và nội dung
        var messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container');

        // Avatar
        var avatarElement = document.createElement('div');
        avatarElement.classList.add('message-avatar');
        avatarElement.style.background = getAvatarColor(message.sender);
        avatarElement.textContent = message.sender.charAt(0).toUpperCase();

        // Message content container
        var messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        if (message.type === 'AUDIO') {
            const audioContainer = document.createElement('div');
            audioContainer.classList.add('audio-message');

            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = `data:${message.fileType};base64,${message.fileContent}`;

            audioContainer.appendChild(audio);
            messageContent.appendChild(audioContainer);
        } else if (message.type === 'FILE') {
            // Xử lý file message
            var fileElement = document.createElement('div');
            fileElement.classList.add('file-content');

            if (message.fileType && message.fileType.startsWith('image/')) {
                var img = document.createElement('img');
                img.src = `data:${message.fileType};base64,${message.fileContent}`;
                img.style.maxWidth = '200px';
                img.style.cursor = 'pointer';
                img.onclick = function () {
                    window.open(img.src, '_blank');
                };
                fileElement.appendChild(img);
            } else if (message.fileType && message.fileType.startsWith('video/')) {
                var video = document.createElement('video');
                video.src = `data:${message.fileType};base64,${message.fileContent}`;
                video.controls = true;
                video.style.maxWidth = '300px';
                fileElement.appendChild(video);
            } else if (message.fileContent) {
                var link = document.createElement('a');
                link.href = `data:${message.fileType};base64,${message.fileContent}`;
                link.download = message.fileName || 'download';
                link.innerHTML = `<i class="fas fa-file"></i> ${message.fileName || 'Tải xuống file'}`;
                link.classList.add('file-download');
                fileElement.appendChild(link);
            }
            messageContent.appendChild(fileElement);
        } else {
            // Xử lý text message
            var textElement = document.createElement('p');
            textElement.classList.add('message-text');
            textElement.textContent = message.content;
            messageContent.appendChild(textElement);
        }

        // Ghép các phần lại với nhau
        messageContainer.appendChild(avatarElement);
        messageContainer.appendChild(messageContent);
        messageElement.appendChild(messageContainer);
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
    foods: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍋', '🥥'],
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

function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);
    } else {
        alert(message);
    }
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

// G���i hàm này khi trang được load
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
    reader.onload = function (e) {
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
    reader.onerror = function (error) {
        console.error('Error reading file:', error);
        showError('Lỗi khi đọc file. Vui lòng thử lại.');
    };

    reader.readAsDataURL(file);
}

// Thêm event listener cho nút voice
document.addEventListener('DOMContentLoaded', function () {
    const voiceButton = document.getElementById('voiceButton');
    voiceButton.addEventListener('click', handleVoiceRecording);
});

// Thêm vào phần khởi tạo các event listeners
document.getElementById('message').addEventListener('paste', handlePaste);

// Hàm kiểm tra loại file
function isValidFileType(fileType) {
    const supportedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    return supportedTypes.includes(fileType);
}

// Hàm xử lý paste
function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    for (let item of items) {
        console.log('Pasted item type:', item.type); // Debug log

        if (item.type.indexOf('image') === 0) {
            e.preventDefault();
            const blob = item.getAsFile();

            // Kiểm tra kích thước file
            if (blob.size > 10 * 1024 * 1024) {
                showError('File quá lớn. Vui lòng chọn file nhỏ hơn 10MB');
                return;
            }

            const reader = new FileReader();

            reader.onload = function (event) {
                try {
                    const base64String = event.target.result.split(',')[1];
                    console.log('Image type:', item.type); // Debug log

                    const imagePreview = document.getElementById('image-preview');
                    imagePreview.innerHTML = `
                        <div class="preview-container">
                            <img src="${event.target.result}" alt="Pasted image">
                            <div class="remove-image" onclick="removePreview()">
                                <i class="fas fa-times"></i>
                            </div>
                        </div>
                    `;
                    imagePreview.classList.remove('hidden');

                    // Lưu thông tin file với type cụ thể
                    window.pastedImage = {
                        content: base64String,
                        type: item.type || 'image/png', // Fallback to PNG if type is undefined
                        name: `image_${Date.now()}.${(item.type || 'image/png').split('/')[1]}`
                    };

                    console.log('Stored image info:', {
                        type: window.pastedImage.type,
                        name: window.pastedImage.name
                    });

                } catch (error) {
                    console.error('Error processing image:', error);
                    showError('Lỗi khi xử lý ảnh. Vui lòng thử lại.');
                }
            };

            reader.onerror = function (error) {
                console.error('Error reading file:', error);
                showError('Lỗi khi đọc file. Vui lòng thử lại.');
            };

            reader.readAsDataURL(blob);
        }
    }
}

// Sửa lại hàm removePreview
function removePreview() {
    const imagePreview = document.getElementById('image-preview');
    imagePreview.innerHTML = '';
    imagePreview.classList.add('hidden');
    window.pastedImage = null;
}

// Thêm hàm debug để kiểm tra kích thước message
function checkMessageSize(message) {
    const size = new Blob([JSON.stringify(message)]).size;
    console.log('Message size:', size, 'bytes');
    return size;
}