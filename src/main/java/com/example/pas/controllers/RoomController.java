package com.example.pas.controllers;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.example.pas.models.Room;
import com.example.pas.models.que;
import com.example.pas.repositories.RoomRepository;
import com.example.pas.models.RoomUser;
import com.example.pas.repositories.RoomUserRepository;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*", allowCredentials = "false")
public class RoomController {

    private final RoomRepository roomRepository;
    private final RoomUserRepository roomUserRepository;
    private final Cloudinary cloudinary;
    private final SimpMessagingTemplate messagingTemplate;

    private String generateRoomCode() {
        return UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    @Autowired
    public RoomController(RoomRepository roomRepository,
            Cloudinary cloudinary,
            RoomUserRepository roomUserRepository,
            SimpMessagingTemplate messagingTemplate) {
        this.roomRepository = roomRepository;
        this.cloudinary = cloudinary;
        this.roomUserRepository = roomUserRepository;
        this.messagingTemplate = messagingTemplate;
    }

    // 방 생성
    @PostMapping("/create")
    public Map<String, Object> createRoom(@RequestBody Map<String, String> request) {
        String name = request.get("name");
        String password = request.get("password");
        String professorEmail = request.get("professorEmail");
        String imageUrl = request.getOrDefault("imageUrl", "");
        String imagePublicId = request.getOrDefault("imagePublicId", "");
        String code = generateRoomCode();

        Room room = new Room(name, code, password, professorEmail, imageUrl, imagePublicId);
        roomRepository.save(room);

        return Map.of("success", true, "message", "방 생성 완료!", "roomCode", code);
    }

    // 방 이미지 업데이트
    @PutMapping("/updateImage/{code}")
    public Map<String, Object> updateRoomImage(@PathVariable String code, @RequestBody Map<String, String> request) {
        Optional<Room> optionalRoom = roomRepository.findByCode(code);
        if (optionalRoom.isEmpty()) {
            return Map.of("success", false, "message", "방을 찾을 수 없습니다.");
        }

        Room room = optionalRoom.get();
        try {
            if (room.getImagePublicId() != null && !room.getImagePublicId().isEmpty()) {
                cloudinary.uploader().destroy(room.getImagePublicId(), ObjectUtils.emptyMap());
            }
        } catch (Exception e) {
        }

        String newUrl = request.get("imageUrl");
        String newPublicId = request.get("imagePublicId");

        room.setImageUrl(newUrl);
        room.setImagePublicId(newPublicId);
        roomRepository.save(room);

        return Map.of("success", true, "message", "이미지 업데이트 완료");
    }

    // 방 삭제
    @DeleteMapping("/delete/{code}")
    public Map<String, Object> deleteRoom(@PathVariable String code) {
        Optional<Room> roomOptional = roomRepository.findByCode(code);
        if (roomOptional.isPresent()) {
            Room room = roomOptional.get();
            try {
                if (room.getImagePublicId() != null && !room.getImagePublicId().isEmpty()) {
                    cloudinary.uploader().destroy(room.getImagePublicId(), ObjectUtils.emptyMap());
                }
            } catch (Exception e) {
            }

            roomRepository.delete(room);
            return Map.of("success", true, "message", "방이 삭제되었습니다.");
        }
        return Map.of("success", false, "message", "방을 찾을 수 없습니다.");
    }

    // 방 목록 조회
    @GetMapping("/list")
    public List<Room> getRooms() {
        return roomRepository.findAll();
    }

    // 방 상세 정보
    @GetMapping("/info")
    public Map<String, Object> getRoomInfo(@RequestParam String code) {
        Optional<Room> roomOptional = roomRepository.findByCode(code);
        if (roomOptional.isEmpty()) {
            return Map.of("success", false, "message", "방을 찾을 수 없습니다.");
        }

        Room room = roomOptional.get();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("name", room.getName());
        response.put("participants", room.getParticipants());
        response.put("imageUrl", room.getImageUrl());
        response.put("imagePublicId", room.getImagePublicId());
        response.put("testQuestions", room.getTestQuestions() != null ? room.getTestQuestions() : new ArrayList<>());
        response.put("professorEmail", room.getProfessorEmail());
        response.put("currentQuestionIndex", room.getCurrentQuestionIndex());
        response.put("endTime", room.getEndTime());

        return response;
    }

    // 닉네임 등록 + 방 참여
    @PostMapping("/join")
    public Map<String, Object> joinRoom(@RequestBody Map<String, String> request) {
        String code = request.get("code");
        String password = request.get("password");
        String userId = request.get("userId");
        String nickname = request.get("nickname");

        if (code == null || userId == null) {
            return Map.of("success", false, "message", "잘못된 요청입니다.");
        }

        String emailKey = userId.replace(".", "_");

        Optional<Room> roomOptional = roomRepository.findByCode(code);
        if (roomOptional.isEmpty()) {
            return Map.of("success", false, "message", "방을 찾을 수 없습니다.");
        }

        Room room = roomOptional.get();

        if (nickname != null && !nickname.trim().isEmpty()) {
            Map<String, String> participants = room.getParticipants();
            if (participants == null)
                participants = new HashMap<>();

            String existingNickname = participants.get(emailKey);
            if (existingNickname != null && !existingNickname.trim().isEmpty()) {
                return Map.of("success", true, "message", "기존 닉네임", "nickname", existingNickname);
            }

            if (participants.containsValue(nickname)) {
                return Map.of("success", false, "message", "이미 사용 중인 닉네임입니다.");
            }
            participants.put(emailKey, nickname);
            room.setParticipants(participants);
            roomRepository.save(room);
            return Map.of("success", true, "message", "닉네임 등록", "nickname", nickname);
        }

        if (password == null || !room.getPassword().equals(password)) {
            return Map.of("success", false, "message", "비밀번호가 틀렸습니다.");
        }

        Map<String, String> participants = room.getParticipants();
        if (participants == null)
            participants = new HashMap<>();

        if (!participants.containsKey(emailKey)) {
            participants.put(emailKey, "");
            room.setParticipants(participants);
            roomRepository.save(room);
        }

        return Map.of("success", true, "message", "닉네임을 설정해주세요.");
    }

    // 방 비밀번호 확인
    @PostMapping("/checkPassword")
    public Map<String, Object> checkRoomPassword(@RequestBody Map<String, String> request) {
        String code = request.get("code");
        String password = request.get("password");

        Optional<Room> roomOptional = roomRepository.findByCode(code);
        if (roomOptional.isEmpty())
            return Map.of("success", false, "message", "방 없음");

        Room room = roomOptional.get();
        if (!room.getPassword().equals(password))
            return Map.of("success", false, "message", "비밀번호 틀림");

        return Map.of("success", true, "message", "확인 완료");
    }

    // 문제 저장
    @PostMapping("/{code}/questions")
    public Map<String, Object> saveTestQuestions(@PathVariable String code, @RequestBody List<que> questions) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty())
            return Map.of("success", false, "message", "방 없음");

        Room room = roomOpt.get();
        room.setTestQuestions(questions);
        roomRepository.save(room);
        return Map.of("success", true, "message", "문제 저장됨");
    }

    // 퀴즈 상태 제어
    @PutMapping("/start/{code}")
    public Map<String, Object> startQuiz(@PathVariable String code) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty()) {
            return Map.of("success", false, "message", "방 없음");
        }

        Room room = roomOpt.get();
        room.setStarted(true);
        room.setCurrentQuestionIndex(0);

        List<que> questions = room.getTestQuestions();
        if (questions != null && !questions.isEmpty()) {
            int timeLimit = questions.get(0).getTime();
            long endTime = System.currentTimeMillis() + timeLimit * 1000L;
            room.setEndTime(endTime);
        }

        Map<String, String> participants = room.getParticipants();
        if (participants != null && !participants.isEmpty()) {
            for (String userId : participants.keySet()) {
                RoomUser user = new RoomUser();
                user.setRoomCode(code);
                user.setUserId(userId);
                user.setNickname(participants.get(userId));
                user.setTotalScore(0);
                user.setQuestionIndex(0);
                roomUserRepository.save(user);
            }
        }

        roomRepository.save(room);
        return Map.of("success", true, "message", "퀴즈 시작", "endTime", room.getEndTime());
    }

    @PutMapping("/setStart/{code}")
    public Map<String, Object> setQuizStarted(@PathVariable String code, @RequestBody Map<String, Boolean> request) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty())
            return Map.of("success", false, "message", "방 없음");

        Room room = roomOpt.get();
        boolean start = request.getOrDefault("isStarted", false);
        room.setStarted(start);
        if (!start)
            room.setCurrentQuestionIndex(0);
        roomRepository.save(room);
        return Map.of("success", true, "message", "퀴즈 상태 변경");
    }

    @PutMapping("/updateIndex/{code}")
    public Map<String, Object> updateCurrentIndex(@PathVariable String code,
            @RequestBody Map<String, Integer> request) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty())
            return Map.of("success", false, "message", "방 없음");

        Room room = roomOpt.get();
        int index = request.getOrDefault("currentQuestionIndex", 0);
        room.setCurrentQuestionIndex(index);
        roomRepository.save(room);
        return Map.of("success", true, "message", "인덱스 변경");
    }

    @GetMapping("/status")
    public Map<String, Object> getRoomStatus(@RequestParam String code) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty())
            return Map.of("success", false, "message", "방 없음");

        Room room = roomOpt.get();
        return Map.of(
                "success", true,
                "isStarted", room.isStarted(),
                "currentQuestionIndex", room.getCurrentQuestionIndex());
    }

    // 채점 및 점수 반영
    @PostMapping("/submit/{code}")
    public Map<String, Object> submitAnswer(@PathVariable String code, @RequestBody Map<String, Object> payload) {
        Optional<Room> optionalRoom = roomRepository.findByCode(code);
        if (optionalRoom.isEmpty())
            return Map.of("success", false, "message", "방 없음");

        Room room = optionalRoom.get();
        int currentIndex = room.getCurrentQuestionIndex();
        List<que> questions = room.getTestQuestions();

        if (questions == null || currentIndex >= questions.size()) {
            return Map.of("success", false, "message", "문제 없음");
        }

        que question = questions.get(currentIndex);
        String userId = ((String) payload.get("userId")).replace(".", "_");
        if (userId == null || userId.isBlank())
            return Map.of("success", false, "message", "사용자 없음");

        Object correct = question.getCorrectAnswer();
        if (correct == null)
            return Map.of("success", false, "message", "정답 없음");

        boolean isCorrect = false;
        List<Integer> selectedIndexes = new ArrayList<>();
        String selectedOX = null;
        String shortAnswer = null;

        // 정답 비교 로직
        switch (question.getType()) {
            case "multiple" -> {
                Object rawSelected = payload.get("selectedIndexes");
                if (rawSelected instanceof List<?> selectedRaw) {
                    selectedIndexes = selectedRaw.stream()
                            .map(o -> (o instanceof Integer) ? (Integer) o : Integer.parseInt(o.toString()))
                            .toList();

                    if (correct instanceof List<?> correctList) {
                        List<Integer> correctIndexes = correctList.stream()
                                .map(o -> (o instanceof Integer) ? (Integer) o : Integer.parseInt(o.toString()))
                                .toList();
                        isCorrect = new HashSet<>(correctIndexes).equals(new HashSet<>(selectedIndexes));
                    } else {
                        isCorrect = selectedIndexes.size() == 1 &&
                                selectedIndexes.get(0).toString().equals(correct.toString());
                    }
                }
            }

            case "ox" -> {
                selectedOX = (String) payload.get("selectedAnswer");
                isCorrect = matchAnswer(correct, selectedOX);
            }

            case "short" -> {
                shortAnswer = (String) payload.get("shortAnswer");
                isCorrect = matchAnswer(correct, shortAnswer);
            }
        }

        // 기존 제출 데이터가 있으면 갱신, 없으면 새로 생성
        RoomUser ru = roomUserRepository
                .findByRoomCodeAndUserIdAndQuestionIndex(code, userId, currentIndex)
                .orElse(new RoomUser(code, userId, currentIndex));

        ru.setCorrect(isCorrect);
        ru.setSubmitTime(System.currentTimeMillis());
        ru.setNickname(room.getParticipants().get(userId));

        if (question.getType().equals("multiple")) {
            ru.setSelectedIndexes(selectedIndexes);
        } else if (question.getType().equals("ox")) {
            ru.setSelectedOX(selectedOX);
        } else if (question.getType().equals("short")) {
            ru.setShortAnswer(shortAnswer);
        }

        if (ru.getScore() == null) {
            ru.setScore(isCorrect ? question.getScore() : 0);
        }

        roomUserRepository.save(ru);

        return Map.of(
                "success", true,
                "correct", isCorrect,
                "score", ru.getScore());
    }

    private boolean matchAnswer(Object correct, Object userAnswer) {
        if (correct == null || userAnswer == null)
            return false;

        String correctStr;
        if (correct instanceof List<?> list && list.size() == 1) {
            correctStr = list.get(0).toString().trim();
        } else {
            correctStr = correct.toString().trim();
        }

        return correctStr.equalsIgnoreCase(userAnswer.toString().trim());
    }

    // 문제 결과 통계 조회
    @GetMapping("/result/{code}/{questionIndex}")
    public Map<String, Object> getQuestionResult(@PathVariable String code, @PathVariable int questionIndex,
            @RequestParam String userId) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty()) {
            return Map.of("success", false, "message", "방 없음");
        }

        Room room = roomOpt.get();
        List<que> questions = room.getTestQuestions();
        if (questions == null || questionIndex >= questions.size()) {
            return Map.of("success", false, "message", "문제 없음");
        }

        que currentQuestion = questions.get(questionIndex);
        List<RoomUser> userResults = roomUserRepository.findByRoomCodeAndQuestionIndex(code, questionIndex);

        // 정답률 계산
        int total = userResults.size();
        int correctCount = (int) userResults.stream().filter(RoomUser::isCorrect).count();
        int correctRate = (total > 0) ? (int) ((correctCount / (double) total) * 100) : 0;

        // 전체 점수 랭킹 계산
        List<RoomUser> allUserTotalScores = roomUserRepository.findByRoomCode(code);
        Map<String, Integer> totalScores = new HashMap<>();
        for (RoomUser ru : allUserTotalScores) {
            totalScores.put(ru.getUserId(),
                    totalScores.getOrDefault(ru.getUserId(), 0) + (ru.getScore() != null ? ru.getScore() : 0));
        }

        List<Map.Entry<String, Integer>> scoreList = new ArrayList<>(totalScores.entrySet());
        scoreList.sort((a, b) -> b.getValue() - a.getValue());

        List<Map<String, Object>> ranking = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : scoreList) {
            String nickname = room.getParticipants().get(entry.getKey());
            ranking.add(Map.of(
                    "nickname", nickname != null ? nickname : "익명",
                    "score", entry.getValue()));
        }

        // 빠른 정답자 Top3
        List<RoomUser> correctAndSubmitted = userResults.stream()
                .filter(ru -> ru.isCorrect() && ru.getSubmitTime() != null)
                .sorted(Comparator
                        .comparingLong(ru -> ru.getSubmitTime() != null ? ru.getSubmitTime() : Long.MAX_VALUE))
                .limit(3)
                .toList();

        List<Map<String, Object>> fastest = new ArrayList<>();
        for (RoomUser ru : correctAndSubmitted) {
            String nickname = room.getParticipants().get(ru.getUserId());
            long timeTaken = ru.getSubmitTime();
            fastest.add(Map.of(
                    "nickname", nickname != null ? nickname : "익명",
                    "time", timeTaken / 1000.0));
        }

        // 선택지 비율 계산
        Map<Integer, Integer> multipleCount = new HashMap<>();
        Map<String, Integer> oxCount = new HashMap<>();
        List<String> shortAnswers = new ArrayList<>();

        for (RoomUser ru : userResults) {
            switch (currentQuestion.getType()) {
                case "multiple" -> {
                    if (ru.getSelectedIndexes() != null) {
                        for (int idx : ru.getSelectedIndexes()) {
                            multipleCount.put(idx, multipleCount.getOrDefault(idx, 0) + 1);
                        }
                    }
                }
                case "ox" -> {
                    String selected = ru.getSelectedOX();
                    if (selected != null) {
                        oxCount.put(selected.toUpperCase(), oxCount.getOrDefault(selected.toUpperCase(), 0) + 1);
                    }
                }
                case "short" -> {
                    if (ru.getShortAnswer() != null && !ru.isCorrect()) {
                        shortAnswers.add(ru.getShortAnswer());
                    }
                }
            }
        }

        // 공통 choiceCounts로 설정
        Map<?, ?> choiceCounts;
        switch (currentQuestion.getType()) {
            case "multiple" -> choiceCounts = multipleCount;
            case "ox" -> choiceCounts = oxCount;
            default -> choiceCounts = new HashMap<>();
        }

        // 본인 점수
        String safeUserId = userId.replace(".", "_");
        int myScore = totalScores.getOrDefault(safeUserId, 0);

        return Map.of(
                "success", true,
                "correctRate", correctRate,
                "ranking", ranking,
                "fastest", fastest,
                "myScore", myScore,
                "correctCount", correctCount,
                "incorrectCount", total - correctCount,
                "choiceCounts", choiceCounts,
                "shortAnswers", shortAnswers);
    }

    @PutMapping("/reset/{code}")
    public Map<String, Object> resetRoom(@PathVariable String code) {
        Optional<Room> roomOpt = roomRepository.findByCode(code);
        if (roomOpt.isEmpty()) {
            return Map.of("success", false, "message", "방이 존재하지 않습니다.");
        }

        Room room = roomOpt.get();

        List<RoomUser> usersInRoom = roomUserRepository.findByRoomCode(code);
        roomUserRepository.deleteAll(usersInRoom);

        room.setParticipants(new HashMap<>());
        room.setCurrentQuestionIndex(0);
        room.setStarted(false);
        room.setEndTime(0L);
        room.setSubmitTimes(new HashMap<>());

        roomRepository.save(room);

        return Map.of("success", true, "message", "방 데이터가 초기화되었습니다.");
    }

    // 퀴즈 종료 버튼
    @MessageMapping("/room/{code}/quizEnded")
    public void handleQuizEnded(@DestinationVariable String code) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "quizEnded");
        messagingTemplate.convertAndSend("/topic/room/" + code, payload);
    }

    // 퀴즈 결과
    @GetMapping("/result-summary/{code}")
    public ResponseEntity<?> getRoomRankingSummary(@PathVariable String code) {
        List<RoomUser> users = roomUserRepository.findByRoomCode(code);

        if (users == null || users.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "참여자 정보 없음"));
        }

        // 점수 랭킹 정렬
        List<Map<String, Object>> ranking = users.stream()
                .sorted(Comparator.comparingInt(RoomUser::getTotalScore).reversed())
                .map(u -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("nickname", u.getNickname());
                    map.put("score", u.getTotalScore());
                    return map;
                })
                .collect(Collectors.toList());

        // 빠른 정답자 계산
        List<Map<String, Object>> fastest = users.stream()
                .filter(u -> u.getSubmitTime() != null)
                .map(u -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("nickname", u.getNickname());
                    map.put("time", u.getSubmitTime());
                    return map;
                })
                .sorted(Comparator.comparingLong(e -> (Long) e.get("time")))
                .limit(3)
                .collect(Collectors.toList());

        // 전체 정답 수
        long correct = users.stream().filter(RoomUser::isCorrect).count();
        long incorrect = users.size() - correct;

        return ResponseEntity.ok(Map.of(
                "success", true,
                "ranking", ranking,
                "fastest", fastest,
                "correctCount", correct,
                "incorrectCount", incorrect));
    }
}
