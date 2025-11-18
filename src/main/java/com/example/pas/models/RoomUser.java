package com.example.pas.models;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.*;

@Document(collection = "room_user")
public class RoomUser {
    @Id
    private String id;

    private String roomCode;
    private String userId;
    private String nickname;
    private Integer totalScore = 0;

    private int questionIndex;

    private Map<Integer, Boolean> correct = new HashMap<>();
    private Map<Integer, Long> submitTime = new HashMap<>();
    private Map<Integer, List<Integer>> selectedIndexes = new HashMap<>();
    private Map<Integer, String> selectedOX = new HashMap<>();
    private Map<Integer, String> shortAnswer = new HashMap<>();
    private Map<Integer, Integer> score = new HashMap<>();

    public RoomUser() {
    }

    public RoomUser(String roomCode, String userId, int questionIndex) {
        this.roomCode = roomCode;
        this.userId = userId;
        this.questionIndex = questionIndex;
    }

    public String getId() {
        return id;
    }

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public int getQuestionIndex() {
        return questionIndex;
    }

    public void setQuestionIndex(int questionIndex) {
        this.questionIndex = questionIndex;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public Integer getTotalScore() {
        return totalScore;
    }

    public void setTotalScore(int totalScore) {
        this.totalScore = totalScore;
    }

    public boolean isCorrect() {
        return correct.getOrDefault(questionIndex, false);
    }

    public void setCorrect(int index, boolean value) {
        this.correct.put(index, value);
    }

    public void setCorrect(boolean value) {
        this.setCorrect(this.questionIndex, value);
    }

    public Long getSubmitTime() {
        return submitTime.get(questionIndex);
    }

    public void setSubmitTime(int index, long time) {
        this.submitTime.put(index, time);
    }

    public void setSubmitTime(long time) {
        this.setSubmitTime(this.questionIndex, time);
    }

    public List<Integer> getSelectedIndexes() {
        return selectedIndexes.getOrDefault(questionIndex, new ArrayList<>());
    }

    public void setSelectedIndexes(int index, List<Integer> values) {
        this.selectedIndexes.put(index, values);
    }

    public void setSelectedIndexes(List<Integer> values) {
        this.setSelectedIndexes(this.questionIndex, values);
    }

    public String getSelectedOX() {
        return selectedOX.getOrDefault(questionIndex, null);
    }

    public void setSelectedOX(int index, String value) {
        this.selectedOX.put(index, value);
    }

    public void setSelectedOX(String value) {
        this.setSelectedOX(this.questionIndex, value);
    }

    public String getShortAnswer() {
        return shortAnswer.getOrDefault(questionIndex, null);
    }

    public void setShortAnswer(int index, String value) {
        this.shortAnswer.put(index, value);
    }

    public void setShortAnswer(String value) {
        this.setShortAnswer(this.questionIndex, value);
    }

    public Integer getScore() {
        return score.getOrDefault(questionIndex, null);
    }

    public void setScore(int index, int value) {
        this.score.put(index, value);
    }

    public void setScore(int value) {
        this.setScore(this.questionIndex, value);
    }
}
