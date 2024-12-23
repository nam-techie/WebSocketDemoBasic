package com.namtechie.chatrealtime.chat;

import java.util.Objects;

public class ChatMessage {

    private MessageType type;
    private String content;
    private String sender;
    private String fileContent;
    private String fileType;
    private String fileName;

    // Constructor mặc định
    public ChatMessage() {
    }

    // Constructor cơ bản cho tin nhắn thông thường
    public ChatMessage(MessageType type, String content, String sender) {
        this.type = type;
        this.content = content;
        this.sender = sender;
    }

    // Constructor cho file message
    public ChatMessage(MessageType type, String content, String sender, 
                      String fileContent, String fileType, String fileName) {
        this.type = type;
        this.content = content;
        this.sender = sender;
        this.fileContent = fileContent;
        this.fileType = fileType;
        this.fileName = fileName;
    }

    // Getters và Setters
    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getFileContent() {
        return fileContent;
    }

    public void setFileContent(String fileContent) {
        this.fileContent = fileContent;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    // Phương thức equals() và hashCode()
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        ChatMessage that = (ChatMessage) obj;
        return type == that.type && content.equals(that.content) && sender.equals(that.sender);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, content, sender);
    }

    // Phương thức toString()
    @Override
    public String toString() {
        return "ChatMessage{" +
                "type=" + type +
                ", content='" + content + '\'' +
                ", sender='" + sender + '\'' +
                ", fileName='" + fileName + '\'' +
                ", fileType='" + fileType + '\'' +
                ", fileContent='" + fileContent + '\'' +
                '}';
    }

    // Builder Pattern
    public static class Builder {
        private MessageType type;
        private String content;
        private String sender;
        private String fileName;
        private String fileType;
        private String fileContent;

        public Builder setType(MessageType type) {
            this.type = type;
            return this;
        }

        public Builder setContent(String content) {
            this.content = content;
            return this;
        }

        public Builder setSender(String sender) {
            this.sender = sender;
            return this;
        }

        public Builder setFileName(String fileName) {
            this.fileName = fileName;
            return this;
        }

        public Builder setFileType(String fileType) {
            this.fileType = fileType;
            return this;
        }

        public Builder setFileContent(String fileContent) {
            this.fileContent = fileContent;
            return this;
        }

        public ChatMessage build() {
            return new ChatMessage(type, content, sender, fileName, fileType, fileContent);
        }
    }
}
