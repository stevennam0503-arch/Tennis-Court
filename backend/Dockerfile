FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B verify
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN useradd --system --uid 10001 courtly
COPY --from=build /app/target/courtly-backend-1.0.0.jar app.jar
USER courtly
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
