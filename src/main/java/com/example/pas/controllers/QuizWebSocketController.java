package com.example.pas.controllers;

import com.example.pas.models.Room;
import com.example.pas.repositories.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/ws")
@CrossOrigin(origins = "*", allowCredentials = "false")
public class QuizWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final RoomRepository roomRepository;

    @Autowired
    public QuizWebSocketController(SimpMessagingTemplate messagingTemplate, RoomRepository roomRepository) {
        this.messagingTemplate = messagingTemplate;
        this.roomRepository = roomRepository;
    }

    // 문제 번호 갱신
    @PostMapping("/questionIndex/{code}")
    public Map<String, Object> updateAndBroadcastQuestionIndex(
            @PathVariable String code,
            @RequestBody Map<String, Integer> request) {

        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty()) {
            return Map.of("success", false, "message", "해당 방이 존재하지 않습니다.");
        }

        int index = request.getOrDefault("currentQuestionIndex", 0);
        Room room = roomOpt.get();

        long timeLimitMillis = 30 * 1000L;
        if (room.getTestQuestions() != null && room.getTestQuestions().size() > index) {
            timeLimitMillis = room.getTestQuestions().get(index).getTime() * 1000L;
        }

        long endTime = System.currentTimeMillis() + timeLimitMillis;

        // 값 저장
        room.setCurrentQuestionIndex(index);
        room.setEndTime(endTime);
        roomRepository.save(room);

        messagingTemplate.convertAndSend("/topic/room/" + code, Map.of(
                "type", "questionIndex",
                "currentQuestionIndex", index,
                "endTime", endTime));

        return Map.of("success", true, "message", "문제 번호 전송 완료");
    }

    // 퀴즈 시작 알림 전송
    @MessageMapping("/room/{code}/startQuiz")
    public void startQuiz(@DestinationVariable String code) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty())
            return;

        Room room = roomOpt.get();
        int index = room.getCurrentQuestionIndex();

        long timeLimitMillis = 30 * 1000L;
        if (room.getTestQuestions() != null && room.getTestQuestions().size() > index) {
            timeLimitMillis = room.getTestQuestions().get(index).getTime() * 1000L;
        }

        long endTime = System.currentTimeMillis() + timeLimitMillis;
        room.setEndTime(endTime);
        roomRepository.save(room);

        messagingTemplate.convertAndSend("/topic/room/" + code, Map.of(
                "type", "startQuiz",
                "currentQuestionIndex", index,
                "endTime", endTime));
    }

    // WebSocket 메시지로 문제 번호 전송 요청
    @MessageMapping("/room/{code}/sendIndex")
    public void sendQuestionIndex(@DestinationVariable String code, @Payload Map<String, Object> payload) {
        if (payload == null || !payload.containsKey("index"))
            return;

        int index = Integer.parseInt(payload.get("index").toString());

        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isPresent()) {
            Room room = roomOpt.get();

            long timeLimitMillis = 30 * 1000L;
            if (room.getTestQuestions() != null && room.getTestQuestions().size() > index) {
                timeLimitMillis = room.getTestQuestions().get(index).getTime() * 1000L;
            }

            long endTime = System.currentTimeMillis() + timeLimitMillis;

            room.setCurrentQuestionIndex(index);
            room.setEndTime(endTime);
            roomRepository.save(room);

            messagingTemplate.convertAndSend("/topic/room/" + code, Map.of(
                    "type", "questionIndex",
                    "currentQuestionIndex", index,
                    "endTime", endTime));
        }
    }

    // 채팅 전송
    @MessageMapping("/room/{code}/sendChat")
    public void sendChat(@DestinationVariable String code, @Payload Map<String, String> payload) {
        String nickname = payload.getOrDefault("nickname", "익명");
        String message = payload.getOrDefault("message", "");

        messagingTemplate.convertAndSend("/topic/room/" + code, Map.of(
                "type", "chat",
                "nickname", nickname,
                "message", message));
    }

    // 결과 보기 전송
    @MessageMapping("/room/{code}/showResult")
    public void showResult(@DestinationVariable String code, @Payload Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/room/" + code, payload);
    }

    // 결과 닫기 전송
    @MessageMapping("/room/{code}/closeResult")
    public void closeResult(@DestinationVariable String code) {
        messagingTemplate.convertAndSend("/topic/room/" + code, Map.of(
                "type", "closeResult"));
    }

}
