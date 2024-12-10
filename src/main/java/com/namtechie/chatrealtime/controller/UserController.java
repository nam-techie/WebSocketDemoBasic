package com.namtechie.chatrealtime.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.namtechie.chatrealtime.config.WebSocketEventListener;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api")
public class UserController {

    private final Map<String, LocalDateTime> onlineUsers;

    public UserController(WebSocketEventListener webSocketEventListener) {
        this.onlineUsers = webSocketEventListener.getOnlineUsers();
    }

    @PostMapping("/check-username")
    public ResponseEntity<?> checkUsername(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        Map<String, Object> response = new HashMap<>();

        if (username == null || username.trim().isEmpty()) {
            username = generateRandomUsername();
            while (onlineUsers.containsKey(username)) {
                username = generateRandomUsername();
            }
            response.put("available", true);
            response.put("message", "Đã tạo tên tự động");
            response.put("generatedUsername", username);
            return ResponseEntity.ok(response);
        }

        if (onlineUsers.containsKey(username)) {
            response.put("available", false);
            response.put("message", "Username đã tồn tại, vui lòng chọn tên khác");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }

        response.put("available", true);
        response.put("message", "Username có thể sử dụng");
        return ResponseEntity.ok(response);
    }

    private String generateRandomUsername() {
        Random random = new Random();
        StringBuilder randomNumber = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            randomNumber.append(random.nextInt(10));
        }
        return "user" + randomNumber.toString();
    }
}

