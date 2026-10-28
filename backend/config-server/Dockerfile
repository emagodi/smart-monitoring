FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
# Maven's download cache is kept between builds (shared by all services), so a rebuild only downloads what is new.
# If Maven Central cannot be reached, everything already in the cache is still used.
ARG MAVEN_NET_OPTS="-Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.http.retryHandler.requestSentEnabled=true -Dhttp.keepAlive=false -Dmaven.wagon.http.pool=false -Dmaven.wagon.http.connectionTimeout=60000 -Dmaven.wagon.http.readTimeout=60000"
COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,id=m2,target=/root/.m2 \
    mvn -B -q ${MAVEN_NET_OPTS} -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8888
ENTRYPOINT ["java","-jar","/app/app.jar"]
