package com.namtechie.chatrealtime.config;

import com.namtechie.chatrealtime.chat.ChatMessage;
import com.namtechie.chatrealtime.chat.MessageType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messageTemplate;
    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    // ConcurrentHashMap lưu trữ người dùng online với username là key và timestamp (dạng LocalDateTime) là giá trị
    private final Map<String, LocalDateTime> onlineUsers = new ConcurrentHashMap<>();

    // Constructor thủ công để khởi tạo messageTemplate
    public WebSocketEventListener(SimpMessageSendingOperations messageTemplate) {
        this.messageTemplate = messageTemplate;
    }

    // Lắng nghe sự kiện khi có người dùng kết nối WebSocket
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String username = headerAccessor.getFirstNativeHeader("username");
        
        log.info("Connect event received for username: {}", username);

        if (username == null || username.trim().isEmpty()) {
            log.error("Received null or empty username in WebSocket connection");
            return;
        }

        // Kiểm tra và xử lý người dùng mới kết nối
        if (!onlineUsers.containsKey(username)) {
            onlineUsers.put(username, LocalDateTime.now());
            headerAccessor.getSessionAttributes().put("username", username);
            
            // Chỉ gửi số lượng người dùng online
            messageTemplate.convertAndSend("/topic/online-count", onlineUsers.size());
            printOnlineUsers();
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String username = (String) headerAccessor.getSessionAttributes().get("username");

        if (username != null) {
            log.info("User disconnected: {}", username);
            if (onlineUsers.containsKey(username)) {
                onlineUsers.remove(username);
                
                // Gửi thông báo LEAVE
                ChatMessage chatMessage = new ChatMessage(MessageType.LEAVE, null, username);
                messageTemplate.convertAndSend("/topic/public", chatMessage);
                
                // Gửi số lượng người dùng online sau khi người dùng rời đi
                int onlineCount = onlineUsers.size();
                log.info("Current online users after disconnect: {}", onlineCount);
                messageTemplate.convertAndSend("/topic/online-count", onlineCount);
            }
        }
    }

    // In danh sách tất cả người dùng đang online
    private void printOnlineUsers() {
        // Lặp qua các người dùng và in ra username cùng với thời gian kết nối
        onlineUsers.forEach((username, timestamp) -> {
            // Định dạng thời gian theo mẫu: ngày/tháng/năm giờ:phút:giây
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm:ss dd-MM-yyyy");
            String formattedTimestamp = timestamp.format(formatter);

            // Log thông tin người dùng cùng với timestamp
            log.info("Username connecting: {}, Time to login: {}", username, formattedTimestamp);
        });

        // Đếm số lượng người dùng online
        int onlineCount = onlineUsers.size();
        log.info("Currently, there are {} users online.", onlineCount);
    }

    public Map<String, LocalDateTime> getOnlineUsers() {
        return onlineUsers;
    }

}
