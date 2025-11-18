package com.example.pas.models;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "rooms")
public class Room {
    @Id
    private String id;
    private String name;
    private String code;
    private String password;
    private String professorEmail;

    private String imageUrl;
    private String imagePublicId;

    private Map<String, String> participants;
    private List<String> anonymousQuestions;
    private Long endTime;
    private List<que> testQuestions;

    private boolean started = false;
    private int currentQuestionIndex = 0;

    private Map<String, Integer> scores;
    private Map<String, Object> submitTimes = new HashMap<>();

    public Room() {
    }

    public Room(String name, String code, String password, String professorEmail, String imageUrl,
            String imagePublicId) {
        this.name = name;
        this.code = code;
        this.password = password;
        this.professorEmail = professorEmail;
        this.imageUrl = imageUrl;
        this.imagePublicId = imagePublicId;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getCode() {
        return code;
    }

    public String getPassword() {
        return password;
    }

    public String getProfessorEmail() {
        return professorEmail;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getImagePublicId() {
        return imagePublicId;
    }

    public void setImagePublicId(String imagePublicId) {
        this.imagePublicId = imagePublicId;
    }

    public Map<String, String> getParticipants() {
        return participants;
    }

    public void setParticipants(Map<String, String> participants) {
        this.participants = participants;
    }

    public void addParticipant(String email, String nickname) {
        if (this.participants != null) {
            this.participants.put(email.replace(".", "_"), nickname);
        }
    }

    public List<String> getAnonymousQuestions() {
        return anonymousQuestions;
    }

    public void setAnonymousQuestions(List<String> anonymousQuestions) {
        this.anonymousQuestions = anonymousQuestions;
    }

    public List<que> getTestQuestions() {
        return testQuestions;
    }

    public void setTestQuestions(List<que> testQuestions) {
        this.testQuestions = testQuestions;
    }

    public void addTestQuestion(que question) {
        if (this.testQuestions != null) {
            this.testQuestions.add(question);
        }
    }

    public boolean isStarted() {
        return started;
    }

    public void setStarted(boolean started) {
        this.started = started;
    }

    public int getCurrentQuestionIndex() {
        return currentQuestionIndex;
    }

    public void setCurrentQuestionIndex(int currentQuestionIndex) {
        this.currentQuestionIndex = currentQuestionIndex;
    }

    public Map<String, Integer> getScores() {
        return scores;
    }

    public void setScores(Map<String, Integer> scores) {
        this.scores = scores;
    }

    public Long getEndTime() {
        return endTime;
    }

    public void setEndTime(Long endTime) {
        this.endTime = endTime;
    }

    public Map<String, Object> getSubmitTimes() {
        return submitTimes;
    }

    public void setSubmitTimes(Map<String, Object> submitTimes) {
        this.submitTimes = submitTimes;
    }
}
