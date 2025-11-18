package com.example.pas.repositories;

import com.example.pas.models.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);

    boolean existsByDisplayName(String displayName);

    boolean existsByEmail(String email);
}
