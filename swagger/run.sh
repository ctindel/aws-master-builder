docker rm -f swagger 
docker run -d -p 8080:8080 --name swagger -h swagger swaggerapi/swagger-editor
