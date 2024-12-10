package com.namtechie.chatrealtime.controller;

import com.namtechie.chatrealtime.chat.ChatMessage;
import com.namtechie.chatrealtime.chat.MessageType;
import com.namtechie.chatrealtime.config.WebSocketEventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import java.util.Base64;

@Controller
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    @Autowired
    private WebSocketEventListener webSocketEventListener;

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(
            @Payload ChatMessage chatMessage
    ) {
        logger.info("Received message of type: {}", chatMessage.getType());

        try {
            if (chatMessage.getType() == MessageType.FILE) {
                return handleFileMessage(chatMessage);
            }
            return chatMessage;
        } catch (Exception e) {
            logger.error("Error processing message", e);
            return createErrorMessage(chatMessage.getSender(), "Lỗi xử lý tin nhắn: " + e.getMessage());
        }
    }

    private ChatMessage handleFileMessage(ChatMessage chatMessage) {
        logger.info("Processing file message from {}: {}", 
            chatMessage.getSender(), 
            chatMessage.getFileName());

        // Validate file content
        if (chatMessage.getFileContent() == null || chatMessage.getFileContent().isEmpty()) {
            logger.error("File content is empty");
            return createErrorMessage(chatMessage.getSender(), "Nội dung file trống");
        }

        // Validate file size
        byte[] decodedContent = Base64.getDecoder().decode(chatMessage.getFileContent());
        if (decodedContent.length > MAX_FILE_SIZE) {
            logger.error("File size exceeds limit");
            return createErrorMessage(chatMessage.getSender(), "File quá lớn (giới hạn 5MB)");
        }

        // Validate file type
        String fileType = chatMessage.getFileType();
        if (!isValidFileType(fileType)) {
            logger.error("Invalid file type: {}", fileType);
            return createErrorMessage(chatMessage.getSender(), "Loại file không được hỗ trợ");
        }

        logger.info("File processed successfully: {}", chatMessage.getFileName());
        return chatMessage;
    }

    private boolean isValidFileType(String fileType) {
        if (fileType == null) return false;
        return fileType.startsWith("image/") || 
               fileType.startsWith("video/") || 
               fileType.equals("application/pdf") ||
               fileType.equals("application/msword") ||
               fileType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    private ChatMessage createErrorMessage(String sender, String errorMessage) {
        ChatMessage error = new ChatMessage();
        error.setType(MessageType.ERROR);
        error.setSender(sender);
        error.setContent(errorMessage);
        return error;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(
            @Payload ChatMessage chatMessage,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        logger.info("User joined: {}", chatMessage.getSender());
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        return chatMessage;
    }

    @MessageMapping("/chat.getOnlineCount")
    @SendTo("/topic/online-count")
    public String getOnlineCount() {
        int count = webSocketEventListener.getOnlineUsers().size();
        logger.info("Sending online count: {}", count);
        return String.valueOf(count);
    }
}
