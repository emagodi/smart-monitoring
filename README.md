# Smart Monitoring Microservices Project
(Eureka Server, Config Server, API Gateway, Auth Service, Transformer Service, Docker)

# About the project

<ul style="list-style-type:disc">
  <li>This project is based on Spring Boot Microservices.</li>
  <li>User can register and login through auth service.</li>
  <li>Transformer service handles sensors, transformers, and alerts.</li>
</ul>

5 services are included in this project:

- Config Server
- Eureka Server
- API Gateway
- Auth Service
- Transformer Service

### Used Dependencies

* Core
    * Spring Boot
    * Spring Security (JWT)
    * Spring Cloud (Gateway, Config, Eureka, OpenFeign)
    * Spring Data JPA
* Database
    * MySQL
* Docker 
* Validation
* Lombok
* Log4j2

### Explore Rest APIs

<table style="width:100%">
  <tr>
      <th>Method</th>
      <th>Url</th>
      <th>Description</th>
  </tr>
  <tr>
      <td>POST</td>
      <td>/api/v1/auth/register</td>
      <td>Register New User</td>
  </tr>
  <tr>
      <td>POST</td>
      <td>/api/v1/auth/authenticate</td>
      <td>Login</td>
  </tr>
  <tr>
      <td>GET</td>
      <td>/api/v1/transformers</td>
      <td>List transformers</td>
  </tr>
  <tr>
      <td>GET</td>
      <td>/api/v1/sensors</td>
      <td>List sensors</td>
  </tr>
  <tr>
      <td>GET</td>
      <td>/api/v1/sensor-readings</td>
      <td>List sensor readings</td>
  </tr>
   <tr>
      <td>GET</td>
      <td>/api/v1/alerts</td>
      <td>List alerts</td>
  </tr>
</table>

### 🔨 Run the App

<b>Local</b>

<b>1 )</b> Clone project

<b>2 )</b> Go to the project's home directory

<b>3 )</b> Run docker compose <b>`docker compose up -d`</b>

<b>4 )</b> The services will start up. You can access Eureka Dashboard at http://localhost:8761

<b>5 )</b> Access Swagger UI for services:
- Auth Service: http://localhost:8080/auth/swagger-ui/index.html
- Transformer Service: http://localhost:8080/transformer/swagger-ui/index.html
