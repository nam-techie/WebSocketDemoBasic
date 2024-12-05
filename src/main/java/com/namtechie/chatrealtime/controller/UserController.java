package com.namtechie.chatrealtime.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.namtechie.chatrealtime.config.WebSocketEventListener;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

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
            response.put("available", false);
            response.put("message", "Username không được để trống");
            return ResponseEntity.badRequest().body(response);
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
}

