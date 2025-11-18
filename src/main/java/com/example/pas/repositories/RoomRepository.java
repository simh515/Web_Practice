package com.example.pas.repositories;

import com.example.pas.models.Room;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends MongoRepository<Room, String> {
    Optional<Room> findByCode(String code);

    List<Room> findByProfessorEmail(String email);
}
