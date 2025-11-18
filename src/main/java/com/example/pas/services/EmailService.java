package com.example.pas.services;

public interface EmailService {
    void sendVerificationCode(String toEmail, String code);
}