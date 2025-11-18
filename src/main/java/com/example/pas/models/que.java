package com.example.pas.models;

import java.util.List;

public class que {
    private String questionText;
    private String questionImage;
    private List<String> choices;
    private Object correctAnswer;
    private String name;
    private int time;
    private int score;
    private String type;

    private String templateImageName;

    public que() {
    }

    public que(String questionText, String questionImage, List<String> choices,
            Object correctAnswer, String name, int time, int score, String type) {
        this.questionText = questionText;
        this.questionImage = questionImage;
        this.choices = choices;
        this.correctAnswer = correctAnswer;
        this.name = name;
        this.time = time;
        this.score = score;
        this.type = type;
    }

    public String getQuestionText() {
        return questionText;
    }

    public void setQuestionText(String questionText) {
        this.questionText = questionText;
    }

    public String getQuestionImage() {
        return questionImage;
    }

    public void setQuestionImage(String questionImage) {
        this.questionImage = questionImage;
    }

    public List<String> getChoices() {
        return choices;
    }

    public void setChoices(List<String> choices) {
        this.choices = choices;
    }

    public Object getCorrectAnswer() {
        return correctAnswer;
    }

    public void setCorrectAnswer(Object correctAnswer) {
        this.correctAnswer = correctAnswer;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getTime() {
        return time;
    }

    public void setTime(int time) {
        this.time = time;
    }

    public int getScore() {
        return score;
    }

    public void setScore(int score) {
        this.score = score;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTemplateImageName() {
        return templateImageName;
    }

    public void setTemplateImageName(String templateImageName) {
        this.templateImageName = templateImageName;
    }
}
