package com.example.pas.controllers;

import com.example.pas.models.Room;
import com.example.pas.models.User;
import com.example.pas.repositories.RoomRepository;
import com.example.pas.repositories.UserRepository;
import com.example.pas.models.CloudinaryService;
import com.example.pas.services.EmailService;
import com.example.pas.util.jwtutil;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.apache.commons.lang3.tuple.Pair;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.http.HttpServletRequest;
import io.jsonwebtoken.Jwts;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowCredentials = "false")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private CloudinaryService cloudinaryService;

    @Autowired
    private jwtutil jwtUtil;

    private final Map<String, Pair<String, Long>> emailCodeStorage = new ConcurrentHashMap<>();
    private final Map<String, Long> lastSentMap = new ConcurrentHashMap<>();

    @GetMapping("/user/info")
    public ResponseEntity<Map<String, Object>> getUserInfo(@RequestParam String email) {
        Optional<User> user = userRepository.findByEmail(email);
        Map<String, Object> response = new HashMap<>();

        if (user.isPresent()) {
            response.put("success", true);
            response.put("email", user.get().getEmail());
            response.put("displayName", user.get().getDisplayName());
        } else {
            response.put("success", false);
            response.put("message", "사용자 정보를 찾을 수 없습니다.");
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> user) {
        Map<String, Object> response = new HashMap<>();
        String email = user.get("email");
        String password = user.get("password");
        String displayName = user.get("displayName");

        if (email == null || password == null || displayName == null) {
            response.put("success", false);
            response.put("message", "필수 항목이 누락되었습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        if (userRepository.findByEmail(email).isPresent()) {
            response.put("success", false);
            response.put("message", "이미 등록된 이메일입니다.");
            return ResponseEntity.badRequest().body(response);
        }

        String encodedPassword = passwordEncoder.encode(password);
        User newUser = new User(email, encodedPassword, displayName);
        userRepository.save(newUser);

        response.put("success", true);
        response.put("message", "회원가입 성공!");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> user,
            HttpServletResponse responseHttp) {

        Map<String, Object> response = new HashMap<>();
        String email = user.get("email");
        String rawPassword = user.get("password");

        Optional<User> foundUser = userRepository.findByEmail(email);
        if (foundUser.isPresent()) {
            String hashedPassword = foundUser.get().getPassword();
            if (passwordEncoder.matches(rawPassword, hashedPassword)) {
                String token = jwtUtil.generateToken(email);
                System.out.println("✅ JWT 발급: " + token);

                Cookie cookie = new Cookie("access_token", token);
                cookie.setHttpOnly(true);
                cookie.setPath("/");
                cookie.setMaxAge(30 * 60);
                cookie.setSecure(false);

                responseHttp.addCookie(cookie);

                response.put("success", true);
                response.put("message", "로그인 성공!");
                return ResponseEntity.ok(response);
            }
        }

        response.put("success", false);
        response.put("message", "이메일 또는 비밀번호가 틀립니다.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<Map<String, Object>> refreshToken(HttpServletRequest request, HttpServletResponse response) {
        Map<String, Object> result = new HashMap<>();

        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("access_token".equals(cookie.getName())) {
                    String oldToken = cookie.getValue();

                    try {
                        String email = Jwts.parserBuilder()
                                .setSigningKey(jwtUtil.getSigningKey())
                                .build()
                                .parseClaimsJws(oldToken)
                                .getBody()
                                .getSubject();
                        String newToken = jwtUtil.generateToken(email);
                        Cookie newCookie = new Cookie("access_token", newToken);
                        newCookie.setHttpOnly(true);
                        newCookie.setSecure(true);
                        newCookie.setPath("/");
                        newCookie.setMaxAge(60 * 30);

                        response.addCookie(newCookie);

                        result.put("success", true);
                        result.put("message", "토큰 갱신 성공");
                        return ResponseEntity.ok(result);

                    } catch (Exception e) {
                        result.put("success", false);
                        result.put("message", "토큰이 유효하지 않음");
                        return ResponseEntity.status(401).body(result);
                    }
                }
            }
        }

        result.put("success", false);
        result.put("message", "쿠키에 토큰이 없음");
        return ResponseEntity.status(401).body(result);
    }

    @PostMapping("/check-email")
    public ResponseEntity<Map<String, Object>> checkEmail(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String email = request.get("email");

        if (email == null || !email.contains("@")) {
            response.put("exists", false);
            response.put("message", "이메일 형식이 올바르지 않습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        boolean exists = userRepository.existsByEmail(email);
        response.put("exists", exists);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/send-email-code")
    public ResponseEntity<Map<String, Object>> sendEmailCode(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String email = request.get("email");

        long now = System.currentTimeMillis();
        long lastSent = lastSentMap.getOrDefault(email, 0L);
        if (now - lastSent < 60_000) {
            response.put("success", false);
            response.put("message", "1분 후에 다시 시도해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }

        String code = generateCode();
        emailCodeStorage.put(email, Pair.of(code, now));
        emailService.sendVerificationCode(email, code);
        lastSentMap.put(email, now);

        response.put("success", true);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-email-code")
    public ResponseEntity<Map<String, Object>> verifyEmailCode(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String email = request.get("email");
        String code = request.get("code");

        Pair<String, Long> entry = emailCodeStorage.get(email);
        long now = System.currentTimeMillis();

        boolean verified = entry != null &&
                entry.getLeft().equals(code) &&
                now - entry.getRight() <= 5 * 60 * 1000;

        response.put("verified", verified);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-password")
    public ResponseEntity<Map<String, Object>> verifyPassword(@RequestBody Map<String, String> req) {
        Map<String, Object> response = new HashMap<>();
        String email = req.get("email");
        String password = req.get("password");

        Optional<User> user = userRepository.findByEmail(email);
        boolean valid = user.isPresent() && passwordEncoder.matches(password, user.get().getPassword());
        response.put("valid", valid);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String email = request.get("email");
        String currentPassword = request.get("currentPassword");
        String newPassword = request.get("newPassword");

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        User user = userOpt.get();
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            response.put("success", false);
            response.put("message", "현재 비밀번호가 일치하지 않습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        response.put("success", true);
        response.put("message", "비밀번호가 성공적으로 변경되었습니다.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> req) {
        Map<String, Object> response = new HashMap<>();
        String email = req.get("email");
        String newPassword = req.get("newPassword");

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        User user = userOpt.get();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        response.put("success", true);
        response.put("message", "비밀번호가 성공적으로 재설정되었습니다.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/check-nickname")
    public ResponseEntity<Map<String, Object>> checkNickname(@RequestParam String name) {
        Map<String, Object> response = new HashMap<>();
        response.put("exists", userRepository.existsByDisplayName(name));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/change-nickname")
    public ResponseEntity<Map<String, Object>> changeNickname(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String email = request.get("email");
        String newNickname = request.get("newNickname");

        if (newNickname == null || newNickname.trim().isEmpty()) {
            response.put("success", false);
            response.put("message", "닉네임을 입력해주세요.");
            return ResponseEntity.badRequest().body(response);
        }

        if (userRepository.existsByDisplayName(newNickname)) {
            response.put("success", false);
            response.put("message", "이미 사용 중인 닉네임입니다.");
            return ResponseEntity.badRequest().body(response);
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        User user = userOpt.get();
        user.setDisplayName(newNickname);
        userRepository.save(user);

        response.put("success", true);
        response.put("message", "닉네임이 성공적으로 변경되었습니다.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteUser(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String email = request.get("email");

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        List<Room> userRooms = roomRepository.findByProfessorEmail(email);
        for (Room room : userRooms) {
            String publicId = room.getImagePublicId();
            if (publicId != null && !publicId.isBlank()) {
                cloudinaryService.deleteImage(publicId);
            }
            roomRepository.delete(room);
        }

        userRepository.deleteById(userOpt.get().getId());

        response.put("success", true);
        response.put("message", "회원 탈퇴 및 이미지, 생성한 방 삭제 완료");
        return ResponseEntity.ok(response);
    }

    private String generateCode() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
