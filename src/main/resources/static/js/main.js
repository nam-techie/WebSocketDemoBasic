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

function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    var messageElement = document.createElement('li');

    if (message.type === 'ERROR') {
        console.log('Error received:', message.content); // Debug log lỗi
        showError(message.content);
        usernamePage.classList.remove('hidden');
        chatPage.classList.add('hidden');
    }
    else if (message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        var textElement = document.createElement('p');
        textElement.textContent = message.sender + ' đã tham gia phòng chat';
        messageElement.appendChild(textElement);
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        var textElement = document.createElement('p');
        textElement.textContent = message.sender + ' đã rời phòng chat';
        messageElement.appendChild(textElement);
    } else {
        messageElement.classList.add('chat-message');

        // Tạo avatar
        var avatarElement = document.createElement('div');
        avatarElement.classList.add('message-avatar');
        avatarElement.style.background = getAvatarColor(message.sender);
        avatarElement.textContent = message.sender.charAt(0).toUpperCase();

        // Tạo container cho nội dung tin nhắn
        var messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        // Tên người gửi
        var senderElement = document.createElement('div');
        senderElement.classList.add('message-sender');
        senderElement.textContent = message.sender;

        // Nội dung tin nhắn
        var textElement = document.createElement('div');
        textElement.classList.add('message-text');
        textElement.textContent = message.content;

        messageContent.appendChild(senderElement);
        messageContent.appendChild(textElement);

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
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸'],
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