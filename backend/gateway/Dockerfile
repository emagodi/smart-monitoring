FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
ARG MAVEN_NET_OPTS="-Dmaven.wagon.http.retryHandler.count=4 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.http.retryHandler.requestSentEnabled=true -Dhttp.keepAlive=false -Dmaven.wagon.http.pool=false -Dmaven.wagon.http.connectionTimeout=60000 -Dmaven.wagon.http.readTimeout=60000"
COPY pom.xml .
RUN mvn -q ${MAVEN_NET_OPTS} -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q ${MAVEN_NET_OPTS} -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
