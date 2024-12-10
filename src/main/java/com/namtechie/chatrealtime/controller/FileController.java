package com.namtechie.chatrealtime.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.UUID;

@Controller
@RequestMapping("/api/files")
public class FileController {

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    private Path getUploadPath() throws IOException {
        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        return uploadPath;
    }

    @PostMapping("/upload")
    @ResponseBody
    public String uploadFile(@RequestBody String base64Content, 
                           @RequestParam String fileType) throws IOException {
        // Xóa prefix của base64 nếu có
        String base64Data = base64Content.contains(",") ? 
            base64Content.split(",")[1] : base64Content;

        // Tạo tên file ngẫu nhiên
        String fileName = UUID.randomUUID().toString() + getFileExtension(fileType);
        
        // Decode base64 và lưu file
        byte[] fileBytes = Base64.getDecoder().decode(base64Data);
        Path filePath = getUploadPath().resolve(fileName);
        Files.write(filePath, fileBytes);

        // Trả về đường dẫn để truy cập file
        return "/api/files/" + fileName;
    }

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<Resource> serveFile(@PathVariable String fileName) throws IOException {
        Path filePath = getUploadPath().resolve(fileName);
        Resource resource = new UrlResource(filePath.toUri());

        if (resource.exists() && resource.isReadable()) {
            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(Files.probeContentType(filePath)))
                .body(resource);
        }

        return ResponseEntity.notFound().build();
    }

    private String getFileExtension(String fileType) {
        switch (fileType) {
            case "image/jpeg":
                return ".jpg";
            case "image/png":
                return ".png";
            case "image/gif":
                return ".gif";
            default:
                return ".jpg";
        }
    }
} 