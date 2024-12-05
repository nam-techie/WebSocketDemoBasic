package com.namtechie.chatrealtime.chat;

import java.util.Objects;

public class ChatMessage {

    private MessageType type;
    private String content;
    private String sender;

    // Constructor
    public ChatMessage(MessageType type, String content, String sender) {
        this.type = type;
        this.content = content;
        this.sender = sender;
    }

    // Getter và Setter
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
                '}';
    }

    // Builder Pattern
    public static class Builder {
        private MessageType type;
        private String content;
        private String sender;

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

        public ChatMessage build() {
            return new ChatMessage(type, content, sender);
        }
    }
}
