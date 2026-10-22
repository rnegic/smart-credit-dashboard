# Этап сборки
FROM gradle:8-jdk21 AS build
WORKDIR /app
COPY . .
RUN ./gradlew bootJar --no-daemon

# Этап запуска
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

