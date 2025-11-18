package com.example.pas.repositories;

import com.example.pas.models.RoomUser;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface RoomUserRepository extends MongoRepository<RoomUser, String> {

    Optional<RoomUser> findByRoomCodeAndUserId(String roomCode, String userId);

    List<RoomUser> findByRoomCodeAndQuestionIndex(String roomCode, int questionIndex);

    List<RoomUser> findByRoomCode(String roomCode);

    Optional<RoomUser> findByRoomCodeAndUserIdAndQuestionIndex(String roomCode, String userId, int questionIndex);
}
